import { NextResponse } from 'next/server'
import { requireAuthenticatedProfile } from '@/lib/utils/server-auth'

export async function GET() {
  const auth = await requireAuthenticatedProfile(['shopkeeper', 'admin'])
  if (!auth.ok) return auth.response

  const { db } = auth

  const [itemsRes, categoriesRes] = await Promise.all([
    db
      .from('menu_items')
      .select('*, category:categories(*)')
      .order('name', { ascending: true }),
    db.from('categories').select('*').order('sort_order', { ascending: true }),
  ])

  if (itemsRes.error) {
    return NextResponse.json(
      { error: itemsRes.error.message || 'Failed to load stock items' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    items: itemsRes.data ?? [],
    categories: categoriesRes.data ?? [],
  })
}
