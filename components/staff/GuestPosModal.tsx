'use client'

import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import QRCode from 'qrcode'
import {
  Banknote,
  CheckCircle2,
  CreditCard,
  Loader2,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import type { Category, MenuItem } from '@/lib/types'
import { deriveOrderOtp, formatPaise } from '@/lib/utils/format'

interface GuestPosModalProps {
  open: boolean
  menuItems: MenuItem[]
  categories: Category[]
  onClose: () => void
  onOrderCreated: () => void
}

interface TokenSlip {
  code: string
  order_id: string
  qr_token: string
  qrDataUrl: string
  otp: string
  total_paise: number
  guest_name: string
  payment_method: 'cash' | 'online'
  items: Array<{ name: string; qty: number; price_paise: number }>
}

export function GuestPosModal(props: GuestPosModalProps) {
  if (!props.open) return null
  return <GuestPosModalInner {...props} />
}

function GuestPosModalInner({
  menuItems,
  categories,
  onClose,
  onOrderCreated,
}: GuestPosModalProps) {
  const [guestName, setGuestName] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'online'>('cash')
  const [submitting, setSubmitting] = useState(false)
  const [slip, setSlip] = useState<TokenSlip | null>(null)

  const inStockItems = useMemo(
    () => menuItems.filter((item) => item.in_stock && item.is_active),
    [menuItems]
  )

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase()
    return inStockItems.filter((item) => {
      const catOk = selectedCategory === 'all' || item.category_id === selectedCategory
      const searchOk = !q || item.name.toLowerCase().includes(q)
      return catOk && searchOk
    })
  }, [inStockItems, selectedCategory, search])

  const selectedLines = useMemo(() => {
    return Object.entries(quantities)
      .filter(([, qty]) => qty > 0)
      .map(([id, qty]) => {
        const item = inStockItems.find((m) => m.id === id)
        return item ? { item, qty } : null
      })
      .filter(Boolean) as Array<{ item: MenuItem; qty: number }>
  }, [quantities, inStockItems])

  const totalPaise = useMemo(
    () =>
      selectedLines.reduce(
        (sum, line) => sum + line.item.price_paise * line.qty,
        0
      ),
    [selectedLines]
  )

  const adjustQty = (id: string, delta: number) => {
    setQuantities((prev) => {
      const next = Math.max(0, Math.min(50, (prev[id] ?? 0) + delta))
      if (next === 0) {
        const copy = { ...prev }
        delete copy[id]
        return copy
      }
      return { ...prev, [id]: next }
    })
  }

  const handleSubmit = async () => {
    if (selectedLines.length === 0) {
      toast.error('Tap at least one item to place a walk-in order')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'guest',
          guest_name: guestName.trim() || undefined,
          payment_method: paymentMethod,
          eta_minutes: 5,
          items: selectedLines.map(({ item, qty }) => ({
            menuItemId: item.id,
            name: item.name,
            price_paise: item.price_paise,
            qty,
            prep_seconds: item.prep_seconds,
          })),
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Failed to place walk-in order')
        return
      }

      const qrDataUrl = await QRCode.toDataURL(data.qr_token, {
        width: 220,
        margin: 1,
        color: { dark: '#2B1117', light: '#FFFFFF' },
      })

      setSlip({
        code: data.code,
        order_id: data.order_id,
        qr_token: data.qr_token,
        qrDataUrl,
        otp: deriveOrderOtp(data.qr_token || data.order_id),
        total_paise: data.total_paise ?? totalPaise,
        guest_name: guestName.trim() || 'Walk-in Guest',
        payment_method: paymentMethod,
        items: selectedLines.map(({ item, qty }) => ({
          name: item.name,
          qty,
          price_paise: item.price_paise,
        })),
      })

      toast.success(`Walk-in order ${data.code} placed!`)
      onOrderCreated()
    } catch {
      toast.error('Network error submitting walk-in order')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-3 sm:p-6 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
            <div className="flex items-center gap-2.5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent)]/20 text-[var(--accent)]">
                <ShoppingBag className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-lg font-extrabold text-[var(--text)]">
                  {slip ? 'Walk-in Token Slip' : 'New Walk-in Order (POS)'}
                </h2>
                <p className="text-xs text-[var(--text-muted)]">
                  {slip
                    ? 'Hand token code or QR to guest for pickup'
                    : 'Tap in-stock items to build a quick counter order'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close POS"
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {slip ? (
            <div className="flex flex-col items-center overflow-y-auto p-6 text-center">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--success)]/15 px-3 py-1 text-xs font-bold text-[var(--success)]">
                <CheckCircle2 className="h-4 w-4" />
                Order Confirmed ({slip.payment_method.toUpperCase()})
              </span>

              <div className="mt-3 text-5xl font-black tracking-tight text-[var(--primary)]">
                {slip.code}
              </div>
              <div className="mt-1 text-sm font-semibold text-[var(--text-muted)]">
                {slip.guest_name} · Total {formatPaise(slip.total_paise)}
              </div>

              <div className="mt-5 rounded-2xl border border-[var(--border)] bg-white p-4 shadow-sm">
                <img
                  src={slip.qrDataUrl}
                  alt={`QR code for order ${slip.code}`}
                  className="h-48 w-48"
                />
                <div className="mt-2 text-xs font-bold text-neutral-600 tabular-nums">
                  Manual OTP: {slip.otp}
                </div>
              </div>

              <ul className="mt-5 w-full max-w-sm space-y-1.5 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-4 text-left text-sm">
                {slip.items.map((line) => (
                  <li key={line.name} className="flex justify-between font-semibold">
                    <span>
                      {line.qty}× {line.name}
                    </span>
                    <span className="tabular-nums">
                      {formatPaise(line.price_paise * line.qty)}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="mt-6 flex w-full max-w-sm gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setSlip(null)
                    setQuantities({})
                    setGuestName('')
                  }}
                  className="min-h-[48px] flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-sm font-bold text-[var(--text)] hover:border-[var(--primary)] cursor-pointer"
                >
                  New Walk-in
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-[48px] flex-1 rounded-xl bg-[var(--primary)] text-sm font-bold text-white hover:bg-[var(--primary-hover)] cursor-pointer"
                >
                  Back to Board
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Guest Name + Search + Category Filter */}
              <div className="space-y-3 border-b border-[var(--border)] bg-[var(--surface-2)] p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <input
                    type="text"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder="Guest name (optional)"
                    className="min-h-[48px] rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-medium text-[var(--text)] outline-none focus:border-[var(--primary)]"
                  />
                  <div className="relative flex items-center">
                    <Search className="absolute left-3.5 h-4 w-4 text-[var(--text-muted)]" />
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search in-stock items..."
                      className="min-h-[48px] w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] pl-10 pr-4 text-sm font-medium text-[var(--text)] outline-none focus:border-[var(--primary)]"
                    />
                  </div>
                </div>

                <div className="flex gap-2 overflow-x-auto pb-1">
                  <button
                    type="button"
                    onClick={() => setSelectedCategory('all')}
                    className={`min-h-[40px] shrink-0 rounded-xl px-3.5 text-xs font-bold cursor-pointer ${
                      selectedCategory === 'all'
                        ? 'bg-[var(--primary)] text-white'
                        : 'border border-[var(--border)] bg-[var(--surface)] text-[var(--text)]'
                    }`}
                  >
                    All ({inStockItems.length})
                  </button>
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`min-h-[40px] shrink-0 rounded-xl px-3.5 text-xs font-bold cursor-pointer ${
                        selectedCategory === cat.id
                          ? 'bg-[var(--primary)] text-white'
                          : 'border border-[var(--border)] bg-[var(--surface)] text-[var(--text)]'
                      }`}
                    >
                      {cat.icon ? `${cat.icon} ` : ''}
                      {cat.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* POS Grid */}
              <div className="flex-1 overflow-y-auto p-4">
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4">
                  {filteredItems.map((item) => {
                    const qty = quantities[item.id] ?? 0
                    return (
                      <div
                        key={item.id}
                        className={`flex flex-col justify-between rounded-2xl border-2 p-3 transition-colors ${
                          qty > 0
                            ? 'border-[var(--primary)] bg-[var(--primary-soft)]/50'
                            : 'border-[var(--border)] bg-[var(--surface-2)]'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => adjustQty(item.id, 1)}
                          className="min-h-[52px] text-left cursor-pointer"
                        >
                          <div className="text-sm font-extrabold text-[var(--text)] line-clamp-2">
                            {item.name}
                          </div>
                          <div className="mt-1 text-base font-black text-[var(--primary)] tabular-nums">
                            {formatPaise(item.price_paise)}
                          </div>
                        </button>

                        <div className="mt-2.5 flex items-center justify-between gap-1">
                          <button
                            type="button"
                            onClick={() => adjustQty(item.id, -1)}
                            disabled={qty === 0}
                            aria-label={`Decrease ${item.name}`}
                            className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] disabled:opacity-35 cursor-pointer"
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                          <span className="min-w-[24px] text-center text-sm font-black tabular-nums">
                            {qty}
                          </span>
                          <button
                            type="button"
                            onClick={() => adjustQty(item.id, 1)}
                            aria-label={`Increase ${item.name}`}
                            className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] cursor-pointer"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Footer: Payment Method + Total + Submit */}
              <div className="border-t border-[var(--border)] bg-[var(--surface)] px-6 py-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('cash')}
                      className={`flex min-h-[48px] items-center gap-2 rounded-xl border px-4 text-sm font-bold cursor-pointer ${
                        paymentMethod === 'cash'
                          ? 'border-[var(--warning)] bg-[var(--warning)]/15 text-[var(--warning)]'
                          : 'border-[var(--border)] text-[var(--text-muted)]'
                      }`}
                    >
                      <Banknote className="h-4 w-4" />
                      <span>Cash</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('online')}
                      className={`flex min-h-[48px] items-center gap-2 rounded-xl border px-4 text-sm font-bold cursor-pointer ${
                        paymentMethod === 'online'
                          ? 'border-[var(--success)] bg-[var(--success)]/15 text-[var(--success)]'
                          : 'border-[var(--border)] text-[var(--text-muted)]'
                      }`}
                    >
                      <CreditCard className="h-4 w-4" />
                      <span>Online / UPI</span>
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-4 sm:justify-end">
                    <div className="text-right">
                      <div className="text-xs font-semibold text-[var(--text-muted)]">
                        {selectedLines.reduce((s, l) => s + l.qty, 0)} items
                      </div>
                      <div className="text-2xl font-black text-[var(--primary)] tabular-nums">
                        {formatPaise(totalPaise)}
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={submitting || selectedLines.length === 0}
                      onClick={handleSubmit}
                      className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-6 text-sm font-extrabold text-white shadow-sm hover:bg-[var(--primary-hover)] disabled:opacity-50 cursor-pointer"
                    >
                      {submitting ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <span>Place Walk-in Order</span>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
