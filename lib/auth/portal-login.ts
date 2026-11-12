import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient, isSupabaseConfigured } from '@/lib/supabase/config'
import { PortalLoginSchema } from '@/lib/validators/auth'

const MAX_ATTEMPTS = 5
const LOCK_DURATION_MS = 5 * 60 * 1000

export type PortalRole = 'shopkeeper' | 'admin'

export interface PortalAuthResult {
  success: boolean
  redirect?: string
  error?: string
  lockedUntil?: string | null
  minutesLeft?: number
  attemptsRemaining?: number
  lastLoginAt?: string | null
}

function getLastLoginCookieName(role: PortalRole): string {
  return role === 'admin' ? 'mite_admin_last_login' : 'mite_staff_last_login'
}

export async function getInitialPortalState(expectedRole: PortalRole): Promise<{
  lastLoginAt: string | null
}> {
  const cookieStore = await cookies()
  const cookieLastLogin = cookieStore.get(getLastLoginCookieName(expectedRole))?.value ?? null

  if (!isSupabaseConfigured()) {
    return { lastLoginAt: cookieLastLogin }
  }

  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { lastLoginAt: cookieLastLogin }
    }

    const { data: staffAccount } = await supabase
      .from('staff_accounts')
      .select('last_login_at')
      .eq('user_id', user.id)
      .maybeSingle()

    return {
      lastLoginAt: staffAccount?.last_login_at ?? cookieLastLogin,
    }
  } catch {
    return { lastLoginAt: cookieLastLogin }
  }
}

export async function authenticatePortalUser(params: {
  email: string
  password: string
  expectedRole: PortalRole
  redirectTo: string
}): Promise<PortalAuthResult> {
  const parsed = PortalLoginSchema.safeParse({
    email: params.email,
    password: params.password,
  })

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || 'Enter a valid email and password',
    }
  }

  if (!isSupabaseConfigured()) {
    return {
      success: false,
      error: 'Supabase authentication is not configured yet.',
    }
  }

  const { email, password } = parsed.data
  const supabase = await createClient()
  const now = Date.now()

  // 1. Check current lockout state
  const { data: attemptRow } = await supabase
    .from('login_attempts')
    .select('id, attempts, locked_until')
    .eq('email', email)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (attemptRow?.locked_until) {
    const lockedUntilMs = Date.parse(attemptRow.locked_until)
    if (!Number.isNaN(lockedUntilMs) && lockedUntilMs > now) {
      const minutesLeft = Math.max(1, Math.ceil((lockedUntilMs - now) / 60_000))
      return {
        success: false,
        error: `Account locked. Try again in ${minutesLeft} ${
          minutesLeft === 1 ? 'minute' : 'minutes'
        }.`,
        lockedUntil: attemptRow.locked_until,
        minutesLeft,
      }
    }
  }

  // 2. Attempt password sign-in
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (authError || !authData.user) {
    const lockExpired =
      Boolean(attemptRow?.locked_until) &&
      Date.parse(attemptRow!.locked_until!) <= now

    const nextAttempts = lockExpired ? 1 : (attemptRow?.attempts ?? 0) + 1
    const isNowLocked = nextAttempts >= MAX_ATTEMPTS
    const lockedUntil = isNowLocked
      ? new Date(now + LOCK_DURATION_MS).toISOString()
      : null

    if (attemptRow?.id) {
      await supabase
        .from('login_attempts')
        .update({
          attempts: nextAttempts,
          locked_until: lockedUntil,
        })
        .eq('id', attemptRow.id)
    } else {
      await supabase.from('login_attempts').insert({
        email,
        attempts: nextAttempts,
        locked_until: lockedUntil,
      })
    }

    if (isNowLocked) {
      return {
        success: false,
        error: 'Account locked. Try again in 5 minutes.',
        lockedUntil,
        minutesLeft: 5,
      }
    }

    const attemptsRemaining = MAX_ATTEMPTS - nextAttempts
    return {
      success: false,
      error: `Invalid email or password. ${attemptsRemaining} ${
        attemptsRemaining === 1 ? 'attempt' : 'attempts'
      } remaining.`,
      attemptsRemaining,
    }
  }

  // 3. Verify role in profiles
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_blocked')
    .eq('user_id', authData.user.id)
    .maybeSingle()

  if (profile?.is_blocked) {
    await supabase.auth.signOut()
    return {
      success: false,
      error: 'This account has been blocked by an administrator.',
    }
  }

  if (profile?.role !== params.expectedRole) {
    await supabase.auth.signOut()
    return {
      success: false,
      error:
        params.expectedRole === 'admin'
          ? 'This account does not have administrator permissions.'
          : 'This account does not have canteen or print staff permissions.',
    }
  }

  // 4. Reset failed attempts counter
  if (attemptRow?.id) {
    await supabase
      .from('login_attempts')
      .update({ attempts: 0, locked_until: null })
      .eq('id', attemptRow.id)
  }

  // 5. Read previous last_login_at and update it to NOW()
  const dbClient = createServiceRoleClient() ?? supabase
  const { data: staffRow } = await dbClient
    .from('staff_accounts')
    .select('id, last_login_at, active')
    .eq('user_id', authData.user.id)
    .maybeSingle()

  if (staffRow && staffRow.active === false) {
    await supabase.auth.signOut()
    return {
      success: false,
      error: 'Your staff account is currently deactivated.',
    }
  }

  const previousLastLoginAt = staffRow?.last_login_at ?? null
  const loginTimestamp = new Date().toISOString()

  if (staffRow?.id) {
    await dbClient
      .from('staff_accounts')
      .update({ last_login_at: loginTimestamp })
      .eq('id', staffRow.id)
  }

  const cookieStore = await cookies()
  cookieStore.set(getLastLoginCookieName(params.expectedRole), loginTimestamp, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  })

  return {
    success: true,
    redirect: params.redirectTo,
    lastLoginAt: previousLastLoginAt,
  }
}
