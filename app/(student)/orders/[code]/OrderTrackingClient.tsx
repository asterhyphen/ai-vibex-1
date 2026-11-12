'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import QRCode from 'qrcode'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowLeft,
  Banknote,
  Check,
  ChefHat,
  Clock,
  Home,
  Loader2,
  PackageCheck,
  QrCode,
  RotateCw,
  Share2,
  Sparkles,
  Utensils,
  XCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import type { OrderStatus, OrderWithItems } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { cn, deriveOrderOtp, formatPaise, formatSlotTime } from '@/lib/utils/format'
import styles from './orders.module.css'

interface OrderTrackingClientProps {
  initialOrder: OrderWithItems
}

const STEPPER_STEPS: {
  key: 'placed' | 'accepted' | 'preparing' | 'ready' | 'collected'
  label: string
  description: string
  Icon: typeof Clock
}[] = [
  {
    key: 'placed',
    label: 'Placed',
    description: 'Order received by canteen',
    Icon: Clock,
  },
  {
    key: 'accepted',
    label: 'Accepted',
    description: 'Kitchen confirmed your ticket',
    Icon: Check,
  },
  {
    key: 'preparing',
    label: 'Preparing',
    description: 'Freshly cooking in kitchen',
    Icon: ChefHat,
  },
  {
    key: 'ready',
    label: 'Ready',
    description: 'Waiting at pickup counter',
    Icon: Sparkles,
  },
  {
    key: 'collected',
    label: 'Collected',
    description: 'Picked up — enjoy your meal!',
    Icon: PackageCheck,
  },
]

function getStepIndex(status: OrderStatus): number {
  switch (status) {
    case 'awaiting_cash':
    case 'placed':
      return 0
    case 'accepted':
      return 1
    case 'preparing':
      return 2
    case 'ready':
      return 3
    case 'collected':
      return 4
    default:
      return -1
  }
}

export function OrderTrackingClient({ initialOrder }: OrderTrackingClientProps) {
  const [order, setOrder] = useState<OrderWithItems>(initialOrder)
  const [isFlipped, setIsFlipped] = useState(false)
  const [shimmerKey, setShimmerKey] = useState(0)
  const [qrDataUrl, setQrDataUrl] = useState<string>('')
  const [dismissedReadyForStatus, setDismissedReadyForStatus] = useState(false)
  const [updatingEta, setUpdatingEta] = useState(false)
  const vibratedRef = useRef(false)
  const showReadyOverlay = order.status === 'ready' && !dismissedReadyForStatus

  const qrPayload = order.qr_token || order.code
  const manualOtp = useMemo(
    () => deriveOrderOtp(order.qr_token || order.id),
    [order.qr_token, order.id]
  )

  // Generate QR data URL
  useEffect(() => {
    let active = true
    QRCode.toDataURL(qrPayload, {
      width: 240,
      margin: 2,
      color: {
        dark: '#2B1117',
        light: '#FFFFFF',
      },
    })
      .then((url) => {
        if (active) setQrDataUrl(url)
      })
      .catch(() => {
        // Ignore QR generation errors
      })
    return () => {
      active = false
    }
  }, [qrPayload])

  // Trigger vibration when entering ready state
  useEffect(() => {
    if (order.status === 'ready' && !vibratedRef.current) {
      vibratedRef.current = true
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate([200, 100, 200, 100, 300])
        } catch {
          // Vibration not permitted
        }
      }
    }
  }, [order.status])

  // Live Supabase Realtime subscription on orders.code = [code]
  useEffect(() => {
    if (!isSupabaseConfigured()) {
      return
    }

    const supabase = createClient()
    const channel = supabase
      .channel(`order-live-${order.code}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `code=eq.${order.code}`,
        },
        (payload) => {
          const updated = payload.new as Partial<OrderWithItems>
          if (updated.status === 'ready') {
            setDismissedReadyForStatus(false)
          }
          setOrder((prev) => ({
            ...prev,
            ...updated,
          }))
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [order.code])

  const handleToggleFlip = () => {
    setIsFlipped((prev) => {
      const next = !prev
      if (next) setShimmerKey((k) => k + 1)
      return next
    })
  }

  const handleShare = async () => {
    const shareUrl =
      typeof window !== 'undefined' ? window.location.href : `/orders/${order.code}`
    const shareData = {
      title: `MITE Canteen Order #${order.code}`,
      text: `Track my MITE Canteen order #${order.code}`,
      url: shareUrl,
    }

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share(shareData)
        return
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') return
      }
    }

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(shareUrl)
        toast.success('Tracking link copied! Open on any signed-in device.')
        return
      } catch {
        // Fallback toast below
      }
    }
    toast.info(`Share link: ${shareUrl}`)
  }

  const canDelayEta = ['placed', 'awaiting_cash', 'accepted'].includes(order.status)

  const handleRunningLate = async () => {
    if (!canDelayEta || updatingEta) return
    setUpdatingEta(true)
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(order.code)}/eta`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delta_minutes: 5 }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Could not update arrival time')
        return
      }
      setOrder((prev) => ({
        ...prev,
        eta_minutes: data.eta_minutes ?? prev.eta_minutes,
        arrive_at: data.arrive_at ?? prev.arrive_at,
        priority_score: data.priority_score ?? prev.priority_score,
      }))
      toast.success('Updated arrival time (+5 min). Kitchen priority adjusted.')
    } catch {
      toast.error('Network error while updating ETA')
    } finally {
      setUpdatingEta(false)
    }
  }

  const currentStepIdx = getStepIndex(order.status)
  const isTerminalFailure =
    order.status === 'cancelled' || order.status === 'rejected'

  const slotLabel = order.pickup_slot
    ? formatSlotTime(order.pickup_slot.slot_start)
    : order.arrive_at
      ? formatSlotTime(order.arrive_at)
      : 'ASAP'

  return (
    <div className="min-h-screen bg-[var(--bg)] pb-16">
      {/* Ready Celebration Full-Screen Overlay */}
      <AnimatePresence>
        {showReadyOverlay && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[var(--primary)]/95 p-6 text-center text-white backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.75, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 260, damping: 20 }}
              className="max-w-sm space-y-5"
            >
              <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-white/15 ring-4 ring-[var(--accent)]/60">
                <Sparkles className="h-12 w-12 text-[var(--accent)]" />
              </div>
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/80">
                  Fresh from the kitchen
                </p>
                <h2 className="text-4xl font-extrabold tracking-tight">
                  Order #{order.code} is READY!
                </h2>
                <p className="text-sm text-white/85">
                  Head to the MITE canteen pickup counter and show your QR code.
                </p>
              </div>

              <div className="flex flex-col gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setDismissedReadyForStatus(true)
                    setIsFlipped(true)
                    setShimmerKey((k) => k + 1)
                  }}
                  className="inline-flex h-12 min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-xl bg-white px-6 text-sm font-bold text-[var(--primary)] shadow-lg"
                >
                  <QrCode className="h-4 w-4" />
                  Show QR Code
                </button>
                <button
                  type="button"
                  onClick={() => setDismissedReadyForStatus(true)}
                  className="inline-flex h-11 min-h-[44px] cursor-pointer items-center justify-center rounded-xl border border-white/25 px-5 text-sm font-semibold text-white/90 hover:bg-white/10"
                >
                  View order status
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Header */}
      <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--bg)]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3.5 sm:px-6">
          <Link
            href="/home"
            className="inline-flex h-11 min-h-[44px] items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-2)]"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Home</span>
          </Link>

          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Live Tracker
          </span>

          <button
            type="button"
            onClick={handleShare}
            className="inline-flex h-11 min-h-[44px] cursor-pointer items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-2)]"
          >
            <Share2 className="h-4 w-4" />
            <span className="hidden sm:inline">Share</span>
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-6 px-4 pt-6 sm:px-6">
        {/* Big Order Code Heading */}
        <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
            Order Code
          </p>
          <h1 className="mt-1 font-mono text-4xl font-extrabold tracking-tight text-[var(--primary)] sm:text-5xl">
            {order.code}
          </h1>

          <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-2)] px-3 py-1 font-medium text-[var(--text)]">
              <Clock className="h-3.5 w-3.5 text-[var(--accent)]" />
              Pickup slot: {slotLabel}
            </span>
            {order.eta_minutes && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-2)] px-3 py-1 font-medium text-[var(--text)]">
                ETA: {order.eta_minutes} min
              </span>
            )}
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-3 py-1 font-semibold',
                order.payment_status === 'paid'
                  ? 'bg-[var(--success)]/15 text-[var(--success)]'
                  : 'bg-[var(--warning)]/15 text-[var(--warning)]'
              )}
            >
              {order.payment_status === 'paid' ? 'Paid' : 'Pay Cash at Counter'}
            </span>
          </div>

          {order.status === 'awaiting_cash' && (
            <div className="mt-4 flex items-center justify-center gap-2 rounded-2xl border border-[var(--warning)]/40 bg-[var(--warning)]/12 px-4 py-2.5 text-xs font-medium text-[var(--text)]">
              <Banknote className="h-4 w-4 shrink-0 text-[var(--warning)]" />
              <span>
                Pay {formatPaise(order.total_paise)} at the canteen counter to send this order to the kitchen.
              </span>
            </div>
          )}

          {canDelayEta && (
            <div className="mt-4 flex justify-center">
              <button
                type="button"
                disabled={updatingEta}
                onClick={handleRunningLate}
                className="inline-flex h-11 min-h-[44px] cursor-pointer items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 text-xs font-semibold text-[var(--text)] transition-colors hover:border-[var(--primary)]/50 hover:bg-[var(--primary-soft)]/50 disabled:opacity-60"
              >
                {updatingEta ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--primary)]" />
                ) : (
                  <Clock className="h-3.5 w-3.5 text-[var(--primary)]" />
                )}
                <span>Running late? +5 min</span>
              </button>
            </div>
          )}
        </section>

        {/* Flip QR Code Card */}
        <section aria-label="Order details and QR card">
          <div style={{ perspective: '1200px' }}>
            <motion.div
              role="button"
              tabIndex={0}
              onClick={handleToggleFlip}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  handleToggleFlip()
                }
              }}
              animate={{ rotateY: isFlipped ? 180 : 0 }}
              transition={{ type: 'spring', stiffness: 220, damping: 24 }}
              style={{ transformStyle: 'preserve-3d' }}
              className="relative min-h-[320px] w-full cursor-pointer select-none focus:outline-none"
            >
              {/* FRONT: Order Details */}
              <div
                style={{ backfaceVisibility: 'hidden' }}
                className="flex h-full min-h-[320px] flex-col justify-between rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] pb-3">
                    <div className="flex items-center gap-2">
                      <Utensils className="h-4 w-4 text-[var(--primary)]" />
                      <h2 className="text-sm font-bold text-[var(--text)]">Order Details</h2>
                    </div>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--primary-soft)] px-3 py-1 text-xs font-semibold text-[var(--primary)]">
                      <QrCode className="h-3.5 w-3.5" />
                      Tap to reveal QR
                    </span>
                  </div>

                  <ul className="mt-4 space-y-2.5">
                    {order.order_items.map((item) => (
                      <li
                        key={item.id}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="font-medium text-[var(--text)]">
                          <span className="mr-2 font-mono font-bold text-[var(--primary)]">
                            {item.qty}×
                          </span>
                          {item.name_snapshot}
                        </span>
                        <span className="font-semibold text-[var(--text)]">
                          {formatPaise(item.unit_price_paise * item.qty)}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {order.note && (
                    <p className="mt-3 rounded-xl bg-[var(--surface-2)] px-3 py-2 text-xs text-[var(--text-muted)]">
                      Note: {order.note}
                    </p>
                  )}
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-[var(--border)] pt-4">
                  <div>
                    <p className="text-xs text-[var(--text-muted)]">Total</p>
                    <p className="text-xl font-extrabold text-[var(--text)]">
                      {formatPaise(order.total_paise)}
                    </p>
                  </div>
                  <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--primary)]">
                    <RotateCw className="h-4 w-4" />
                    Flip card for collection QR
                  </div>
                </div>
              </div>

              {/* BACK: QR Code + Shimmer Sweep */}
              <div
                style={{
                  backfaceVisibility: 'hidden',
                  transform: 'rotateY(180deg)',
                }}
                className="absolute inset-0 flex min-h-[320px] flex-col items-center justify-center overflow-hidden rounded-3xl border border-[var(--primary)]/40 bg-gradient-to-br from-[var(--surface)] via-[var(--surface)] to-[var(--primary-soft)]/60 p-6 text-center shadow-lg"
              >
                {/* Shimmer Sweep on Reveal */}
                {isFlipped && (
                  <div
                    key={shimmerKey}
                    aria-hidden="true"
                    className={cn(
                      'pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/55 to-transparent',
                      styles.shimmerSweep
                    )}
                  />
                )}

                <div className="relative z-10 flex flex-col items-center">
                  <div className="rounded-2xl border border-[var(--border)] bg-white p-3 shadow-sm">
                    {qrDataUrl ? (
                      <img
                        src={qrDataUrl}
                        alt={`Collection QR code for order ${order.code}`}
                        className="h-40 w-40 object-contain"
                      />
                    ) : (
                      <div className="flex h-40 w-40 items-center justify-center text-xs text-neutral-500">
                        Generating QR...
                      </div>
                    )}
                  </div>

                  <p className="mt-3 font-mono text-2xl font-extrabold tracking-wider text-[var(--primary)]">
                    {order.code}
                  </p>
                  <p className="text-xs font-semibold uppercase tracking-widest text-[var(--text)]">
                    Show at counter
                  </p>
                  <p className="mt-2 rounded-full bg-[var(--surface-2)] px-3 py-1 font-mono text-[11px] font-medium text-[var(--text-muted)]">
                    Manual OTP: {manualOtp}
                  </p>
                  <p className="mt-2 inline-flex items-center gap-1 text-[11px] text-[var(--text-muted)]">
                    <RotateCw className="h-3 w-3" />
                    Tap card to view items
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Status Stepper or Terminal Status */}
        {isTerminalFailure ? (
          <section className="rounded-3xl border border-[var(--danger)]/40 bg-[var(--danger)]/10 p-6 text-center">
            <XCircle className="mx-auto h-10 w-10 text-[var(--danger)]" />
            <h2 className="mt-3 text-lg font-bold text-[var(--text)]">
              Order {order.status === 'cancelled' ? 'Cancelled' : 'Rejected'}
            </h2>
            {order.rejected_reason && (
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                Reason: {order.rejected_reason}
              </p>
            )}
          </section>
        ) : (
          <section
            aria-label="Order progress"
            className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm"
          >
            <h2 className="mb-5 text-sm font-bold uppercase tracking-wide text-[var(--text-muted)]">
              Live Progress
            </h2>

            <ol className="space-y-0">
              {STEPPER_STEPS.map((stepItem, idx) => {
                const isCompleted = currentStepIdx > idx || (idx === 4 && currentStepIdx === 4)
                const isCurrent = currentStepIdx === idx && order.status !== 'collected'
                const Icon = stepItem.Icon
                const isLast = idx === STEPPER_STEPS.length - 1
                const lineFilled = currentStepIdx > idx

                const displayLabel =
                  idx === 0 && order.status === 'awaiting_cash'
                    ? 'Awaiting Cash'
                    : stepItem.label

                const displayDescription =
                  idx === 0 && order.status === 'awaiting_cash'
                    ? 'Pay cash at the counter to start preparation'
                    : stepItem.description

                return (
                  <li key={stepItem.key} className="relative flex gap-4 pb-6 last:pb-0">
                    {/* Vertical connector */}
                    {!isLast && (
                      <div
                        aria-hidden="true"
                        className="absolute left-5 top-10 h-[calc(100%-2.25rem)] w-0.5 overflow-hidden rounded-full bg-[var(--border)]"
                      >
                        <motion.div
                          initial={{ height: '0%' }}
                          animate={{ height: lineFilled ? '100%' : '0%' }}
                          transition={{ duration: 0.45, ease: 'easeOut' }}
                          className="w-full bg-gradient-to-b from-[var(--primary)] to-[var(--accent)]"
                        />
                      </div>
                    )}

                    {/* Step dot */}
                    <div
                      className={cn(
                        'relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                        isCompleted &&
                          'border-[var(--primary)] bg-[var(--primary)] text-white',
                        isCurrent &&
                          `border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)] ${styles.activeStepDot}`,
                        !isCompleted &&
                          !isCurrent &&
                          'border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-muted)]'
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </div>

                    <div className="pt-1">
                      <p
                        className={cn(
                          'text-sm font-bold',
                          isCompleted || isCurrent
                            ? 'text-[var(--text)]'
                            : 'text-[var(--text-muted)]'
                        )}
                      >
                        {displayLabel}
                      </p>
                      <p className="text-xs text-[var(--text-muted)]">
                        {displayDescription}
                      </p>
                    </div>
                  </li>
                )
              })}
            </ol>
          </section>
        )}

        {/* Bottom Actions */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={handleShare}
            className="inline-flex h-12 min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-semibold text-[var(--text)] transition-colors hover:bg-[var(--surface-2)]"
          >
            <Share2 className="h-4 w-4 text-[var(--primary)]" />
            Track on a new device
          </button>

          <Link
            href="/home"
            className="inline-flex h-12 min-h-[44px] items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[var(--primary-hover)]"
          >
            <Home className="h-4 w-4" />
            Back to home
          </Link>
        </div>
      </main>
    </div>
  )
}
