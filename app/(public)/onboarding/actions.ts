'use server'

import crypto from 'node:crypto'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient, isSupabaseConfigured } from '@/lib/supabase/config'
import {
  PhoneOtpVerifySchema,
  PhoneRequestSchema,
  deriveRoleFromEmail,
} from '@/lib/validators/auth'

const PHONE_OTP_COOKIE = 'mite_phone_otp'
const OTP_TTL_MS = 10 * 60 * 1000

interface SignedPhoneOtpPayload {
  phone: string
  code: string
  exp: number
}

function getSigningSecret(): string {
  return process.env.QR_SIGNING_SECRET?.trim() || 'mite-canteen-onboarding-dev-secret'
}

function signPayload(payload: SignedPhoneOtpPayload): string {
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
  const sig = crypto
    .createHmac('sha256', getSigningSecret())
    .update(encoded)
    .digest('base64url')
  return `${encoded}.${sig}`
}

function verifyPayload(token: string): SignedPhoneOtpPayload | null {
  const [encoded, sig] = token.split('.')
  if (!encoded || !sig) return null
  const expectedSig = crypto
    .createHmac('sha256', getSigningSecret())
    .update(encoded)
    .digest('base64url')

  const sigBuf = Buffer.from(sig, 'utf8')
  const expectedBuf = Buffer.from(expectedSig, 'utf8')
  if (sigBuf.length !== expectedBuf.length) return null
  if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return null

  try {
    const parsed = JSON.parse(
      Buffer.from(encoded, 'base64url').toString('utf8')
    ) as SignedPhoneOtpPayload
    if (!parsed.phone || !parsed.code || typeof parsed.exp !== 'number') {
      return null
    }
    if (Date.now() > parsed.exp) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export async function requestPhoneVerificationCode(phoneInput: string): Promise<{
  success: boolean
  code?: string
  error?: string
}> {
  const parsed = PhoneRequestSchema.safeParse({ phone: phoneInput })
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || 'Enter a valid 10-digit Indian mobile number',
    }
  }

  const phone = parsed.data.phone
  const code = String(crypto.randomInt(100000, 1000000))
  const token = signPayload({
    phone,
    code,
    exp: Date.now() + OTP_TTL_MS,
  })

  const cookieStore = await cookies()
  cookieStore.set(PHONE_OTP_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 600,
  })

  // Best-effort audit entry in sms_log when Supabase is configured
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient()
      await supabase.from('sms_log').insert({
        phone,
        body: `Your verification code: ${code}. Valid for 10 minutes.`,
        kind: 'phone_otp',
      })
    } catch {
      // Non-fatal in hackathon demo mode
    }
  }

  return { success: true, code }
}

export async function completePhoneOnboarding(input: {
  phone: string
  code: string
}): Promise<{
  success: boolean
  role?: 'student' | 'faculty'
  fullName?: string | null
  error?: string
}> {
  const parsed = PhoneOtpVerifySchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || 'Invalid phone number or verification code',
    }
  }

  const { phone, code } = parsed.data
  const cookieStore = await cookies()
  const rawToken = cookieStore.get(PHONE_OTP_COOKIE)?.value
  const verifiedCookie = rawToken ? verifyPayload(rawToken) : null

  const matchesIssuedCode =
    verifiedCookie !== null &&
    verifiedCookie.phone === phone &&
    (verifiedCookie.code === code || code === '123456')

  // Also always allow "123456" fallback if cookie matches phone or if cookie wasn't persisted
  const isValidCode = matchesIssuedCode || code === '123456'

  if (!isValidCode) {
    return {
      success: false,
      error: 'Invalid verification code. Enter the code shown in the SMS popup or 123456.',
    }
  }

  if (!isSupabaseConfigured()) {
    return {
      success: false,
      error: 'Supabase authentication is not configured yet.',
    }
  }

  const supabase = await createClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return {
      success: false,
      error: 'Please sign in with your @mite.ac.in email first.',
    }
  }

  const { data: updatedProfile, error: updateError } = await supabase
    .from('profiles')
    .update({
      phone,
      phone_verified: true,
    })
    .eq('user_id', user.id)
    .select('role, full_name')
    .maybeSingle()

  if (updateError) {
    if (updateError.code === '23505') {
      return {
        success: false,
        error: 'This mobile number is already linked to another account.',
      }
    }
    return {
      success: false,
      error: updateError.message || 'Could not update your phone verification status.',
    }
  }

  let finalRole: 'student' | 'faculty' =
    updatedProfile?.role === 'faculty' ? 'faculty' : 'student'
  let finalName: string | null = updatedProfile?.full_name ?? null

  if (!updatedProfile) {
    // Fallback if profile row didn't exist yet
    finalRole = deriveRoleFromEmail(user.email ?? '')
    finalName =
      (user.user_metadata?.full_name as string | undefined) ??
      user.email?.split('@')[0] ??
      null
    const serviceClient = createServiceRoleClient()
    if (serviceClient) {
      const { error: insertError } = await serviceClient.from('profiles').insert({
        user_id: user.id,
        full_name: finalName,
        role: finalRole,
        phone,
        phone_verified: true,
      })
      if (insertError) {
        if (insertError.code === '23505') {
          return {
            success: false,
            error: 'This mobile number is already linked to another account.',
          }
        }
        return { success: false, error: insertError.message }
      }
    } else {
      return {
        success: false,
        error: 'Profile record not found. Please contact support.',
      }
    }
  }

  cookieStore.delete(PHONE_OTP_COOKIE)

  return {
    success: true,
    role: finalRole,
    fullName: finalName,
  }
}
