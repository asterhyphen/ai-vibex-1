import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { OtpVerifySchema } from '@/lib/validators/auth'

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 })
  }

  const parsed = OtpVerifySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Invalid email or OTP' },
      { status: 400 }
    )
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: 'Supabase authentication is not configured yet' },
      { status: 503 }
    )
  }

  const { email, token } = parsed.data
  const supabase = await createClient()

  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: 'email',
  })

  if (error || !data.user) {
    return NextResponse.json(
      { error: error?.message || 'Invalid or expired verification code' },
      { status: 401 }
    )
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, phone_verified, is_blocked')
    .eq('user_id', data.user.id)
    .maybeSingle()

  if (!profile) {
    return NextResponse.json({ redirect: '/onboarding' }, { status: 200 })
  }

  if (profile.is_blocked) {
    return NextResponse.json({ redirect: '/403?reason=blocked' }, { status: 200 })
  }

  if (profile.role === 'shopkeeper') {
    return NextResponse.json({ redirect: '/staff' }, { status: 200 })
  }

  if (profile.role === 'admin') {
    return NextResponse.json({ redirect: '/admin' }, { status: 200 })
  }

  if (!profile.phone_verified) {
    return NextResponse.json({ redirect: '/onboarding' }, { status: 200 })
  }

  return NextResponse.json({ redirect: '/home' }, { status: 200 })
}
