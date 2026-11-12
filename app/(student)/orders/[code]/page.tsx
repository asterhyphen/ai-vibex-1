import { Suspense } from 'react'
import Link from 'next/link'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { createClient } from '@/lib/supabase/server'
import type { OrderWithItems } from '@/lib/types'
import { OrderTrackingClient } from './OrderTrackingClient'

function OrderSkeleton() {
  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <div className="h-16 border-b border-[var(--border)] bg-[var(--surface)]" />
      <div className="mx-auto max-w-2xl space-y-5 px-4 pt-6 sm:px-6">
        <div className="h-36 animate-pulse rounded-3xl border border-[var(--border)] bg-[var(--surface)]" />
        <div className="h-72 animate-pulse rounded-3xl border border-[var(--border)] bg-[var(--surface)]" />
        <div className="h-64 animate-pulse rounded-3xl border border-[var(--border)] bg-[var(--surface)]" />
      </div>
    </div>
  )
}

async function OrderTrackingContent({
  params,
}: {
  params: Promise<{ code: string }>
}) {
  const { code } = await params
  const normalizedCode = decodeURIComponent(code).trim().toUpperCase()

  if (!isSupabaseConfigured()) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--bg)] px-4 text-center">
        <div className="max-w-md rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-8">
          <h1 className="text-xl font-bold text-[var(--text)]">
            Order #{normalizedCode}
          </h1>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Supabase is not configured yet. Connect Supabase credentials to view live order tracking.
          </p>
          <Link
            href="/home"
            className="mt-5 inline-flex h-11 min-h-[44px] items-center rounded-xl bg-[var(--primary)] px-5 text-sm font-semibold text-white"
          >
            Back to home
          </Link>
        </div>
      </div>
    )
  }

  const supabase = await createClient()
  const { data } = await supabase
    .from('orders')
    .select('*, order_items(*), pickup_slot:pickup_slots(*)')
    .eq('code', normalizedCode)
    .maybeSingle()

  if (!data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--bg)] px-4 text-center">
        <div className="max-w-md rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-8 shadow-sm">
          <h1 className="text-xl font-bold text-[var(--text)]">Order not found</h1>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            We couldn&apos;t find order <span className="font-mono font-bold">#{normalizedCode}</span> under your account.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link
              href="/history"
              className="inline-flex h-11 min-h-[44px] items-center rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 text-sm font-semibold text-[var(--text)]"
            >
              Order History
            </Link>
            <Link
              href="/home"
              className="inline-flex h-11 min-h-[44px] items-center rounded-xl bg-[var(--primary)] px-5 text-sm font-semibold text-white"
            >
              Back to home
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return <OrderTrackingClient initialOrder={data as OrderWithItems} />
}

export default function OrderTrackingPage({
  params,
}: {
  params: Promise<{ code: string }>
}) {
  return (
    <Suspense fallback={<OrderSkeleton />}>
      <OrderTrackingContent params={params} />
    </Suspense>
  )
}
