import crypto from 'crypto'
import { NextResponse } from 'next/server'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { CreateOrderSchema } from '@/lib/validators/order'
import type { MenuItem, PickupSlot, Profile } from '@/lib/types'
import { formatSlotTime } from '@/lib/utils/format'

const CODE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>

function getDbAdminClient(): ServerSupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return null
  return createSupabaseAdmin(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }) as unknown as ServerSupabaseClient
}

async function generateFallbackOrderCode(db: ServerSupabaseClient): Promise<string> {
  for (let i = 0; i < 40; i += 1) {
    const letter = CODE_LETTERS[crypto.randomInt(0, CODE_LETTERS.length)]
    const digits = String(crypto.randomInt(0, 10000)).padStart(4, '0')
    const candidate = `${letter}-${digits}`
    const { data } = await db
      .from('orders')
      .select('id')
      .eq('code', candidate)
      .maybeSingle()
    if (!data) return candidate
  }
  throw new Error('Could not generate unique order code')
}

export async function POST(request: Request) {
  try {
    if (
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ) {
      return NextResponse.json(
        { error: 'Supabase environment variables are not configured.' },
        { status: 503 }
      )
    }

    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    let rawBody: unknown
    try {
      rawBody = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON request body' }, { status: 400 })
    }

    const parsed = CreateOrderSchema.safeParse(rawBody)
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: parsed.error.issues[0]?.message ?? 'Invalid order payload',
          issues: parsed.error.issues,
        },
        { status: 400 }
      )
    }

    const payload = parsed.data
    const db = getDbAdminClient() ?? supabase

    // Fetch caller profile
    const { data: profileData } = await db
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    const profile = profileData as Profile | null
    if (profile?.is_blocked) {
      return NextResponse.json(
        { error: 'Your account is restricted from placing orders.' },
        { status: 403 }
      )
    }

    const isGuestPos = payload.source === 'guest'
    if (isGuestPos && profile?.role !== 'shopkeeper' && profile?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Only canteen staff or admins may place walk-in guest orders.' },
        { status: 403 }
      )
    }

    // Consolidate duplicate menuItemIds in cart payload
    const consolidatedQty = new Map<string, number>()
    for (const line of payload.items) {
      const next = (consolidatedQty.get(line.menuItemId) ?? 0) + line.qty
      consolidatedQty.set(line.menuItemId, Math.min(50, next))
    }

    const menuIds = Array.from(consolidatedQty.keys())
    const { data: dbMenuItems, error: menuError } = await db
      .from('menu_items')
      .select('*')
      .in('id', menuIds)
      .eq('is_active', true)

    if (menuError) {
      return NextResponse.json(
        { error: 'Failed to verify menu items' },
        { status: 500 }
      )
    }

    const menuMap = new Map<string, MenuItem>()
    for (const item of (dbMenuItems as MenuItem[] | null) ?? []) {
      menuMap.set(item.id, item)
    }

    const unavailableItems: string[] = []
    const orderLines: {
      menu_item_id: string
      name_snapshot: string
      qty: number
      unit_price_paise: number
    }[] = []

    let serverTotalPaise = 0
    let totalQty = 0

    for (const [menuItemId, qty] of consolidatedQty.entries()) {
      const dbItem = menuMap.get(menuItemId)
      if (!dbItem) {
        unavailableItems.push('Unknown item')
        continue
      }
      if (!dbItem.in_stock) {
        unavailableItems.push(dbItem.name)
        continue
      }
      serverTotalPaise += dbItem.price_paise * qty
      totalQty += qty
      orderLines.push({
        menu_item_id: dbItem.id,
        name_snapshot: dbItem.name,
        qty,
        unit_price_paise: dbItem.price_paise,
      })
    }

    if (unavailableItems.length > 0) {
      return NextResponse.json(
        {
          error: `Out of stock: ${unavailableItems.join(', ')}`,
          outOfStockItems: unavailableItems,
        },
        { status: 409 }
      )
    }

    if (orderLines.length === 0 || totalQty <= 0) {
      return NextResponse.json({ error: 'Order has no valid items' }, { status: 400 })
    }

    // Reserve pickup slot capacity (required for app orders, optional for guest POS)
    let slotData: PickupSlot | null = null
    let slotReserved = false
    let previousUsedUnits = 0

    if (payload.slot_id) {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const { data: fetchedSlot, error: slotErr } = await db
          .from('pickup_slots')
          .select('*')
          .eq('id', payload.slot_id)
          .maybeSingle()

        if (slotErr || !fetchedSlot) {
          return NextResponse.json(
            { error: 'Selected pickup slot not found' },
            { status: 404 }
          )
        }

        const currentSlot = fetchedSlot as PickupSlot
        if (
          currentSlot.used_units >= currentSlot.capacity_units ||
          currentSlot.used_units + totalQty > currentSlot.capacity_units
        ) {
          const remaining = Math.max(
            0,
            currentSlot.capacity_units - currentSlot.used_units
          )
          return NextResponse.json(
            {
              error:
                remaining === 0
                  ? 'Selected pickup slot is full. Please choose another slot.'
                  : `Selected slot only has ${remaining} unit${remaining === 1 ? '' : 's'} left. Please choose another slot.`,
            },
            { status: 409 }
          )
        }

        const nextUsed = currentSlot.used_units + totalQty
        const { data: updatedSlot, error: updateSlotErr } = await db
          .from('pickup_slots')
          .update({ used_units: nextUsed })
          .eq('id', currentSlot.id)
          .eq('used_units', currentSlot.used_units)
          .select('*')
          .maybeSingle()

        if (!updateSlotErr && updatedSlot) {
          slotData = updatedSlot as PickupSlot
          slotReserved = true
          previousUsedUnits = currentSlot.used_units
          break
        }
      }

      if (!slotReserved) {
        return NextResponse.json(
          { error: 'Slot capacity changed while checking out. Please retry.' },
          { status: 409 }
        )
      }
    }

    const rollbackSlot = async () => {
      if (slotReserved && slotData) {
        await db
          .from('pickup_slots')
          .update({ used_units: previousUsedUnits })
          .eq('id', slotData.id)
      }
    }

    // Generate unique order code & HMAC QR token
    let orderCode: string
    try {
      const { data: rpcCode, error: rpcErr } = await db.rpc('generate_order_code')
      if (!rpcErr && typeof rpcCode === 'string' && rpcCode.length > 0) {
        orderCode = rpcCode
      } else {
        orderCode = await generateFallbackOrderCode(db)
      }
    } catch {
      await rollbackSlot()
      return NextResponse.json(
        { error: 'Failed to generate unique order code' },
        { status: 500 }
      )
    }

    const orderId = crypto.randomUUID()
    const qrSecret =
      process.env.QR_SIGNING_SECRET?.trim() ||
      process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
      'mite-canteen-qr-secret'

    const qrToken = crypto
      .createHmac('sha256', qrSecret)
      .update(`${orderId}${orderCode}`)
      .digest('base64url')

    const etaMinutes = payload.eta_minutes ?? 5
    const arriveAt = new Date(Date.now() + etaMinutes * 60_000).toISOString()
    const isFaculty = !isGuestPos && profile?.role === 'faculty'

    const orderStatus = isGuestPos
      ? 'placed'
      : payload.payment_method === 'cash'
        ? 'awaiting_cash'
        : 'placed'

    const paymentStatus = isGuestPos
      ? 'paid'
      : payload.payment_method === 'online'
        ? 'paid'
        : 'pending'

    const { error: insertOrderErr } = await db.from('orders').insert({
      id: orderId,
      code: orderCode,
      user_id: isGuestPos ? null : user.id,
      guest_name: isGuestPos ? payload.guest_name?.trim() || 'Walk-in Guest' : null,
      guest_token: isGuestPos ? crypto.randomUUID() : null,
      source: isGuestPos ? 'guest' : 'app',
      status: orderStatus,
      payment_method: payload.payment_method,
      payment_status: paymentStatus,
      total_paise: serverTotalPaise,
      slot_id: payload.slot_id ?? null,
      eta_minutes: etaMinutes,
      arrive_at: arriveAt,
      is_faculty: isFaculty,
      qr_token: qrToken,
      note: payload.note?.trim() || null,
    })

    if (insertOrderErr) {
      await rollbackSlot()
      return NextResponse.json(
        { error: insertOrderErr.message || 'Failed to create order' },
        { status: 500 }
      )
    }

    const { error: insertItemsErr } = await db.from('order_items').insert(
      orderLines.map((line) => ({
        order_id: orderId,
        ...line,
      }))
    )

    if (insertItemsErr) {
      await db.from('orders').delete().eq('id', orderId)
      await rollbackSlot()
      return NextResponse.json(
        { error: insertItemsErr.message || 'Failed to save order items' },
        { status: 500 }
      )
    }

    // Recompute priority score
    const { error: prioErr } = await db.rpc('recompute_priority', {
      p_order_id: orderId,
    })
    if (prioErr) {
      const fallbackScore =
        new Date(arriveAt).getTime() / 60000 - (isFaculty ? 5 : 0)
      await db
        .from('orders')
        .update({ priority_score: fallbackScore })
        .eq('id', orderId)
    }

    // Notifications & SMS log for app orders
    if (!isGuestPos) {
      const slotLabel = slotData
        ? formatSlotTime(slotData.slot_start)
        : `in ${etaMinutes} min`

      await Promise.allSettled([
        db.from('notifications').insert({
          user_id: user.id,
          title: 'Order confirmed!',
          body: `Order confirmed! Pick up at ${slotLabel}`,
          kind: 'success',
        }),
        db.from('sms_log').insert({
          phone: profile?.phone || 'unverified',
          body: `Your order ${orderCode} is confirmed. Collect by ${slotLabel}.`,
          kind: 'order_confirmed',
        }),
      ])
    }

    return NextResponse.json(
      {
        code: orderCode,
        qr_token: qrToken,
        order_id: orderId,
        slot: slotData,
        eta_minutes: etaMinutes,
        total_paise: serverTotalPaise,
        status: orderStatus,
      },
      { status: 201 }
    )
  } catch (err) {
    console.error('Order creation error:', err)
    return NextResponse.json(
      { error: 'Unexpected error creating order' },
      { status: 500 }
    )
  }
}
