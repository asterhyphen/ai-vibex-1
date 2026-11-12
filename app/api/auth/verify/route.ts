import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient, isSupabaseConfigured } from '@/lib/supabase/config'
import { OtpVerifySchema } from '@/lib/validators/auth'

const DEMO_OTP_CODE = '1234'
const DEMO_OTP_PASSWORD = 'MiteDemoOtp@1234'

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
      { error: parsed.error.issues[0]?.message || 'Invalid email or verification code' },
      { status: 400 }
    )
  }

  const { email, token } = parsed.data

  if (token !== DEMO_OTP_CODE) {
    return NextResponse.json(
      { error: 'Invalid code. Enter 1234.' },
      { status: 401 }
    )
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: 'Supabase authentication is not configured yet' },
      { status: 503 }
    )
  }

  const supabase = await createClient()
  const adminClient = createServiceRoleClient()
  let userId: string | null = null

  if (adminClient) {
    // Service-role flow: generate a magiclink (creating user first if needed) and verify it via SSR client
    let linkRes = await adminClient.auth.admin.generateLink({
      type: 'magiclink',
      email,
    })

    if (linkRes.error || !linkRes.data?.properties?.hashed_token) {
      const createRes = await adminClient.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: {
          full_name: email.split('@')[0],
        },
      })

      if (createRes.error && !createRes.error.message.toLowerCase().includes('already')) {
        return NextResponse.json(
          { error: createRes.error.message || 'Could not create user account' },
          { status: 400 }
        )
      }

      linkRes = await adminClient.auth.admin.generateLink({
        type: 'magiclink',
        email,
      })
    }

    const hashedToken = linkRes.data?.properties?.hashed_token
    if (linkRes.error || !hashedToken) {
      return NextResponse.json(
        { error: linkRes.error?.message || 'Unable to establish authenticated session' },
        { status: 401 }
      )
    }

    const { data: verified, error: verifyError } = await supabase.auth.verifyOtp({
      token_hash: hashedToken,
      type: 'magiclink',
    })

    if (verifyError || !verified.user) {
      return NextResponse.json(
        { error: verifyError?.message || 'Unable to verify session' },
        { status: 401 }
      )
    }

    userId = verified.user.id
  } else {
    // Publishable-key flow: sign in with demo password, or sign up new @mite.ac.in user then sign in
    const signInRes = await supabase.auth.signInWithPassword({
      email,
      password: DEMO_OTP_PASSWORD,
    })

    if (signInRes.data.user) {
      userId = signInRes.data.user.id
    } else {
      const signUpRes = await supabase.auth.signUp({
        email,
        password: DEMO_OTP_PASSWORD,
        options: {
          data: {
            full_name: email.split('@')[0],
          },
        },
      })

      if (signUpRes.error) {
        const msg = signUpRes.error.message.toLowerCase()
        if (msg.includes('already')) {
          return NextResponse.json(
            {
              error:
                'This account uses a custom password. Staff and admins must sign in via their portal.',
            },
            { status: 401 }
          )
        }
        return NextResponse.json(
          { error: signUpRes.error.message || 'Unable to register account' },
          { status: 400 }
        )
      }

      if (signUpRes.data.session && signUpRes.data.user) {
        userId = signUpRes.data.user.id
      } else {
        const retrySignIn = await supabase.auth.signInWithPassword({
          email,
          password: DEMO_OTP_PASSWORD,
        })
        if (retrySignIn.error || !retrySignIn.data.user) {
          return NextResponse.json(
            { error: retrySignIn.error?.message || 'Unable to establish session' },
            { status: 401 }
          )
        }
        userId = retrySignIn.data.user.id
      }
    }
  }

  if (!userId) {
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 401 }
    )
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, phone_verified, is_blocked')
    .eq('user_id', userId)
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
