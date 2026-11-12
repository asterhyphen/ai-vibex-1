import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuthenticatedProfile, writeAuditLog } from '@/lib/utils/server-auth'

const DangerActionSchema = z.object({
  action: z.enum(['reset_orders', 'reseed_slots', 'flag_noshows', 'clear_lockouts']),
  confirm: z.literal('CONFIRM'),
})

export async function POST(request: NextRequest) {
  const auth = await requireAuthenticatedProfile(['admin'])
  if (!auth.ok) return auth.response

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 })
  }

  const parsed = DangerActionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Type CONFIRM and select a valid action' },
      { status: 400 }
    )
  }

  const { action } = parsed.data
  const { db, user } = auth

  if (action === 'flag_noshows') {
    const { data: flaggedCount, error } = await db.rpc('flag_overdue_noshows')
    if (error) {
      return NextResponse.json(
        { error: error.message || 'Failed to run flag_overdue_noshows' },
        { status: 500 }
      )
    }
    await writeAuditLog(db, {
      actorId: user.id,
      action: 'admin_danger_flag_noshows',
      tableName: 'orders',
      diff: { flagged: flaggedCount ?? 0 },
    })
    return NextResponse.json({
      message: `Flagged ${flaggedCount ?? 0} overdue no-show order(s) and freed slot capacity`,
    })
  }

  if (action === 'clear_lockouts') {
    const { error } = await db
      .from('login_attempts')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    await writeAuditLog(db, {
      actorId: user.id,
      action: 'admin_danger_clear_lockouts',
      tableName: 'login_attempts',
    })
    return NextResponse.json({
      message: 'Cleared all portal login attempt lockouts',
    })
  }

  if (action === 'reseed_slots') {
    const { data: settingsRow } = await db
      .from('settings')
      .select('value')
      .eq('key', 'general')
      .maybeSingle()

    const cap = Number(
      (settingsRow?.value as Record<string, unknown>)?.slot_capacity ?? 20
    )

    // Delete today's slots or all slots with no active orders, then insert fresh 72 slots
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const todayEnd = new Date()
    todayEnd.setHours(23, 59, 59, 999)

    await db
      .from('pickup_slots')
      .delete()
      .gte('slot_start', todayStart.toISOString())
      .lte('slot_start', todayEnd.toISOString())

    const base = new Date()
    base.setHours(8, 0, 0, 0)
    const slots = []
    for (let i = 0; i < 72; i++) {
      const start = new Date(base.getTime() + i * 10 * 60_000)
      const end = new Date(start.getTime() + 10 * 60_000)
      slots.push({
        slot_start: start.toISOString(),
        slot_end: end.toISOString(),
        capacity_units: cap,
        used_units: 0,
      })
    }

    const { error } = await db.from('pickup_slots').insert(slots)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    await writeAuditLog(db, {
      actorId: user.id,
      action: 'admin_danger_reseed_slots',
      tableName: 'pickup_slots',
      diff: { created: slots.length, capacity_units: cap },
    })

    return NextResponse.json({
      message: `Regenerated ${slots.length} fresh pickup slots for today`,
    })
  }

  // reset_orders: clear transactional orders, print_jobs, notifications, reset slot counts
  const sentinel = '00000000-0000-0000-0000-000000000000'
  await db.from('order_items').delete().neq('id', sentinel)
  await db.from('orders').delete().neq('id', sentinel)
  await db.from('print_jobs').delete().neq('id', sentinel)
  await db.from('notifications').delete().neq('id', sentinel)
  await db.from('pickup_slots').update({ used_units: 0 }).neq('id', sentinel)

  await writeAuditLog(db, {
    actorId: user.id,
    action: 'admin_danger_reset_orders',
    tableName: 'orders',
    diff: { cleared: ['order_items', 'orders', 'print_jobs', 'notifications'] },
  })

  return NextResponse.json({
    message: 'Reset all demo orders, print jobs, notifications, and slot usage',
  })
}
