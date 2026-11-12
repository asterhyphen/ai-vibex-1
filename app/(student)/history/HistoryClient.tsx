'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  Clock,
  History,
  Loader2,
  RotateCcw,
  Utensils,
} from 'lucide-react'
import { toast } from 'sonner'
import type { MenuItem, OrderStatus, OrderWithItems } from '@/lib/types'
import { useCartStore } from '@/lib/stores/cart'
import { createClient } from '@/lib/supabase/client'
import { cn, formatPaise } from '@/lib/utils/format'

interface HistoryClientProps {
  orders: OrderWithItems[]
  menuItems: MenuItem[]
}

const STATUS_STYLES: Record<
  OrderStatus,
  { label: string; className: string }
> = {
  placed: { label: 'Placed', className: 'bg-[var(--info)]/15 text-[var(--info)]' },
  awaiting_cash: {
    label: 'Awaiting Cash',
    className: 'bg-[var(--warning)]/15 text-[var(--warning)]',
  },
  accepted: {
    label: 'Accepted',
    className: 'bg-[var(--primary-soft)] text-[var(--primary)]',
  },
  preparing: {
    label: 'Preparing',
    className: 'bg-[var(--accent)]/20 text-[var(--accent)]',
  },
  ready: { label: 'Ready', className: 'bg-[var(--success)] text-white' },
  collected: {
    label: 'Collected',
    className: 'bg-[var(--success)]/15 text-[var(--success)]',
  },
  cancelled: {
    label: 'Cancelled',
    className: 'bg-[var(--surface-2)] text-[var(--text-muted)]',
  },
  rejected: {
    label: 'Rejected',
    className: 'bg-[var(--danger)]/15 text-[var(--danger)]',
  },
}

function formatOrderDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

export function HistoryClient({ orders, menuItems }: HistoryClientProps) {
  const router = useRouter()
  const addItem = useCartStore((s) => s.addItem)
  const clearCart = useCartStore((s) => s.clearCart)
  const [reorderingOrderId, setReorderingOrderId] = useState<string | null>(null)

  const activeOrders = orders.filter((o) =>
    ['placed', 'awaiting_cash', 'accepted', 'preparing', 'ready'].includes(o.status)
  )
  const pastOrders = orders.filter((o) =>
    ['collected', 'cancelled', 'rejected'].includes(o.status)
  )

  const handleReorder = async (order: OrderWithItems) => {
    setReorderingOrderId(order.id)
    try {
      const requestedIds = order.order_items
        .map((line) => line.menu_item_id)
        .filter((id): id is string => Boolean(id))

      if (requestedIds.length === 0) {
        toast.error('Items from this order are no longer on the menu.')
        return
      }

      let liveItemsMap = new Map<string, MenuItem>(
        menuItems.map((m) => [m.id, m])
      )

      // Re-validate live stock from Supabase directly
      if (
        process.env.NEXT_PUBLIC_SUPABASE_URL &&
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      ) {
        const supabase = createClient()
        const { data } = await supabase
          .from('menu_items')
          .select('*')
          .in('id', requestedIds)
          .eq('is_active', true)

        if (data) {
          liveItemsMap = new Map((data as MenuItem[]).map((m) => [m.id, m]))
        }
      }

      const availableLines: { item: MenuItem; qty: number }[] = []
      const skippedNames: string[] = []

      for (const line of order.order_items) {
        const liveItem = line.menu_item_id
          ? liveItemsMap.get(line.menu_item_id)
          : undefined
        if (!liveItem || !liveItem.in_stock || liveItem.is_active === false) {
          skippedNames.push(line.name_snapshot)
          continue
        }
        availableLines.push({ item: liveItem, qty: line.qty })
      }

      if (availableLines.length === 0) {
        toast.error('None of the items in this order are currently in stock.')
        return
      }

      clearCart()
      for (const { item, qty } of availableLines) {
        addItem({
          menuItemId: item.id,
          name: item.name,
          price_paise: item.price_paise,
          prep_seconds: item.prep_seconds,
          qty,
        })
      }

      if (skippedNames.length > 0) {
        toast.warning(`Skipped out-of-stock: ${skippedNames.join(', ')}`)
      } else {
        toast.success(`Added ${availableLines.length} item(s) to your cart`)
      }

      router.push('/checkout')
    } catch {
      toast.error('Failed to validate stock for reorder')
    } finally {
      setReorderingOrderId(null)
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] pb-16">
      <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--bg)]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3.5 sm:px-6">
          <Link
            href="/home"
            className="inline-flex h-11 min-h-[44px] items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-2)]"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Menu</span>
          </Link>
          <h1 className="flex items-center gap-2 text-base font-bold text-[var(--text)] sm:text-lg">
            <History className="h-4 w-4 text-[var(--primary)]" />
            Order History
          </h1>
          <div className="w-16" aria-hidden="true" />
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-4 pt-6 sm:px-6">
        {/* Live orders banner if any */}
        {activeOrders.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Active Orders ({activeOrders.length})
            </h2>
            <div className="space-y-3">
              {activeOrders.map((order) => (
                <div
                  key={order.id}
                  className="flex flex-col gap-3 rounded-2xl border border-[var(--primary)]/30 bg-[var(--surface)] p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-base font-bold text-[var(--primary)]">
                        #{order.code}
                      </span>
                      <span
                        className={cn(
                          'rounded-full px-2.5 py-0.5 text-xs font-semibold',
                          STATUS_STYLES[order.status].className
                        )}
                      >
                        {STATUS_STYLES[order.status].label}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      {order.order_items.map((i) => `${i.qty}× ${i.name_snapshot}`).join(', ')}
                    </p>
                  </div>
                  <Link
                    href={`/orders/${order.code}`}
                    className="inline-flex h-11 min-h-[44px] shrink-0 items-center justify-center gap-1.5 rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-white hover:bg-[var(--primary-hover)]"
                  >
                    Track live
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Past Orders */}
        <section className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
            Past Orders ({pastOrders.length})
          </h2>

          {pastOrders.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-6 py-14 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--surface-2)] text-[var(--primary)]">
                <Utensils className="h-7 w-7" />
              </div>
              <h3 className="mt-4 text-base font-bold text-[var(--text)]">
                No past orders yet
              </h3>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                Once your orders are collected or completed, you can view and reorder them here in one tap.
              </p>
              <Link
                href="/home"
                className="mt-5 inline-flex h-11 min-h-[44px] items-center rounded-xl bg-[var(--primary)] px-5 text-sm font-semibold text-white hover:bg-[var(--primary-hover)]"
              >
                Explore Menu
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {pastOrders.map((order, idx) => {
                const badge = STATUS_STYLES[order.status]
                const isBusy = reorderingOrderId === order.id
                const itemsSummary = order.order_items
                  .map((i) => `${i.qty}× ${i.name_snapshot}`)
                  .join(', ')

                return (
                  <motion.article
                    key={order.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: Math.min(idx * 0.04, 0.25) }}
                    className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-xs sm:p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-base font-bold text-[var(--text)]">
                            #{order.code}
                          </span>
                          <span
                            className={cn(
                              'rounded-full px-2.5 py-0.5 text-xs font-semibold',
                              badge.className
                            )}
                          >
                            {badge.label}
                          </span>
                        </div>
                        <p className="mt-1 flex items-center gap-1 text-xs text-[var(--text-muted)]">
                          <Clock className="h-3 w-3" />
                          {formatOrderDate(order.created_at)}
                        </p>
                      </div>

                      <p className="text-lg font-bold text-[var(--text)]">
                        {formatPaise(order.total_paise)}
                      </p>
                    </div>

                    <p className="mt-3 text-sm text-[var(--text)]">
                      {itemsSummary || 'Order items'}
                    </p>

                    {order.rejected_reason && (
                      <p className="mt-2 rounded-xl bg-[var(--danger)]/10 px-3 py-1.5 text-xs text-[var(--danger)]">
                        Reason: {order.rejected_reason}
                      </p>
                    )}

                    <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-[var(--border)]/70 pt-3">
                      <Link
                        href={`/orders/${order.code}`}
                        className="inline-flex h-11 min-h-[44px] items-center rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 text-xs font-semibold text-[var(--text)] hover:bg-[var(--border)]/50 sm:text-sm"
                      >
                        Receipt
                      </Link>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleReorder(order)}
                        className="inline-flex h-11 min-h-[44px] cursor-pointer items-center gap-1.5 rounded-xl bg-[var(--primary)] px-4 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-[var(--primary-hover)] disabled:opacity-60 sm:text-sm"
                      >
                        {isBusy ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <RotateCcw className="h-4 w-4" />
                        )}
                        Reorder
                      </button>
                    </div>
                  </motion.article>
                )
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
