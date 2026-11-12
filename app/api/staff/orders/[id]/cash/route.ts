import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticatedProfile, notifyUserAndSms, writeAuditLog } from '@/lib/utils/server-auth'
import { CashCollectSchema } from '@/lib/validators/staff'
import { formatPaise } from '@/lib/utils/format'

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuthenticatedProfile(['shopkeeper', 'admin'])
  if (!auth.ok) return auth.response

  const { id } = await context.params
  if (!id) {
    return NextResponse.json({ error: 'Order ID is required' }, { status: 400 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 })
  }

  const parsed = CashCollectSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Invalid cash amount' },
      { status: 400 }
    )
  }

  const { cash_received_paise } = parsed.data
  const { db, user } = auth

  const { data: order, error: fetchError } = await db
    .from('orders')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (fetchError || !order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  if (order.status !== 'awaiting_cash') {
    return NextResponse.json(
      { error: `Order is currently "${order.status}", not awaiting cash` },
      { status: 400 }
    )
  }

  const totalPaise = Number(order.total_paise ?? 0)
  if (cash_received_paise < totalPaise) {
    return NextResponse.json(
      {
        error: `Cash received (${formatPaise(cash_received_paise)}) is less than order total (${formatPaise(totalPaise)})`,
      },
      { status: 400 }
    )
  }

  const changeGivenPaise = cash_received_paise - totalPaise

  const { data: updated, error: updateError } = await db
    .from('orders')
    .update({
      cash_received_paise,
      change_given_paise: changeGivenPaise,
      payment_status: 'paid',
      status: 'placed',
    })
    .eq('id', id)
    .select('*, order_items(*), pickup_slot:pickup_slots(*)')
    .single()

  if (updateError || !updated) {
    return NextResponse.json(
      { error: updateError?.message || 'Failed to record cash payment' },
      { status: 500 }
    )
  }

  try {
    await db.rpc('recompute_priority', { p_order_id: id })
  } catch {
    // Non-fatal
  }

  await notifyUserAndSms(db, {
    userId: order.user_id,
    title: `Cash Received for ${order.code}`,
    body: `Payment of ${formatPaise(totalPaise)} received. Your order is now queued for kitchen acceptance.`,
    kind: 'success',
  })

  await writeAuditLog(db, {
    actorId: user.id,
    action: 'order_cash_collected',
    tableName: 'orders',
    rowId: id,
    diff: {
      code: order.code,
      total_paise: totalPaise,
      cash_received_paise,
      change_given_paise: changeGivenPaise,
    },
  })

  return NextResponse.json({ order: updated })
}
