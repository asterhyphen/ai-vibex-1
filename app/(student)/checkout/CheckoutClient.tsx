'use client'

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import * as Tabs from '@radix-ui/react-tabs'
import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Banknote,
  CalendarClock,
  Check,
  Clock,
  CreditCard,
  Loader2,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Trash2,
  Wallet,
} from 'lucide-react'
import { toast } from 'sonner'
import type { MenuItem, PickupSlot } from '@/lib/types'
import { useCartStore } from '@/lib/stores/cart'
import { createClient } from '@/lib/supabase/client'
import { CheckoutSchema } from '@/lib/validators/order'
import {
  cn,
  extractBackAtTag,
  formatPaise,
  formatSlotRange,
  formatSlotTime,
} from '@/lib/utils/format'

interface CheckoutClientProps {
  initialSlots: PickupSlot[]
  initialMenuItems?: MenuItem[]
  showingAfterHoursFallback: boolean
}

type CheckoutStep = 1 | 2 | 3
type PaymentTab = 'online' | 'cash'
type OnlineMethod = 'upi' | 'card' | 'wallet'
type WalletProvider = 'GPay' | 'PhonePe' | 'Paytm'

interface ConfettiParticle {
  id: number
  x: number
  y: number
  rotate: number
  color: string
  size: number
  delay: number
}

const CONFETTI_COLORS = ['#7A1F3D', '#A83060', '#B8893B', '#D4A855', '#F6E4EA']

function generateConfetti(count = 42): ConfettiParticle[] {
  return Array.from({ length: count }).map((_, idx) => {
    const angle = (idx / count) * Math.PI * 2 + (idx % 3) * 0.15
    const distance = 90 + (idx % 5) * 34
    return {
      id: idx,
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance - 30,
      rotate: (idx * 57) % 360,
      color: CONFETTI_COLORS[idx % CONFETTI_COLORS.length],
      size: 6 + (idx % 4) * 2,
      delay: (idx % 6) * 0.03,
    }
  })
}

const QUICK_ETAS = [5, 10, 15, 20]
const emptySubscribe = () => () => {}

function getLeastLoadedSlotId(slots: PickupSlot[]): string {
  const available = slots.filter((s) => s.used_units < s.capacity_units)
  if (available.length === 0) return ''
  let best = available[0]
  let bestRatio = best.used_units / Math.max(1, best.capacity_units)
  for (const s of available) {
    const ratio = s.used_units / Math.max(1, s.capacity_units)
    if (ratio < bestRatio) {
      best = s
      bestRatio = ratio
    }
  }
  return best.id
}

export function CheckoutClient({
  initialSlots,
  initialMenuItems = [],
  showingAfterHoursFallback,
}: CheckoutClientProps) {
  const router = useRouter()
  const items = useCartStore((s) => s.items)
  const total_paise = useCartStore((s) => s.total_paise)
  const total_items = useCartStore((s) => s.total_items)
  const hasHydrated = useCartStore((s) => s.hasHydrated)
  const removeItem = useCartStore((s) => s.removeItem)
  const clearCart = useCartStore((s) => s.clearCart)

  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  )
  const [step, setStep] = useState<CheckoutStep>(1)
  const [baseTimestampMs, setBaseTimestampMs] = useState<number>(() => Date.now())
  const [liveMenuMap, setLiveMenuMap] = useState<Map<string, MenuItem>>(
    () => new Map(initialMenuItems.map((m) => [m.id, m]))
  )

  // Live stock subscription so out-of-stock changes flag cart items immediately
  useEffect(() => {
    if (
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ) {
      return
    }

    const supabase = createClient()
    const channel = supabase
      .channel('checkout-menu-stock')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'menu_items',
        },
        (payload) => {
          const updated = payload.new as MenuItem
          setLiveMenuMap((prev) => {
            const next = new Map(prev)
            next.set(updated.id, updated)
            return next
          })
          if (!updated.in_stock || updated.is_active === false) {
            const inCart = useCartStore
              .getState()
              .items.some((ci) => ci.menuItemId === updated.id)
            if (inCart) {
              toast.warning(`${updated.name} is now out of stock.`)
            }
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const unavailableCartItems = useMemo(() => {
    return items
      .map((cartItem) => {
        const live = liveMenuMap.get(cartItem.menuItemId)
        if (!live) return null
        if (live.in_stock && live.is_active !== false) return null
        return {
          menuItemId: cartItem.menuItemId,
          name: cartItem.name,
          backAt: extractBackAtTag(live.tags),
        }
      })
      .filter((entry): entry is { menuItemId: string; name: string; backAt: string | null } =>
        Boolean(entry)
      )
  }, [items, liveMenuMap])

  const hasUnavailableItems = unavailableCartItems.length > 0

  const recommendedSlotId = useMemo(
    () => getLeastLoadedSlotId(initialSlots),
    [initialSlots]
  )

  const [selectedSlotId, setSelectedSlotId] = useState<string>(() =>
    getLeastLoadedSlotId(initialSlots)
  )
  const [etaMinutes, setEtaMinutes] = useState<number>(10)
  const [note, setNote] = useState<string>('')

  const [paymentTab, setPaymentTab] = useState<PaymentTab>('online')
  const [onlineMethod, setOnlineMethod] = useState<OnlineMethod>('upi')
  const [upiId, setUpiId] = useState('mitecanteen@upi')
  const [cardName, setCardName] = useState('Aarav Sharma')
  const [cardDigits, setCardDigits] = useState('4532 8910 2345 4242')
  const [cardExpiry, setCardExpiry] = useState('08/28')
  const [cardCvv, setCardCvv] = useState('412')
  const [selectedWallet, setSelectedWallet] = useState<WalletProvider>('GPay')

  const [isProcessing, setIsProcessing] = useState(false)
  const [processingLabel, setProcessingLabel] = useState('Processing payment...')
  const [confirmedOrderCode, setConfirmedOrderCode] = useState<string | null>(null)
  const [confettiParticles] = useState<ConfettiParticle[]>(() => generateConfetti(42))

  const activeSlotId = selectedSlotId || recommendedSlotId

  const selectedSlot = useMemo(
    () => initialSlots.find((s) => s.id === activeSlotId) ?? null,
    [initialSlots, activeSlotId]
  )

  const estimatedArrivalLabel = useMemo(() => {
    const arrive = new Date(baseTimestampMs + etaMinutes * 60_000)
    return arrive.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    })
  }, [baseTimestampMs, etaMinutes])

  const maskedCardPreview = useMemo(() => {
    const digits = cardDigits.replace(/\D/g, '').slice(0, 16)
    if (digits.length <= 4) return digits
    return `•••• •••• •••• ${digits.slice(-4)}`
  }, [cardDigits])

  const submitOrder = async (method: PaymentTab) => {
    const checkoutCheck = CheckoutSchema.safeParse({
      slot_id: activeSlotId,
      eta_minutes: etaMinutes,
      payment_method: method,
      note: note.trim() || undefined,
    })

    if (!checkoutCheck.success) {
      toast.error(checkoutCheck.error.issues[0]?.message ?? 'Please review checkout details')
      return
    }

    if (items.length === 0) {
      toast.error('Your cart is empty')
      return
    }

    if (hasUnavailableItems) {
      toast.error('Remove out-of-stock items from your tray before paying')
      return
    }

    setIsProcessing(true)
    setProcessingLabel(
      method === 'online'
        ? `Confirming ${onlineMethod.toUpperCase()} payment...`
        : 'Reserving your pickup slot...'
    )

    try {
      // Simulate 2s gateway animation for online payment demo
      if (method === 'online') {
        await new Promise((resolve) => setTimeout(resolve, 2000))
      } else {
        await new Promise((resolve) => setTimeout(resolve, 600))
      }

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'app',
          items: items.map((i) => ({ menuItemId: i.menuItemId, qty: i.qty })),
          slot_id: checkoutCheck.data.slot_id,
          eta_minutes: checkoutCheck.data.eta_minutes,
          payment_method: checkoutCheck.data.payment_method,
          note: checkoutCheck.data.note,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Could not place order. Please try again.')
        setIsProcessing(false)
        return
      }

      setIsProcessing(false)
      setConfirmedOrderCode(data.code)
      clearCart()

      window.setTimeout(() => {
        router.push(`/orders/${data.code}`)
      }, 1500)
    } catch {
      toast.error('Network error while placing order. Please retry.')
      setIsProcessing(false)
    }
  }

  const ready = mounted && (hasHydrated || items.length > 0)

  if (confirmedOrderCode) {
    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[var(--bg)] px-4">
        {/* Gold & Burgundy Confetti Burst */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        >
          {confettiParticles.map((p) => (
            <motion.span
              key={p.id}
              initial={{ x: 0, y: 0, scale: 0, rotate: 0, opacity: 1 }}
              animate={{
                x: p.x,
                y: p.y,
                scale: [0, 1.2, 0.9],
                rotate: p.rotate,
                opacity: [1, 1, 0],
              }}
              transition={{ duration: 1.15, delay: 0.25 + p.delay, ease: 'easeOut' }}
              style={{
                width: p.size,
                height: p.size * 0.65,
                backgroundColor: p.color,
              }}
              className="absolute rounded-xs"
            />
          ))}
        </div>

        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="relative z-10 w-full max-w-sm rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center shadow-2xl"
        >
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[var(--success)]/15">
            <svg viewBox="0 0 52 52" className="h-12 w-12">
              <motion.circle
                cx="26"
                cy="26"
                r="22"
                fill="none"
                stroke="var(--success)"
                strokeWidth="3.5"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
              />
              <motion.path
                d="M15 27 L23 35 L37 19"
                fill="none"
                stroke="var(--success)"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.6, delay: 0.15, ease: 'easeInOut' }}
              />
            </svg>
          </div>

          <h1 className="mt-5 text-2xl font-bold text-[var(--text)]">Order Confirmed!</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Order code{' '}
            <span className="font-mono font-bold text-[var(--primary)]">
              #{confirmedOrderCode}
            </span>
          </p>
          <p className="mt-3 text-xs text-[var(--text-muted)]">
            Opening your live tracker & QR code...
          </p>
        </motion.div>
      </div>
    )
  }

  if (ready && items.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--bg)] px-4">
        <div className="w-full max-w-md rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--surface-2)] text-[var(--primary)]">
            <ShoppingBag className="h-8 w-8" />
          </div>
          <h1 className="mt-4 text-xl font-bold text-[var(--text)]">Your tray is empty</h1>
          <p className="mt-1.5 text-sm text-[var(--text-muted)]">
            Add some dishes from the canteen menu before checking out.
          </p>
          <Link
            href="/home"
            className="mt-6 inline-flex h-11 min-h-[44px] items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-6 text-sm font-semibold text-white hover:bg-[var(--primary-hover)]"
          >
            Browse Menu
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] pb-16">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--bg)]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3.5 sm:px-6">
          <Link
            href="/home"
            className="inline-flex h-11 min-h-[44px] items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-2)]"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Menu</span>
          </Link>
          <h1 className="text-base font-bold text-[var(--text)] sm:text-lg">Checkout</h1>
          <div className="rounded-xl bg-[var(--primary-soft)] px-3 py-1.5 text-sm font-bold text-[var(--primary)]">
            {formatPaise(total_paise)}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-4 pt-5 sm:px-6">
        {/* 3-Step Progress Rail */}
        <nav aria-label="Checkout progress" className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <ol className="flex items-center justify-between gap-2">
            {[
              { id: 1 as CheckoutStep, label: 'Slot', Icon: CalendarClock },
              { id: 2 as CheckoutStep, label: 'ETA', Icon: Clock },
              { id: 3 as CheckoutStep, label: 'Payment', Icon: CreditCard },
            ].map((s, idx) => {
              const isDone = step > s.id
              const isActive = step === s.id
              return (
                <li key={s.id} className="flex flex-1 items-center gap-2">
                  <button
                    type="button"
                    disabled={s.id > step}
                    onClick={() => s.id < step && setStep(s.id)}
                    className={cn(
                      'flex min-h-[44px] flex-1 items-center gap-2 rounded-xl px-2.5 py-2 text-left transition-colors',
                      isActive && 'bg-[var(--primary-soft)] text-[var(--primary)]',
                      isDone && 'cursor-pointer text-[var(--success)] hover:bg-[var(--surface-2)]',
                      !isActive && !isDone && 'text-[var(--text-muted)] opacity-70'
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                        isActive && 'bg-[var(--primary)] text-white',
                        isDone && 'bg-[var(--success)] text-white',
                        !isActive && !isDone && 'bg-[var(--surface-2)] text-[var(--text-muted)]'
                      )}
                    >
                      {isDone ? <Check className="h-4 w-4" /> : s.id}
                    </span>
                    <span className="text-xs font-semibold sm:text-sm">{s.label}</span>
                  </button>
                  {idx < 2 && (
                    <div
                      aria-hidden="true"
                      className={cn(
                        'hidden h-0.5 w-6 rounded-full sm:block',
                        step > s.id ? 'bg-[var(--success)]' : 'bg-[var(--border)]'
                      )}
                    />
                  )}
                </li>
              )
            })}
          </ol>
        </nav>

        {/* Compact Order Summary Strip */}
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              Order Summary · {total_items} {total_items === 1 ? 'item' : 'items'}
            </span>
            <span className="text-sm font-bold text-[var(--text)]">
              {formatPaise(total_paise)}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {items.map((item) => {
              const isOut = unavailableCartItems.some(
                (u) => u.menuItemId === item.menuItemId
              )
              return (
                <span
                  key={item.menuItemId}
                  className={cn(
                    'rounded-full px-2.5 py-1 text-xs font-medium',
                    isOut
                      ? 'border border-[var(--danger)]/40 bg-[var(--danger)]/10 text-[var(--danger)] line-through'
                      : 'bg-[var(--surface-2)] text-[var(--text)]'
                  )}
                >
                  {item.qty}× {item.name}
                </span>
              )
            })}
          </div>
        </section>

        {/* Out-of-stock Cart Alert */}
        {hasUnavailableItems && (
          <section
            role="alert"
            className="space-y-3 rounded-2xl border border-[var(--danger)]/40 bg-[var(--danger)]/10 p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-bold text-[var(--danger)]">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>
                  {unavailableCartItems.length} item{unavailableCartItems.length === 1 ? ' is' : 's are'} no longer available
                </span>
              </div>
              {unavailableCartItems.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    unavailableCartItems.forEach((u) => removeItem(u.menuItemId))
                    toast.success('Removed unavailable items from tray')
                  }}
                  className="cursor-pointer rounded-lg bg-[var(--danger)] px-3 py-1 text-xs font-semibold text-white hover:opacity-90"
                >
                  Remove all unavailable
                </button>
              )}
            </div>
            <div className="space-y-1.5">
              {unavailableCartItems.map((u) => (
                <div
                  key={u.menuItemId}
                  className="flex items-center justify-between gap-2 rounded-xl bg-[var(--surface)]/80 px-3 py-2 text-xs"
                >
                  <div>
                    <span className="font-semibold text-[var(--text)]">{u.name}</span>
                    {u.backAt && (
                      <span className="ml-2 text-[var(--text-muted)]">
                        (Back at {u.backAt})
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      removeItem(u.menuItemId)
                      toast.success(`Removed ${u.name}`)
                    }}
                    className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-[var(--danger)]/35 px-2.5 py-1 font-semibold text-[var(--danger)] hover:bg-[var(--danger)]/10"
                  >
                    <Trash2 className="h-3 w-3" />
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Step Content */}
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.section
              key="step-1"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.2 }}
              className="space-y-4 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6"
            >
              <div>
                <h2 className="text-lg font-bold text-[var(--text)]">
                  Choose a 10-minute pickup slot
                </h2>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  Pick a less crowded window for faster service at the counter.
                </p>
                {showingAfterHoursFallback && (
                  <p className="mt-2 rounded-xl border border-[var(--accent)]/35 bg-[var(--accent)]/10 px-3 py-2 text-xs text-[var(--text)]">
                    Showing today&apos;s seeded canteen slots for after-hours testing.
                  </p>
                )}
              </div>

              {initialSlots.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[var(--border)] p-6 text-center text-sm text-[var(--text-muted)]">
                  No pickup slots are currently available. Please check back when the canteen is open.
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                  {initialSlots.map((slot) => {
                    const isFull = slot.used_units >= slot.capacity_units
                    const isSelected = slot.id === activeSlotId
                    const isRecommended = slot.id === recommendedSlotId && !isFull
                    const pct = Math.min(
                      100,
                      Math.round((slot.used_units / Math.max(1, slot.capacity_units)) * 100)
                    )
                    const barColor =
                      pct > 80
                        ? 'bg-[var(--danger)]'
                        : pct >= 50
                          ? 'bg-[var(--warning)]'
                          : 'bg-[var(--success)]'

                    return (
                      <button
                        key={slot.id}
                        type="button"
                        disabled={isFull}
                        onClick={() => setSelectedSlotId(slot.id)}
                        className={cn(
                          'relative flex min-h-[82px] flex-col justify-between rounded-2xl border p-3 text-left transition-all',
                          isFull
                            ? 'cursor-not-allowed border-[var(--border)] bg-[var(--surface-2)]/60 opacity-50'
                            : isSelected
                              ? 'cursor-pointer border-[var(--primary)] bg-[var(--primary-soft)]/55 ring-2 ring-[var(--primary)]/30'
                              : 'cursor-pointer border-[var(--border)] bg-[var(--bg)] hover:border-[var(--primary)]/50'
                        )}
                      >
                        <div className="flex items-start justify-between gap-1">
                          <span className="text-xs font-bold text-[var(--text)] sm:text-sm">
                            {formatSlotRange(slot.slot_start, slot.slot_end)}
                          </span>
                        </div>

                        {isRecommended && (
                          <span className="mt-1 inline-flex w-fit items-center gap-1 rounded-full bg-[var(--accent)] px-2 py-0.5 text-[10px] font-bold text-white">
                            <Sparkles className="h-2.5 w-2.5" />
                            Recommended
                          </span>
                        )}

                        <div className="mt-2 space-y-1">
                          <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                            <span>{isFull ? 'Full' : 'Load'}</span>
                            <span className="font-mono font-semibold">
                              {slot.used_units}/{slot.capacity_units}
                            </span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-2)]">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.max(4, pct)}%` }}
                              transition={{ duration: 0.55, ease: 'easeOut' }}
                              className={cn('h-full rounded-full', barColor)}
                            />
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}

              <button
                type="button"
                disabled={!activeSlotId}
                onClick={() => {
                  setBaseTimestampMs(Date.now())
                  setStep(2)
                }}
                className="inline-flex h-12 min-h-[44px] w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-5 text-sm font-semibold text-white shadow-sm hover:bg-[var(--primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span>Continue to ETA</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </motion.section>
          )}

          {step === 2 && (
            <motion.section
              key="step-2"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.2 }}
              className="space-y-5 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6"
            >
              <div>
                <h2 className="text-lg font-bold text-[var(--text)]">
                  When will you reach?
                </h2>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  Arriving sooner moves your order ahead so it&apos;s hot when you land.
                </p>
              </div>

              {/* Quick Chips */}
              <div className="grid grid-cols-4 gap-2">
                {QUICK_ETAS.map((mins) => {
                  const active = etaMinutes === mins
                  return (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => setEtaMinutes(mins)}
                      className={cn(
                        'h-12 min-h-[44px] cursor-pointer rounded-xl border text-sm font-bold transition-all',
                        active
                          ? 'border-[var(--primary)] bg-[var(--primary)] text-white shadow-xs'
                          : 'border-[var(--border)] bg-[var(--bg)] text-[var(--text)] hover:border-[var(--primary)]/50'
                      )}
                    >
                      {mins} min
                    </button>
                  )
                })}
              </div>

              {/* Custom Slider */}
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-[var(--text)]">Custom ETA</span>
                  <span className="font-bold text-[var(--primary)]">
                    {etaMinutes} min · ~{estimatedArrivalLabel}
                  </span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={60}
                  value={etaMinutes}
                  onChange={(e) => setEtaMinutes(Number(e.target.value))}
                  aria-label="Estimated arrival minutes"
                  className="mt-3 h-2 w-full cursor-pointer accent-[var(--primary)]"
                />
                <div className="mt-1 flex justify-between text-[11px] text-[var(--text-muted)]">
                  <span>1 min</span>
                  <span>30 min</span>
                  <span>60 min</span>
                </div>
              </div>

              {/* Optional note */}
              <div>
                <label
                  htmlFor="kitchen-note"
                  className="block text-xs font-semibold text-[var(--text)]"
                >
                  Note for kitchen (optional)
                </label>
                <input
                  id="kitchen-note"
                  type="text"
                  maxLength={250}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. extra chutney, less spicy"
                  className="mt-1.5 h-11 min-h-[44px] w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3.5 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:border-[var(--primary)] focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="inline-flex h-12 min-h-[44px] cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 text-sm font-semibold text-[var(--text)] hover:bg-[var(--border)]/50"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="inline-flex h-12 min-h-[44px] flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-5 text-sm font-semibold text-white shadow-sm hover:bg-[var(--primary-hover)]"
                >
                  <span>Continue to Payment</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </motion.section>
          )}

          {step === 3 && (
            <motion.section
              key="step-3"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.2 }}
              className="space-y-5 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-lg font-bold text-[var(--text)]">Payment</h2>
                  <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                    {selectedSlot
                      ? `Slot ${formatSlotTime(selectedSlot.slot_start)} · Arriving in ${etaMinutes} min`
                      : `Arriving in ${etaMinutes} min`}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-2)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-muted)]">
                  <ShieldCheck className="h-3.5 w-3.5 text-[var(--success)]" />
                  Demo Gateway
                </span>
              </div>

              <Tabs.Root
                value={paymentTab}
                onValueChange={(v) => setPaymentTab(v as PaymentTab)}
              >
                <Tabs.List className="grid grid-cols-2 gap-2 rounded-2xl bg-[var(--surface-2)] p-1.5">
                  <Tabs.Trigger
                    value="online"
                    className={cn(
                      'inline-flex h-11 min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-all',
                      paymentTab === 'online'
                        ? 'bg-[var(--surface)] text-[var(--primary)] shadow-xs'
                        : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                    )}
                  >
                    <CreditCard className="h-4 w-4" />
                    Online
                  </Tabs.Trigger>
                  <Tabs.Trigger
                    value="cash"
                    className={cn(
                      'inline-flex h-11 min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-all',
                      paymentTab === 'cash'
                        ? 'bg-[var(--surface)] text-[var(--primary)] shadow-xs'
                        : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                    )}
                  >
                    <Banknote className="h-4 w-4" />
                    Cash
                  </Tabs.Trigger>
                </Tabs.List>

                {/* Online Sub-tabs: UPI / Card / Wallet */}
                <Tabs.Content value="online" className="mt-4 space-y-4">
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'upi' as OnlineMethod, label: 'UPI', Icon: Smartphone },
                      { id: 'card' as OnlineMethod, label: 'Card', Icon: CreditCard },
                      { id: 'wallet' as OnlineMethod, label: 'Wallet', Icon: Wallet },
                    ].map(({ id, label, Icon }) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setOnlineMethod(id)}
                        className={cn(
                          'flex h-11 min-h-[44px] cursor-pointer items-center justify-center gap-1.5 rounded-xl border text-xs font-semibold transition-colors sm:text-sm',
                          onlineMethod === id
                            ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]'
                            : 'border-[var(--border)] bg-[var(--bg)] text-[var(--text-muted)] hover:text-[var(--text)]'
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        {label}
                      </button>
                    ))}
                  </div>

                  {onlineMethod === 'upi' && (
                    <div className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-4">
                      <label
                        htmlFor="upi-id"
                        className="block text-xs font-semibold text-[var(--text)]"
                      >
                        UPI ID
                      </label>
                      <input
                        id="upi-id"
                        type="text"
                        value={upiId}
                        onChange={(e) => setUpiId(e.target.value)}
                        placeholder="mitecanteen@upi"
                        className="h-11 min-h-[44px] w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 text-sm font-medium text-[var(--text)] focus:border-[var(--primary)] focus:outline-none"
                      />
                      <p className="text-[11px] text-[var(--text-muted)]">
                        Instant simulated UPI collect for hackathon demo.
                      </p>
                    </div>
                  )}

                  {onlineMethod === 'card' && (
                    <div className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-4">
                      <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
                        <span>Card preview</span>
                        <span className="font-mono font-semibold text-[var(--text)]">
                          {maskedCardPreview}
                        </span>
                      </div>
                      <input
                        type="text"
                        value={cardName}
                        onChange={(e) => setCardName(e.target.value)}
                        placeholder="Name on card"
                        aria-label="Name on card"
                        className="h-11 min-h-[44px] w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 text-sm text-[var(--text)] focus:border-[var(--primary)] focus:outline-none"
                      />
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={19}
                        value={cardDigits}
                        onChange={(e) => setCardDigits(e.target.value)}
                        placeholder="16-digit card number"
                        aria-label="16-digit card number"
                        className="h-11 min-h-[44px] w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 font-mono text-sm text-[var(--text)] focus:border-[var(--primary)] focus:outline-none"
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <input
                          type="text"
                          maxLength={5}
                          value={cardExpiry}
                          onChange={(e) => setCardExpiry(e.target.value)}
                          placeholder="MM/YY"
                          aria-label="Expiry date"
                          className="h-11 min-h-[44px] w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 font-mono text-sm text-[var(--text)] focus:border-[var(--primary)] focus:outline-none"
                        />
                        <input
                          type="password"
                          maxLength={4}
                          value={cardCvv}
                          onChange={(e) => setCardCvv(e.target.value)}
                          placeholder="CVV"
                          aria-label="CVV"
                          className="h-11 min-h-[44px] w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 font-mono text-sm text-[var(--text)] focus:border-[var(--primary)] focus:outline-none"
                        />
                      </div>
                    </div>
                  )}

                  {onlineMethod === 'wallet' && (
                    <div className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-4">
                      <p className="text-xs font-semibold text-[var(--text)]">
                        Choose wallet
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        {(['GPay', 'PhonePe', 'Paytm'] as WalletProvider[]).map((w) => (
                          <button
                            key={w}
                            type="button"
                            onClick={() => setSelectedWallet(w)}
                            className={cn(
                              'h-12 min-h-[44px] cursor-pointer rounded-xl border text-sm font-bold transition-all',
                              selectedWallet === w
                                ? 'border-[var(--primary)] bg-[var(--primary)] text-white'
                                : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text)] hover:border-[var(--primary)]/50'
                            )}
                          >
                            {w}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-3 pt-1">
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => setStep(2)}
                      className="inline-flex h-12 min-h-[44px] cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 text-sm font-semibold text-[var(--text)] hover:bg-[var(--border)]/50 disabled:opacity-50"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Back
                    </button>
                    <button
                      type="button"
                      disabled={isProcessing || hasUnavailableItems}
                      onClick={() => submitOrder('online')}
                      className="inline-flex h-12 min-h-[44px] flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-5 text-sm font-semibold text-white shadow-sm hover:bg-[var(--primary-hover)] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>{processingLabel}</span>
                        </>
                      ) : (
                        <span>Pay {formatPaise(total_paise)}</span>
                      )}
                    </button>
                  </div>
                </Tabs.Content>

                {/* Cash Tab */}
                <Tabs.Content value="cash" className="mt-4 space-y-4">
                  <div className="rounded-2xl border border-[var(--warning)]/40 bg-[var(--warning)]/10 p-4">
                    <h3 className="text-sm font-bold text-[var(--text)]">
                      Pay at counter
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">
                      Your order will be queued as <span className="font-semibold">Awaiting Cash</span>. Pay{' '}
                      <span className="font-semibold text-[var(--text)]">
                        {formatPaise(total_paise)}
                      </span>{' '}
                      at the canteen counter so the kitchen can start preparing.
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => setStep(2)}
                      className="inline-flex h-12 min-h-[44px] cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 text-sm font-semibold text-[var(--text)] hover:bg-[var(--border)]/50 disabled:opacity-50"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Back
                    </button>
                    <button
                      type="button"
                      disabled={isProcessing || hasUnavailableItems}
                      onClick={() => submitOrder('cash')}
                      className="inline-flex h-12 min-h-[44px] flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-5 text-sm font-semibold text-white shadow-sm hover:bg-[var(--primary-hover)] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Placing cash order...</span>
                        </>
                      ) : (
                        <span>Pay at counter · {formatPaise(total_paise)}</span>
                      )}
                    </button>
                  </div>
                </Tabs.Content>
              </Tabs.Root>
            </motion.section>
          )}
        </AnimatePresence>
      </main>
    </div>
  )
}
