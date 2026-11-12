import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceRoleClient, isSupabaseConfigured } from '@/lib/supabase/config'
import { createClient } from '@/lib/supabase/server'
import type { Order } from '@/lib/types'

const UpdateEtaSchema = z.object({
  delta_minutes: z.number().int().min(1).max(30).default(5),
})

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>

function getDbAdminClient(): ServerSupabaseClient | null {
  return createServiceRoleClient() as unknown as ServerSupabaseClient | null
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ code: string }> }
) {
  try {
    if (!isSupabaseConfigured()) {
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

    const { code } = await context.params
    const normalizedCode = decodeURIComponent(code).trim().toUpperCase()

    let rawBody: unknown = {}
    try {
      rawBody = await request.json()
    } catch {
      // Allow empty body defaulting to delta_minutes: 5
    }

    const parsed = UpdateEtaSchema.safeParse(rawBody)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid ETA update' },
        { status: 400 }
      )
    }

    const db = getDbAdminClient() ?? supabase
    const { data: orderData, error: fetchErr } = await db
      .from('orders')
      .select('*')
      .ilike('code', normalizedCode)
      .maybeSingle()

    if (fetchErr || !orderData) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    const order = orderData as Order
    if (order.user_id !== user.id) {
      return NextResponse.json(
        { error: 'You do not have permission to update this order' },
        { status: 403 }
      )
    }

    if (!['placed', 'awaiting_cash', 'accepted'].includes(order.status)) {
      return NextResponse.json(
        {
          error: `Cannot update ETA once order is "${order.status}"`,
        },
        { status: 409 }
      )
    }

    const delta = parsed.data.delta_minutes
    const currentArriveMs = order.arrive_at
      ? Math.max(Date.now(), new Date(order.arrive_at).getTime())
      : Date.now()
    const nextArriveAt = new Date(currentArriveMs + delta * 60_000).toISOString()
    const nextEtaMinutes = Math.min(120, (order.eta_minutes ?? 10) + delta)

    const { error: updateErr } = await db
      .from('orders')
      .update({
        eta_minutes: nextEtaMinutes,
        arrive_at: nextArriveAt,
      })
      .eq('id', order.id)

    if (updateErr) {
      return NextResponse.json(
        { error: updateErr.message || 'Failed to update ETA' },
        { status: 500 }
      )
    }

    const { error: prioErr } = await db.rpc('recompute_priority', {
      p_order_id: order.id,
    })
    if (prioErr) {
      const fallbackScore =
        new Date(nextArriveAt).getTime() / 60000 - (order.is_faculty ? 5 : 0)
      await db
        .from('orders')
        .update({ priority_score: fallbackScore })
        .eq('id', order.id)
    }

    const { data: refreshed } = await db
      .from('orders')
      .select('code, eta_minutes, arrive_at, priority_score')
      .eq('id', order.id)
      .maybeSingle()

    return NextResponse.json(
      refreshed ?? {
        code: order.code,
        eta_minutes: nextEtaMinutes,
        arrive_at: nextArriveAt,
      }
    )
  } catch (err) {
    console.error('Update ETA error:', err)
    return NextResponse.json(
      { error: 'Unexpected error updating ETA' },
      { status: 500 }
    )
  }
}
