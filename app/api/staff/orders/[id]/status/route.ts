import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticatedProfile, notifyUserAndSms, writeAuditLog } from '@/lib/utils/server-auth'
import { OrderStatusActionSchema } from '@/lib/validators/staff'
import type { OrderStatus } from '@/lib/types'

const ACTION_TARGET_STATUS: Record<
  'accept' | 'start_preparing' | 'ready' | 'reject',
  OrderStatus
> = {
  accept: 'accepted',
  start_preparing: 'preparing',
  ready: 'ready',
  reject: 'rejected',
}

const VALID_FROM_STATUSES: Record<
  'accept' | 'start_preparing' | 'ready' | 'reject',
  OrderStatus[]
> = {
  accept: ['placed'],
  start_preparing: ['accepted'],
  ready: ['preparing'],
  reject: ['placed', 'awaiting_cash', 'accepted', 'preparing'],
}

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

  const parsed = OrderStatusActionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Invalid status action' },
      { status: 400 }
    )
  }

  const { action, reason } = parsed.data
  if (action === 'reject' && (!reason || reason.trim().length < 2)) {
    return NextResponse.json(
      { error: 'Please provide a rejection reason' },
      { status: 400 }
    )
  }

  const { db, user } = auth

  const { data: order, error: fetchError } = await db
    .from('orders')
    .select('*, order_items(*)')
    .eq('id', id)
    .maybeSingle()

  if (fetchError || !order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  const currentStatus = order.status as OrderStatus
  const allowedFrom = VALID_FROM_STATUSES[action]
  if (!allowedFrom.includes(currentStatus)) {
    const extraHint =
      action === 'accept' && currentStatus === 'awaiting_cash'
        ? 'Collect cash payment before accepting this order'
        : `Cannot perform "${action}" from status "${currentStatus}"`
    return NextResponse.json({ error: extraHint }, { status: 400 })
  }

  const nextStatus = ACTION_TARGET_STATUS[action]
  const updatePayload: Record<string, unknown> = { status: nextStatus }
  if (action === 'reject') {
    updatePayload.rejected_reason = reason?.trim()
    if (order.payment_status === 'paid') {
      updatePayload.payment_status = 'refunded'
    }
  }

  const { data: updated, error: updateError } = await db
    .from('orders')
    .update(updatePayload)
    .eq('id', id)
    .select('*, order_items(*), pickup_slot:pickup_slots(*)')
    .single()

  if (updateError || !updated) {
    return NextResponse.json(
      { error: updateError?.message || 'Failed to update order status' },
      { status: 500 }
    )
  }

  // Recompute priority score best-effort on transition
  try {
    await db.rpc('recompute_priority', { p_order_id: id })
  } catch {
    // Non-fatal
  }

  // Release slot units when an order is rejected
  if (action === 'reject' && order.slot_id) {
    try {
      const items = (order.order_items ?? []) as Array<{ qty: number }>
      const totalQty = items.reduce((sum, item) => sum + (item.qty || 0), 0)
      if (totalQty > 0) {
        const { data: slot } = await db
          .from('pickup_slots')
          .select('used_units')
          .eq('id', order.slot_id)
          .maybeSingle()
        if (slot) {
          const nextUnits = Math.max(0, Number(slot.used_units || 0) - totalQty)
          await db
            .from('pickup_slots')
            .update({ used_units: nextUnits })
            .eq('id', order.slot_id)
        }
      }
    } catch {
      // Non-fatal
    }
  }

  if (action === 'ready') {
    await notifyUserAndSms(db, {
      userId: order.user_id,
      title: `Order ${order.code} is Ready`,
      body: `Your order ${order.code} is ready. Please show your QR at the counter.`,
      kind: 'success',
      smsBody: `Your order ${order.code} is ready. Collect at SkipQ counter.`,
      smsKind: 'order_ready',
    })
  } else if (action === 'reject') {
    const cleanReason = reason?.trim() || 'Item unavailable'
    await notifyUserAndSms(db, {
      userId: order.user_id,
      title: `Order ${order.code} Rejected`,
      body: `Reason: ${cleanReason}`,
      kind: 'error',
      smsBody: `Your SkipQ order ${order.code} was rejected: ${cleanReason}`,
      smsKind: 'order_rejected',
    })
  } else if (action === 'accept') {
    await notifyUserAndSms(db, {
      userId: order.user_id,
      title: `Order ${order.code} Accepted`,
      body: `The kitchen has accepted your order ${order.code}.`,
      kind: 'info',
    })
  }

  await writeAuditLog(db, {
    actorId: user.id,
    action: `order_${action}`,
    tableName: 'orders',
    rowId: id,
    diff: {
      code: order.code,
      from: currentStatus,
      to: nextStatus,
      ...(reason ? { reason: reason.trim() } : {}),
    },
  })

  return NextResponse.json({ order: updated })
}
