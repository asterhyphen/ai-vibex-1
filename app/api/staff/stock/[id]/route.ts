import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticatedProfile, writeAuditLog } from '@/lib/utils/server-auth'
import { StockUpdateSchema } from '@/lib/validators/staff'

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuthenticatedProfile(['shopkeeper', 'admin'])
  if (!auth.ok) return auth.response

  const { id } = await context.params
  if (!id) {
    return NextResponse.json({ error: 'Menu item ID is required' }, { status: 400 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 })
  }

  const parsed = StockUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Invalid stock payload' },
      { status: 400 }
    )
  }

  const { in_stock, back_at } = parsed.data
  const { db, user } = auth

  const { data: existing, error: fetchError } = await db
    .from('menu_items')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (fetchError || !existing) {
    return NextResponse.json({ error: 'Menu item not found' }, { status: 404 })
  }

  const currentTags = Array.isArray(existing.tags) ? (existing.tags as string[]) : []
  const cleanedTags = currentTags.filter((tag) => !tag.startsWith('back_at:'))
  if (!in_stock && back_at && back_at.trim().length > 0) {
    cleanedTags.push(`back_at:${back_at.trim()}`)
  }

  const { data: updated, error: updateError } = await db
    .from('menu_items')
    .update({
      in_stock,
      tags: cleanedTags,
    })
    .eq('id', id)
    .select('*, category:categories(*)')
    .single()

  if (updateError || !updated) {
    return NextResponse.json(
      { error: updateError?.message || 'Failed to update stock status' },
      { status: 500 }
    )
  }

  await writeAuditLog(db, {
    actorId: user.id,
    action: 'stock_update',
    tableName: 'menu_items',
    rowId: id,
    diff: {
      name: existing.name,
      in_stock_from: existing.in_stock,
      in_stock_to: in_stock,
      back_at: back_at || null,
    },
  })

  return NextResponse.json({ item: updated })
}
