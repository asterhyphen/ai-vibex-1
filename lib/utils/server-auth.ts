import { NextResponse } from 'next/server'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient, isSupabaseConfigured } from '@/lib/supabase/config'
import type { NotificationKind, Profile, UserRole } from '@/lib/types'

export type AuthSuccess = {
  ok: true
  user: User
  profile: Profile
  supabase: SupabaseClient
  db: SupabaseClient
}

export type AuthFailure = {
  ok: false
  response: NextResponse
}

export async function requireAuthenticatedProfile(
  allowedRoles?: UserRole[]
): Promise<AuthSuccess | AuthFailure> {
  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Supabase is not configured' },
        { status: 503 }
      ),
    }
  }

  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }

  const serviceClient = createServiceRoleClient()
  const db = serviceClient ?? supabase

  const { data: profile, error: profileError } = await db
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  if (profileError || !profile) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Profile not found' }, { status: 403 }),
    }
  }

  const typedProfile = profile as Profile

  if (typedProfile.is_blocked) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Account is blocked' }, { status: 403 }),
    }
  }

  if (allowedRoles && !allowedRoles.includes(typedProfile.role)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Forbidden: insufficient permissions' },
        { status: 403 }
      ),
    }
  }

  return {
    ok: true,
    user,
    profile: typedProfile,
    supabase,
    db,
  }
}

export async function writeAuditLog(
  db: SupabaseClient,
  params: {
    actorId: string | null
    action: string
    tableName: string
    rowId?: string | null
    diff?: Record<string, unknown> | null
  }
): Promise<void> {
  try {
    await db.from('audit_log').insert({
      actor_id: params.actorId,
      action: params.action,
      table_name: params.tableName,
      row_id: params.rowId ?? null,
      diff: params.diff ?? null,
    })
  } catch {
    // Audit log failures should not crash primary business transactions
  }
}

export async function notifyUserAndSms(
  db: SupabaseClient,
  params: {
    userId: string | null
    title: string
    body: string
    kind: NotificationKind
    smsBody?: string
    smsKind?: string
  }
): Promise<void> {
  if (!params.userId) return

  try {
    await db.from('notifications').insert({
      user_id: params.userId,
      title: params.title,
      body: params.body,
      kind: params.kind,
    })

    if (params.smsBody) {
      const { data: userProfile } = await db
        .from('profiles')
        .select('phone')
        .eq('user_id', params.userId)
        .maybeSingle()

      if (userProfile?.phone) {
        await db.from('sms_log').insert({
          phone: userProfile.phone,
          body: params.smsBody,
          kind: params.smsKind ?? params.kind,
        })
      }
    }
  } catch {
    // Non-fatal notification failure
  }
}
