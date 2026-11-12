import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { Category, MenuItem, Notification, OrderWithItems, Profile } from '@/lib/types'
import { HomeClient } from './HomeClient'

function HomeSkeleton() {
  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <div className="h-[68px] border-b border-[var(--border)] bg-[var(--surface)]/80" />
      <div className="mx-auto max-w-6xl space-y-5 px-4 pt-6 sm:px-6">
        <div className="h-16 animate-pulse rounded-2xl border border-[var(--border)] bg-[var(--surface)]" />
        <div className="flex gap-2 overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-11 w-24 shrink-0 animate-pulse rounded-full bg-[var(--surface-2)]"
            />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-64 animate-pulse rounded-2xl border border-[var(--border)] bg-[var(--surface)]"
            />
          ))}
        </div>
      </div>
    </div>
  )
}

async function HomeContent() {
  const hasSupabaseEnv = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  if (!hasSupabaseEnv) {
    return (
      <HomeClient
        user={null}
        profile={null}
        categories={[]}
        menuItems={[]}
        activeOrder={null}
        notifications={[]}
      />
    )
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [categoriesRes, menuItemsRes] = await Promise.all([
    supabase.from('categories').select('*').order('sort_order', { ascending: true }),
    supabase
      .from('menu_items')
      .select('*')
      .eq('is_active', true)
      .order('name', { ascending: true }),
  ])

  let profile: Profile | null = null
  let activeOrder: OrderWithItems | null = null
  let notifications: Notification[] = []

  if (user) {
    const [profileRes, activeOrderRes, notificationsRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('user_id', user.id).maybeSingle(),
      supabase
        .from('orders')
        .select('*, order_items(*), pickup_slot:pickup_slots(*)')
        .eq('user_id', user.id)
        .in('status', ['placed', 'awaiting_cash', 'accepted', 'preparing', 'ready'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10),
    ])

    profile = (profileRes.data as Profile | null) ?? null
    activeOrder = (activeOrderRes.data as OrderWithItems | null) ?? null
    notifications = (notificationsRes.data as Notification[] | null) ?? []
  }

  return (
    <HomeClient
      user={user}
      profile={profile}
      categories={(categoriesRes.data as Category[] | null) ?? []}
      menuItems={(menuItemsRes.data as MenuItem[] | null) ?? []}
      activeOrder={activeOrder}
      notifications={notifications}
    />
  )
}

export default function HomePage() {
  return (
    <Suspense fallback={<HomeSkeleton />}>
      <HomeContent />
    </Suspense>
  )
}
