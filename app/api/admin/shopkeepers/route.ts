import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticatedProfile, writeAuditLog } from '@/lib/utils/server-auth'
import { createServiceRoleClient } from '@/lib/supabase/config'
import {
  CreateShopkeeperSchema,
  ResetShopkeeperPasswordSchema,
} from '@/lib/validators/admin'

export async function POST(request: NextRequest) {
  const auth = await requireAuthenticatedProfile(['admin'])
  if (!auth.ok) return auth.response

  const serviceClient = createServiceRoleClient()
  if (!serviceClient) {
    return NextResponse.json(
      { error: 'SUPABASE_SERVICE_ROLE_KEY is required to create staff accounts' },
      { status: 503 }
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 })
  }

  const parsed = CreateShopkeeperSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Invalid shopkeeper payload' },
      { status: 400 }
    )
  }

  const { email, password, display_name, counter } = parsed.data

  const { data: createdAuth, error: authCreateError } =
    await serviceClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: display_name },
    })

  if (authCreateError || !createdAuth.user) {
    return NextResponse.json(
      { error: authCreateError?.message || 'Failed to create auth user' },
      { status: 400 }
    )
  }

  const newUserId = createdAuth.user.id

  // Ensure profile role is shopkeeper
  const { error: profileErr } = await serviceClient
    .from('profiles')
    .upsert(
      {
        user_id: newUserId,
        full_name: display_name,
        role: 'shopkeeper',
        phone_verified: true,
      },
      { onConflict: 'user_id' }
    )

  if (profileErr) {
    return NextResponse.json(
      { error: profileErr.message || 'Failed to assign shopkeeper profile' },
      { status: 500 }
    )
  }

  const { data: staffRow, error: staffErr } = await serviceClient
    .from('staff_accounts')
    .insert({
      user_id: newUserId,
      display_name,
      counter,
      active: true,
    })
    .select('*')
    .single()

  if (staffErr || !staffRow) {
    return NextResponse.json(
      { error: staffErr?.message || 'Failed to create staff_accounts record' },
      { status: 500 }
    )
  }

  await writeAuditLog(serviceClient, {
    actorId: auth.user.id,
    action: 'admin_create_shopkeeper',
    tableName: 'staff_accounts',
    rowId: staffRow.id,
    diff: { email, display_name, counter },
  })

  return NextResponse.json({ row: staffRow }, { status: 201 })
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAuthenticatedProfile(['admin'])
  if (!auth.ok) return auth.response

  const serviceClient = createServiceRoleClient()
  if (!serviceClient) {
    return NextResponse.json(
      { error: 'SUPABASE_SERVICE_ROLE_KEY is required to reset passwords' },
      { status: 503 }
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 })
  }

  const parsed = ResetShopkeeperPasswordSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Invalid password payload' },
      { status: 400 }
    )
  }

  const { user_id, password } = parsed.data
  const { error } = await serviceClient.auth.admin.updateUserById(user_id, {
    password,
  })

  if (error) {
    return NextResponse.json(
      { error: error.message || 'Failed to reset password' },
      { status: 400 }
    )
  }

  await writeAuditLog(serviceClient, {
    actorId: auth.user.id,
    action: 'admin_reset_shopkeeper_password',
    tableName: 'staff_accounts',
    diff: { target_user_id: user_id },
  })

  return NextResponse.json({ message: 'Password reset successfully' })
}
