import { NextResponse } from 'next/server'
import { requireAuthenticatedProfile, writeAuditLog } from '@/lib/utils/server-auth'

export async function POST() {
  const auth = await requireAuthenticatedProfile(['admin'])
  if (!auth.ok) return auth.response

  const { db, user } = auth

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date()
  todayEnd.setHours(23, 59, 59, 999)

  const { count } = await db
    .from('pickup_slots')
    .select('id', { count: 'exact', head: true })
    .gte('slot_start', todayStart.toISOString())
    .lte('slot_start', todayEnd.toISOString())

  if ((count ?? 0) >= 72) {
    return NextResponse.json({
      message: 'Today already has pickup slots generated',
      created: 0,
    })
  }

  const { data: settingsRow } = await db
    .from('settings')
    .select('value')
    .eq('key', 'general')
    .maybeSingle()

  const cap = Number((settingsRow?.value as Record<string, unknown>)?.slot_capacity ?? 20)
  const base = new Date()
  base.setHours(8, 0, 0, 0)

  const slotsToInsert = []
  for (let i = 0; i < 72; i++) {
    const start = new Date(base.getTime() + i * 10 * 60_000)
    const end = new Date(start.getTime() + 10 * 60_000)
    slotsToInsert.push({
      slot_start: start.toISOString(),
      slot_end: end.toISOString(),
      capacity_units: cap,
      used_units: 0,
    })
  }

  const { error } = await db.from('pickup_slots').insert(slotsToInsert)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await writeAuditLog(db, {
    actorId: user.id,
    action: 'admin_generate_slots',
    tableName: 'pickup_slots',
    diff: { count: slotsToInsert.length, capacity_units: cap },
  })

  return NextResponse.json({
    message: `Generated ${slotsToInsert.length} slots for today`,
    created: slotsToInsert.length,
  })
}
