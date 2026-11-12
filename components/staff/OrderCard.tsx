'use client'

import { motion } from 'framer-motion'
import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  Clock,
  Flame,
  QrCode,
  StickyNote,
  XCircle,
  Zap,
} from 'lucide-react'
import type { OrderWithItems } from '@/lib/types'
import { formatPaise } from '@/lib/utils/format'

interface OrderCardProps {
  order: OrderWithItems
  nowMs: number
  busy?: boolean
  onCollectCash: (order: OrderWithItems) => void
  onStatusAction: (
    order: OrderWithItems,
    action: 'accept' | 'start_preparing' | 'ready'
  ) => void
  onRejectClick: (order: OrderWithItems) => void
  onOpenScanner: (order: OrderWithItems) => void
}

function getArrivalMeta(order: OrderWithItems, nowMs: number) {
  if (!order.arrive_at) {
    return {
      label: order.eta_minutes ? `in ${order.eta_minutes} min` : 'Walk-in',
      isOverdue: false,
      diffMin: order.eta_minutes ?? 5,
    }
  }
  const arriveMs = new Date(order.arrive_at).getTime()
  const diffMin = Math.ceil((arriveMs - nowMs) / 60_000)
  if (diffMin < 0) {
    return {
      label: 'OVERDUE',
      isOverdue: true,
      diffMin,
    }
  }
  if (diffMin === 0) {
    return {
      label: 'Due now',
      isOverdue: false,
      diffMin: 0,
    }
  }
  return {
    label: `in ${diffMin} min`,
    isOverdue: false,
    diffMin,
  }
}

function getPriorityReason(
  order: OrderWithItems,
  diffMin: number,
  nowMs: number
): string | null {
  const waitMin = Math.floor((nowMs - new Date(order.created_at).getTime()) / 60_000)
  if (waitMin >= 15 && order.status !== 'ready') {
    return 'Waiting >15m · Boosted'
  }
  if (diffMin <= 5 && diffMin >= 0) {
    return `Arriving in ${Math.max(1, diffMin)} min`
  }
  if (diffMin < 0) {
    return `Late by ${Math.abs(diffMin)} min`
  }
  if (order.is_faculty) {
    return 'Faculty Priority'
  }
  if (order.priority_score !== null) {
    return `Score ${Math.round(order.priority_score)}`
  }
  return null
}

export function OrderCard({
  order,
  nowMs,
  busy = false,
  onCollectCash,
  onStatusAction,
  onRejectClick,
  onOpenScanner,
}: OrderCardProps) {
  const { label: countdownLabel, isOverdue, diffMin } = getArrivalMeta(order, nowMs)
  const priorityReason = getPriorityReason(order, diffMin, nowMs)
  const isCashAwaiting = order.status === 'awaiting_cash'
  const showOverduePulse = isOverdue && order.status !== 'collected'

  return (
    <motion.article
      layout
      initial={{ opacity: 0, x: 48 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, scale: 0.94 }}
      transition={{ type: 'spring', stiffness: 320, damping: 28 }}
      className={`rounded-2xl border-2 bg-[var(--surface)] p-4 shadow-sm transition-colors ${
        showOverduePulse
          ? 'animate-[overduePulse_1.4s_ease-in-out_infinite] border-[var(--danger)]'
          : 'border-[var(--border)]'
      }`}
    >
      <style jsx>{`
        @keyframes overduePulse {
          0%,
          100% {
            border-color: var(--danger);
            box-shadow: 0 0 0 0 rgba(179, 38, 30, 0.35);
          }
          50% {
            border-color: var(--danger);
            box-shadow: 0 0 0 6px rgba(179, 38, 30, 0);
          }
        }
      `}</style>

      {/* Top row: Order code + Countdown */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-2xl font-black tracking-tight text-[var(--text)] tabular-nums">
              {order.code}
            </span>
            {order.source === 'guest' && (
              <span className="rounded-lg bg-[var(--surface-2)] px-2 py-0.5 text-xs font-bold text-[var(--text-muted)]">
                Walk-in{order.guest_name ? ` · ${order.guest_name}` : ''}
              </span>
            )}
          </div>
        </div>

        <span
          className={`inline-flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-extrabold tabular-nums ${
            isOverdue
              ? 'bg-[var(--danger)] text-white'
              : diffMin <= 5
                ? 'bg-[var(--warning)]/20 text-[var(--warning)]'
                : 'bg-[var(--surface-2)] text-[var(--text-muted)]'
          }`}
        >
          {isOverdue ? (
            <AlertTriangle className="h-3.5 w-3.5" />
          ) : (
            <Clock className="h-3.5 w-3.5" />
          )}
          {countdownLabel}
        </span>
      </div>

      {/* Chips row: Priority + Faculty + Payment */}
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        {priorityReason && (
          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--accent)]/15 px-2.5 py-0.5 text-xs font-bold text-[var(--accent)]">
            <Zap className="h-3 w-3 fill-current" />
            {priorityReason}
          </span>
        )}

        {order.is_faculty && (
          <span className="inline-flex items-center rounded-full bg-purple-600/15 px-2.5 py-0.5 text-xs font-bold text-purple-600 dark:bg-purple-400/20 dark:text-purple-300">
            Faculty
          </span>
        )}

        {order.payment_status === 'paid' && order.payment_method === 'online' ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--success)]/15 px-2.5 py-0.5 text-xs font-bold text-[var(--success)]">
            Online ✓ Paid
          </span>
        ) : order.payment_status === 'paid' ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--success)]/15 px-2.5 py-0.5 text-xs font-bold text-[var(--success)]">
            💵 Cash ✓ Paid
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--warning)]/20 px-2.5 py-0.5 text-xs font-bold text-[var(--warning)]">
            💵 Cash
          </span>
        )}
      </div>

      {/* Items List */}
      <ul className="mt-3 space-y-1.5 rounded-xl bg-[var(--surface-2)] p-3">
        {(order.order_items ?? []).map((item) => (
          <li
            key={item.id}
            className="flex items-center justify-between gap-2 text-sm font-semibold text-[var(--text)]"
          >
            <span className="flex items-center gap-2">
              <span className="inline-flex h-6 min-w-[24px] items-center justify-center rounded-md bg-[var(--primary-soft)] px-1.5 text-xs font-extrabold text-[var(--primary)] tabular-nums">
                {item.qty}×
              </span>
              <span>{item.name_snapshot}</span>
            </span>
            <span className="text-xs font-medium text-[var(--text-muted)] tabular-nums">
              {formatPaise(item.unit_price_paise * item.qty)}
            </span>
          </li>
        ))}
        <li className="flex items-center justify-between border-t border-[var(--border)] pt-1.5 text-xs font-bold text-[var(--text-muted)]">
          <span>Order Total</span>
          <span className="text-sm font-extrabold text-[var(--text)] tabular-nums">
            {formatPaise(order.total_paise)}
          </span>
        </li>
      </ul>

      {/* Optional Note */}
      {order.note && (
        <div className="mt-2.5 flex items-start gap-2 rounded-xl border border-[var(--warning)]/40 bg-[var(--warning)]/10 px-3 py-2 text-xs font-medium text-[var(--text)]">
          <StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--warning)]" />
          <span>{order.note}</span>
        </div>
      )}

      {/* Action Buttons (min 48px touch target) */}
      <div className="mt-3.5 flex items-center gap-2">
        {isCashAwaiting && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onCollectCash(order)}
            className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--warning)] px-4 text-sm font-extrabold text-white shadow-sm transition-transform active:scale-[0.98] hover:opacity-90 disabled:opacity-50 cursor-pointer"
          >
            <Banknote className="h-4 w-4" />
            <span>Collect Cash →</span>
          </button>
        )}

        {order.status === 'placed' && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onStatusAction(order, 'accept')}
            className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 text-sm font-extrabold text-white shadow-sm transition-transform active:scale-[0.98] hover:bg-[var(--primary-hover)] disabled:opacity-50 cursor-pointer"
          >
            <CheckCircle2 className="h-4 w-4" />
            <span>Accept</span>
          </button>
        )}

        {order.status === 'accepted' && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onStatusAction(order, 'start_preparing')}
            className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 text-sm font-extrabold text-white shadow-sm transition-transform active:scale-[0.98] hover:opacity-90 disabled:opacity-50 cursor-pointer"
          >
            <Flame className="h-4 w-4" />
            <span>Start Cooking</span>
          </button>
        )}

        {order.status === 'preparing' && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onStatusAction(order, 'ready')}
            className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--success)] px-4 text-sm font-extrabold text-white shadow-sm transition-transform active:scale-[0.98] hover:opacity-90 disabled:opacity-50 cursor-pointer"
          >
            <CheckCircle2 className="h-4 w-4" />
            <span>Mark Ready</span>
          </button>
        )}

        {order.status === 'ready' && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onOpenScanner(order)}
            className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl border-2 border-[var(--success)] bg-[var(--success)]/15 px-4 text-sm font-extrabold text-[var(--success)] transition-transform active:scale-[0.98] hover:bg-[var(--success)] hover:text-white disabled:opacity-50 cursor-pointer"
          >
            <QrCode className="h-4 w-4" />
            <span>Scan QR / Handover</span>
          </button>
        )}

        {order.status !== 'ready' && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onRejectClick(order)}
            title="Reject order"
            aria-label={`Reject order ${order.code}`}
            className="inline-flex min-h-[48px] min-w-[48px] items-center justify-center gap-1 rounded-xl border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 text-xs font-bold text-[var(--danger)] transition-colors hover:bg-[var(--danger)] hover:text-white disabled:opacity-50 cursor-pointer"
          >
            <XCircle className="h-4 w-4" />
            <span>Reject</span>
          </button>
        )}
      </div>
    </motion.article>
  )
}
