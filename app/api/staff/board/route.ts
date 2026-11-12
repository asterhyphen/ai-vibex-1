import { NextResponse } from 'next/server'
import { requireAuthenticatedProfile } from '@/lib/utils/server-auth'

export async function GET() {
  const auth = await requireAuthenticatedProfile(['shopkeeper', 'admin'])
  if (!auth.ok) return auth.response

  const { db, user, profile } = auth

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date()
  todayEnd.setHours(23, 59, 59, 999)

  const [ordersRes, slotsRes, menuRes, categoriesRes, staffRes] = await Promise.all([
    db
      .from('orders')
      .select('*, order_items(*), pickup_slot:pickup_slots(*)')
      .in('status', ['placed', 'awaiting_cash', 'accepted', 'preparing', 'ready'])
      .order('created_at', { ascending: true }),
    db
      .from('pickup_slots')
      .select('*')
      .gte('slot_start', todayStart.toISOString())
      .lte('slot_start', todayEnd.toISOString())
      .order('slot_start', { ascending: true }),
    db
      .from('menu_items')
      .select('*, category:categories(*)')
      .eq('is_active', true)
      .order('name', { ascending: true }),
    db.from('categories').select('*').order('sort_order', { ascending: true }),
    db
      .from('staff_accounts')
      .select('display_name, counter')
      .eq('user_id', user.id)
      .maybeSingle(),
  ])

  if (ordersRes.error) {
    return NextResponse.json(
      { error: ordersRes.error.message || 'Failed to load orders' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    orders: ordersRes.data ?? [],
    slots: slotsRes.data ?? [],
    menuItems: menuRes.data ?? [],
    categories: categoriesRes.data ?? [],
    staffName:
      staffRes.data?.display_name ||
      profile.full_name ||
      user.email?.split('@')[0] ||
      'Kitchen Staff',
    counter: staffRes.data?.counter ?? 'canteen',
  })
}
