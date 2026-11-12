import { Suspense } from 'react'
import { connection } from 'next/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { createClient } from '@/lib/supabase/server'
import type { MenuItem, OrderWithItems } from '@/lib/types'
import { HistoryClient } from './HistoryClient'

function HistorySkeleton() {
  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <div className="h-16 border-b border-[var(--border)] bg-[var(--surface)]" />
      <div className="mx-auto max-w-3xl space-y-4 px-4 pt-6 sm:px-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-36 animate-pulse rounded-2xl border border-[var(--border)] bg-[var(--surface)]"
          />
        ))}
      </div>
    </div>
  )
}

async function HistoryContent() {
  await connection()
  if (!isSupabaseConfigured()) {
    return <HistoryClient orders={[]} menuItems={[]} />
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return <HistoryClient orders={[]} menuItems={[]} />
  }

  const [ordersRes, menuRes] = await Promise.all([
    supabase
      .from('orders')
      .select('*, order_items(*), pickup_slot:pickup_slots(*)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(40),
    supabase.from('menu_items').select('*').eq('is_active', true),
  ])

  return (
    <HistoryClient
      orders={(ordersRes.data as OrderWithItems[] | null) ?? []}
      menuItems={(menuRes.data as MenuItem[] | null) ?? []}
    />
  )
}

export default function HistoryPage() {
  return (
    <Suspense fallback={<HistorySkeleton />}>
      <HistoryContent />
    </Suspense>
  )
}
