'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, LayoutGroup } from 'framer-motion'
import {
  AlertTriangle,
  CheckCircle2,
  Flame,
  Inbox,
  Loader2,
  PackageX,
  RefreshCw,
} from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import type { Category, MenuItem, OrderWithItems, PickupSlot } from '@/lib/types'
import { StaffHeader } from '@/components/staff/StaffHeader'
import { SlotHeatmap } from '@/components/staff/SlotHeatmap'
import { OrderCard } from '@/components/staff/OrderCard'
import { CashModal } from '@/components/staff/CashModal'
import { QrScannerModal } from '@/components/staff/QrScannerModal'
import { GuestPosModal } from '@/components/staff/GuestPosModal'
import { RejectModal } from '@/components/staff/RejectModal'

function playNewOrderChime() {
  if (typeof window === 'undefined') return
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioCtx) return

  try {
    const ctx = new AudioCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = 'sine'
    osc.frequency.setValueAtTime(440, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(554.37, ctx.currentTime + 0.14)

    gain.gain.setValueAtTime(0.001, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.03)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35)

    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.36)
    osc.onended = () => {
      ctx.close().catch(() => {})
    }
  } catch {
    // Browser autoplay policies may block sound before first user gesture
  }
}

export default function KitchenBoardPage() {
  const [orders, setOrders] = useState<OrderWithItems[]>([])
  const [slots, setSlots] = useState<PickupSlot[]>([])
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [staffName, setStaffName] = useState<string>('Kitchen Staff')
  const [loading, setLoading] = useState(true)
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [nowMs, setNowMs] = useState<number>(() => Date.now())

  // Modals
  const [cashOrder, setCashOrder] = useState<OrderWithItems | null>(null)
  const [rejectOrder, setRejectOrder] = useState<OrderWithItems | null>(null)
  const [rejectSubmitting, setRejectSubmitting] = useState(false)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [scannerInitialCode, setScannerInitialCode] = useState('')
  const [posOpen, setPosOpen] = useState(false)

  const soundRef = useRef(soundEnabled)
  useEffect(() => {
    soundRef.current = soundEnabled
  }, [soundEnabled])

  const fetchBoard = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const res = await fetch('/api/staff/board', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) {
        if (!silent) toast.error(data.error || 'Failed to load kitchen board')
        return
      }
      setOrders(data.orders ?? [])
      setSlots(data.slots ?? [])
      setMenuItems(data.menuItems ?? [])
      setCategories(data.categories ?? [])
      if (data.staffName) setStaffName(data.staffName)
    } catch {
      if (!silent) toast.error('Network error loading kitchen board')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    fetch('/api/staff/board', { cache: 'no-store' })
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (cancelled) return
        if (!ok) {
          toast.error(data.error || 'Failed to load kitchen board')
          return
        }
        setOrders(data.orders ?? [])
        setSlots(data.slots ?? [])
        setMenuItems(data.menuItems ?? [])
        setCategories(data.categories ?? [])
        if (data.staffName) setStaffName(data.staffName)
      })
      .catch(() => {
        if (!cancelled) toast.error('Network error loading kitchen board')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Refresh countdowns every 15s
  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 15_000)
    return () => clearInterval(timer)
  }, [])

  // Realtime Supabase subscription
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return
    }
    const supabase = createClient()
    const channel = supabase
      .channel('staff-kitchen-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            if (soundRef.current) {
              playNewOrderChime()
            }
            const newCode = (payload.new as { code?: string })?.code
            if (newCode) {
              toast.info(`New order arrived: ${newCode}`)
            }
          }
          fetchBoard(true)
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'pickup_slots' },
        () => fetchBoard(true)
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'menu_items' },
        () => fetchBoard(true)
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchBoard])

  const handleStatusAction = async (
    order: OrderWithItems,
    action: 'accept' | 'start_preparing' | 'ready'
  ) => {
    setBusyOrderId(order.id)
    try {
      const res = await fetch(`/api/staff/orders/${order.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Could not update order')
        return
      }
      setOrders((prev) =>
        prev.map((o) => (o.id === order.id ? (data.order as OrderWithItems) : o))
      )
      const labels: Record<typeof action, string> = {
        accept: `${order.code} accepted`,
        start_preparing: `${order.code} moved to cooking`,
        ready: `${order.code} marked Ready · customer notified 🎉`,
      }
      toast.success(labels[action])
    } catch {
      toast.error('Network error updating order status')
    } finally {
      setBusyOrderId(null)
    }
  }

  const handleConfirmReject = async (reason: string) => {
    if (!rejectOrder) return
    setRejectSubmitting(true)
    try {
      const res = await fetch(`/api/staff/orders/${rejectOrder.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', reason }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Failed to reject order')
        return
      }
      setOrders((prev) => prev.filter((o) => o.id !== rejectOrder.id))
      toast.success(`Order ${rejectOrder.code} rejected`)
      setRejectOrder(null)
    } catch {
      toast.error('Network error rejecting order')
    } finally {
      setRejectSubmitting(false)
    }
  }

  // Partition into 3 Kanban columns
  const incomingOrders = useMemo(
    () =>
      orders
        .filter((o) => o.status === 'placed' || o.status === 'awaiting_cash')
        .sort(
          (a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        ),
    [orders]
  )

  const cookingOrders = useMemo(
    () =>
      orders
        .filter((o) => o.status === 'accepted' || o.status === 'preparing')
        .sort((a, b) => {
          const scoreA = a.priority_score ?? Number.MAX_SAFE_INTEGER
          const scoreB = b.priority_score ?? Number.MAX_SAFE_INTEGER
          if (scoreA !== scoreB) return scoreA - scoreB
          const arrA = a.arrive_at ? new Date(a.arrive_at).getTime() : 0
          const arrB = b.arrive_at ? new Date(b.arrive_at).getTime() : 0
          return arrA - arrB
        }),
    [orders]
  )

  const readyOrders = useMemo(
    () =>
      orders
        .filter((o) => o.status === 'ready')
        .sort(
          (a, b) =>
            new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        ),
    [orders]
  )

  // Operational alerts
  const alerts = useMemo(() => {
    const overdueCount = orders.filter(
      (o) =>
        o.status !== 'ready' &&
        o.arrive_at &&
        new Date(o.arrive_at).getTime() < nowMs
    ).length

    const overloadedSlots = slots.filter(
      (s) => s.capacity_units > 0 && s.used_units / s.capacity_units >= 0.8
    )

    const outOfStockItems = menuItems.filter((m) => !m.in_stock)

    return { overdueCount, overloadedSlots, outOfStockItems }
  }, [orders, slots, menuItems, nowMs])

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <StaffHeader
        staffName={staffName}
        soundEnabled={soundEnabled}
        onToggleSound={() => setSoundEnabled((prev) => !prev)}
        onOpenScanner={() => {
          setScannerInitialCode('')
          setScannerOpen(true)
        }}
        onOpenGuestPos={() => setPosOpen(true)}
      />

      <main className="mx-auto max-w-[1600px] space-y-4 px-4 py-4 sm:px-6">
        {/* Slot Heatmap Widget */}
        <SlotHeatmap slots={slots} nowMs={nowMs} />

        {/* Alert Banner Area */}
        {(alerts.overdueCount > 0 ||
          alerts.overloadedSlots.length > 0 ||
          alerts.outOfStockItems.length > 0) && (
          <div className="flex flex-wrap items-center gap-2.5">
            {alerts.overdueCount > 0 && (
              <div className="flex items-center gap-2 rounded-xl border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3.5 py-2 text-xs font-bold text-[var(--danger)]">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>
                  {alerts.overdueCount} late order
                  {alerts.overdueCount === 1 ? '' : 's'} past arrival ETA
                </span>
              </div>
            )}

            {alerts.overloadedSlots.length > 0 && (
              <div className="flex items-center gap-2 rounded-xl border border-[var(--warning)]/40 bg-[var(--warning)]/12 px-3.5 py-2 text-xs font-bold text-[var(--warning)]">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>
                  {alerts.overloadedSlots.length} slot
                  {alerts.overloadedSlots.length === 1 ? '' : 's'} &ge; 80% capacity
                </span>
              </div>
            )}

            {alerts.outOfStockItems.length > 0 && (
              <Link
                href="/staff/stock"
                className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2 text-xs font-bold text-[var(--text)] hover:border-[var(--primary)]"
              >
                <PackageX className="h-4 w-4 text-[var(--warning)]" />
                <span>
                  {alerts.outOfStockItems.length} item
                  {alerts.outOfStockItems.length === 1 ? '' : 's'} out of stock (
                  {alerts.outOfStockItems
                    .slice(0, 2)
                    .map((i) => i.name)
                    .join(', ')}
                  {alerts.outOfStockItems.length > 2 ? '…' : ''})
                </span>
              </Link>
            )}

            <button
              type="button"
              onClick={() => fetchBoard()}
              className="ml-auto inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-xs font-bold text-[var(--text-muted)] hover:text-[var(--text)] cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Refresh</span>
            </button>
          </div>
        )}

        {/* 3-Column Kanban Board */}
        {loading ? (
          <div className="flex min-h-[420px] items-center justify-center rounded-3xl border border-[var(--border)] bg-[var(--surface)]">
            <div className="flex flex-col items-center gap-3 text-[var(--text-muted)]">
              <Loader2 className="h-8 w-8 animate-spin text-[var(--primary)]" />
              <span className="text-sm font-semibold">Loading live kitchen queue...</span>
            </div>
          </div>
        ) : (
          <LayoutGroup>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              {/* Column 1: Incoming */}
              <section className="flex flex-col rounded-3xl border border-[var(--border)] bg-[var(--surface-2)]/60 p-4">
                <header className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)]">
                      <Inbox className="h-4 w-4" />
                    </span>
                    <div>
                      <h2 className="text-base font-extrabold text-[var(--text)]">
                        Incoming
                      </h2>
                      <p className="text-[11px] font-medium text-[var(--text-muted)]">
                        Needs cash check or accept
                      </p>
                    </div>
                  </div>
                  <span className="inline-flex h-8 min-w-[32px] items-center justify-center rounded-full bg-[var(--primary)] px-2.5 text-sm font-black text-white tabular-nums">
                    {incomingOrders.length}
                  </span>
                </header>

                <div className="space-y-3">
                  <AnimatePresence initial={false}>
                    {incomingOrders.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-[var(--border)] py-12 text-center text-sm font-medium text-[var(--text-muted)]">
                        No incoming orders right now
                      </div>
                    ) : (
                      incomingOrders.map((order) => (
                        <OrderCard
                          key={order.id}
                          order={order}
                          nowMs={nowMs}
                          busy={busyOrderId === order.id}
                          onCollectCash={(o) => setCashOrder(o)}
                          onStatusAction={handleStatusAction}
                          onRejectClick={(o) => setRejectOrder(o)}
                          onOpenScanner={(o) => {
                            setScannerInitialCode(o.code)
                            setScannerOpen(true)
                          }}
                        />
                      ))
                    )}
                  </AnimatePresence>
                </div>
              </section>

              {/* Column 2: Cooking (priority_score ASC) */}
              <section className="flex flex-col rounded-3xl border border-[var(--border)] bg-[var(--surface-2)]/60 p-4">
                <header className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--accent)]/20 text-[var(--accent)]">
                      <Flame className="h-4 w-4" />
                    </span>
                    <div>
                      <h2 className="text-base font-extrabold text-[var(--text)]">
                        Cooking
                      </h2>
                      <p className="text-[11px] font-medium text-[var(--text-muted)]">
                        Auto-sorted by priority score
                      </p>
                    </div>
                  </div>
                  <span className="inline-flex h-8 min-w-[32px] items-center justify-center rounded-full bg-[var(--accent)] px-2.5 text-sm font-black text-white tabular-nums">
                    {cookingOrders.length}
                  </span>
                </header>

                <div className="space-y-3">
                  <AnimatePresence initial={false}>
                    {cookingOrders.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-[var(--border)] py-12 text-center text-sm font-medium text-[var(--text-muted)]">
                        Kitchen line is clear
                      </div>
                    ) : (
                      cookingOrders.map((order) => (
                        <OrderCard
                          key={order.id}
                          order={order}
                          nowMs={nowMs}
                          busy={busyOrderId === order.id}
                          onCollectCash={(o) => setCashOrder(o)}
                          onStatusAction={handleStatusAction}
                          onRejectClick={(o) => setRejectOrder(o)}
                          onOpenScanner={(o) => {
                            setScannerInitialCode(o.code)
                            setScannerOpen(true)
                          }}
                        />
                      ))
                    )}
                  </AnimatePresence>
                </div>
              </section>

              {/* Column 3: Ready */}
              <section className="flex flex-col rounded-3xl border border-[var(--border)] bg-[var(--surface-2)]/60 p-4">
                <header className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--success)]/20 text-[var(--success)]">
                      <CheckCircle2 className="h-4 w-4" />
                    </span>
                    <div>
                      <h2 className="text-base font-extrabold text-[var(--text)]">
                        Ready
                      </h2>
                      <p className="text-[11px] font-medium text-[var(--text-muted)]">
                        Waiting for QR collection
                      </p>
                    </div>
                  </div>
                  <span className="inline-flex h-8 min-w-[32px] items-center justify-center rounded-full bg-[var(--success)] px-2.5 text-sm font-black text-white tabular-nums">
                    {readyOrders.length}
                  </span>
                </header>

                <div className="space-y-3">
                  <AnimatePresence initial={false}>
                    {readyOrders.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-[var(--border)] py-12 text-center text-sm font-medium text-[var(--text-muted)]">
                        No orders awaiting pickup
                      </div>
                    ) : (
                      readyOrders.map((order) => (
                        <OrderCard
                          key={order.id}
                          order={order}
                          nowMs={nowMs}
                          busy={busyOrderId === order.id}
                          onCollectCash={(o) => setCashOrder(o)}
                          onStatusAction={handleStatusAction}
                          onRejectClick={(o) => setRejectOrder(o)}
                          onOpenScanner={(o) => {
                            setScannerInitialCode(o.code)
                            setScannerOpen(true)
                          }}
                        />
                      ))
                    )}
                  </AnimatePresence>
                </div>
              </section>
            </div>
          </LayoutGroup>
        )}
      </main>

      {/* Modals */}
      <CashModal
        order={cashOrder}
        onClose={() => setCashOrder(null)}
        onCollected={(updatedOrder) => {
          setOrders((prev) =>
            prev.map((o) => (o.id === updatedOrder.id ? updatedOrder : o))
          )
        }}
      />

      <QrScannerModal
        open={scannerOpen}
        kind="order"
        initialCode={scannerInitialCode}
        onClose={() => setScannerOpen(false)}
        onCollected={({ id }) => {
          if (id) {
            setOrders((prev) => prev.filter((o) => o.id !== id))
          } else {
            fetchBoard(true)
          }
        }}
      />

      <GuestPosModal
        open={posOpen}
        menuItems={menuItems}
        categories={categories}
        onClose={() => setPosOpen(false)}
        onOrderCreated={() => fetchBoard(true)}
      />

      <RejectModal
        open={Boolean(rejectOrder)}
        title={rejectOrder ? `Reject Order ${rejectOrder.code}` : 'Reject Order'}
        submitting={rejectSubmitting}
        onClose={() => setRejectOrder(null)}
        onConfirm={handleConfirmReject}
      />
    </div>
  )
}
