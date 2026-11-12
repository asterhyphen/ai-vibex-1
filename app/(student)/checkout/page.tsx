import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { PickupSlot } from '@/lib/types'
import { CheckoutClient } from './CheckoutClient'

function CheckoutSkeleton() {
  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <div className="h-16 border-b border-[var(--border)] bg-[var(--surface)]" />
      <div className="mx-auto max-w-3xl space-y-5 px-4 pt-6 sm:px-6">
        <div className="h-20 animate-pulse rounded-2xl border border-[var(--border)] bg-[var(--surface)]" />
        <div className="h-80 animate-pulse rounded-3xl border border-[var(--border)] bg-[var(--surface)]" />
      </div>
    </div>
  )
}

async function CheckoutContent() {
  const hasSupabaseEnv = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  if (!hasSupabaseEnv) {
    return <CheckoutClient initialSlots={[]} showingAfterHoursFallback={false} />
  }

  const supabase = await createClient()
  const nowIso = new Date().toISOString()

  // Fetch upcoming slots first
  const { data: upcomingData } = await supabase
    .from('pickup_slots')
    .select('*')
    .gte('slot_end', nowIso)
    .order('slot_start', { ascending: true })
    .limit(36)

  const upcomingSlots = (upcomingData as PickupSlot[] | null) ?? []
  if (upcomingSlots.length > 0) {
    return (
      <CheckoutClient
        initialSlots={upcomingSlots}
        showingAfterHoursFallback={false}
      />
    )
  }

  // Fallback for after-hours testing with seeded today slots
  const { data: allSlotsData } = await supabase
    .from('pickup_slots')
    .select('*')
    .order('slot_start', { ascending: true })
    .limit(36)

  const allSlots = (allSlotsData as PickupSlot[] | null) ?? []
  return (
    <CheckoutClient
      initialSlots={allSlots}
      showingAfterHoursFallback={allSlots.length > 0}
    />
  )
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<CheckoutSkeleton />}>
      <CheckoutContent />
    </Suspense>
  )
}
