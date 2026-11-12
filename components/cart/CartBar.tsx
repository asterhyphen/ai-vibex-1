'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, ChevronUp, Minus, Plus, ShoppingCart, Trash2 } from 'lucide-react'
import { useCartStore } from '@/lib/stores/cart'
import { formatPaise } from '@/lib/utils/format'

interface ActiveFlyout {
  id: number
  startX: number
  startY: number
  targetX: number
  targetY: number
}

export function CartBar() {
  const items = useCartStore((s) => s.items)
  const total_paise = useCartStore((s) => s.total_paise)
  const total_items = useCartStore((s) => s.total_items)
  const hasHydrated = useCartStore((s) => s.hasHydrated)
  const lastAddedAt = useCartStore((s) => s.lastAddedAt)
  const flyoutEvent = useCartStore((s) => s.flyoutEvent)
  const updateQty = useCartStore((s) => s.updateQty)
  const clearCart = useCartStore((s) => s.clearCart)
  const clearFlyout = useCartStore((s) => s.clearFlyout)

  const [mounted, setMounted] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [flyout, setFlyout] = useState<ActiveFlyout | null>(null)
  const [badgeBounceKey, setBadgeBounceKey] = useState(0)
  const cartIconRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!lastAddedAt) return
    setBadgeBounceKey((k) => k + 1)
  }, [lastAddedAt])

  useEffect(() => {
    if (!flyoutEvent || typeof window === 'undefined') return

    const iconRect = cartIconRef.current?.getBoundingClientRect()
    const targetX = iconRect
      ? iconRect.left + iconRect.width / 2
      : Math.max(48, window.innerWidth * 0.25)
    const targetY = iconRect
      ? iconRect.top + iconRect.height / 2
      : window.innerHeight - 44

    setFlyout({
      id: flyoutEvent.id,
      startX: flyoutEvent.x,
      startY: flyoutEvent.y,
      targetX,
      targetY,
    })

    const timer = window.setTimeout(() => {
      setFlyout(null)
      clearFlyout()
    }, 560)

    return () => window.clearTimeout(timer)
  }, [flyoutEvent, clearFlyout])

  useEffect(() => {
    if (total_items === 0) {
      setDrawerOpen(false)
    }
  }, [total_items])

  const ready = mounted && (hasHydrated || items.length > 0)

  return (
    <>
      {/* Arc Flyout Animation Layer */}
      <AnimatePresence>
        {flyout && (
          <motion.div
            key={flyout.id}
            aria-hidden="true"
            initial={{
              x: flyout.startX - 14,
              y: flyout.startY - 14,
              scale: 1,
              opacity: 1,
            }}
            animate={{
              x: [
                flyout.startX - 14,
                (flyout.startX + flyout.targetX) / 2 - 14,
                flyout.targetX - 14,
              ],
              y: [
                flyout.startY - 14,
                Math.min(flyout.startY, flyout.targetY) - 96,
                flyout.targetY - 14,
              ],
              scale: [1, 1.25, 0.45],
              opacity: [1, 1, 0.15],
            }}
            exit={{ opacity: 0 }}
            transition={{
              duration: 0.54,
              times: [0, 0.48, 1],
              ease: 'easeInOut',
            }}
            className="pointer-events-none fixed left-0 top-0 z-[70] flex h-7 w-7 items-center justify-center rounded-full border border-white/50 bg-[var(--primary)] text-xs font-bold text-white shadow-lg"
          >
            +1
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sticky Bottom Cart Bar */}
      <AnimatePresence>
        {ready && total_items > 0 && (
          <motion.div
            initial={{ y: 96, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 96, opacity: 0 }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
            className="pointer-events-none fixed inset-x-0 bottom-3 z-40 px-3 sm:bottom-5 sm:px-6"
          >
            <div className="pointer-events-auto mx-auto max-w-2xl">
              {/* Quick Expandable Cart Peek */}
              <AnimatePresence>
                {drawerOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 12, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 12, scale: 0.98 }}
                    transition={{ duration: 0.18 }}
                    className="mb-2 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-2xl"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <h4 className="text-sm font-bold text-[var(--text)]">Your Tray</h4>
                      <button
                        type="button"
                        onClick={clearCart}
                        className="inline-flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-[var(--danger)] hover:bg-[var(--danger)]/10"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Clear
                      </button>
                    </div>
                    <div className="max-h-52 space-y-2 overflow-y-auto pr-1">
                      {items.map((item) => (
                        <div
                          key={item.menuItemId}
                          className="flex items-center justify-between gap-3 rounded-xl bg-[var(--surface-2)]/70 px-3 py-2"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-[var(--text)]">
                              {item.name}
                            </p>
                            <p className="text-xs text-[var(--text-muted)]">
                              {formatPaise(item.price_paise * item.qty)}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-0.5">
                            <button
                              type="button"
                              onClick={() => updateQty(item.menuItemId, item.qty - 1)}
                              aria-label={`Decrease ${item.name}`}
                              className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-[var(--text)] hover:bg-[var(--surface-2)]"
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <span className="min-w-[1.5rem] text-center text-xs font-bold text-[var(--text)]">
                              {item.qty}
                            </span>
                            <button
                              type="button"
                              onClick={() => updateQty(item.menuItemId, item.qty + 1)}
                              aria-label={`Increase ${item.name}`}
                              className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-[var(--text)] hover:bg-[var(--surface-2)]"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Main Bar */}
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--primary)]/30 bg-[var(--primary)] p-2.5 pl-3.5 text-white shadow-xl">
                <button
                  type="button"
                  onClick={() => setDrawerOpen((o) => !o)}
                  className="flex min-h-[44px] flex-1 cursor-pointer items-center gap-3 text-left"
                >
                  <div
                    ref={cartIconRef}
                    data-cart-icon="true"
                    className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15"
                  >
                    <ShoppingCart className="h-5 w-5" />
                    <motion.span
                      key={badgeBounceKey}
                      initial={{ scale: 0.7 }}
                      animate={{ scale: [1, 1.35, 0.92, 1] }}
                      transition={{ duration: 0.35 }}
                      className="absolute -right-1.5 -top-1.5 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-[var(--accent)] px-1 text-[11px] font-bold text-white shadow-xs"
                    >
                      {total_items}
                    </motion.span>
                  </div>

                  <div className="min-w-0">
                    <p className="flex items-center gap-1 text-sm font-semibold sm:text-base">
                      <span>
                        {total_items} {total_items === 1 ? 'item' : 'items'} · {formatPaise(total_paise)}
                      </span>
                      <ChevronUp
                        className={`h-4 w-4 opacity-80 transition-transform ${
                          drawerOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </p>
                    <p className="text-[11px] text-white/80">Tap to review tray</p>
                  </div>
                </button>

                <Link
                  href="/checkout"
                  className="inline-flex h-11 min-h-[44px] shrink-0 items-center gap-1.5 rounded-xl bg-white px-4 text-sm font-bold text-[var(--primary)] shadow-sm transition-transform hover:bg-[var(--bg)] active:scale-95 sm:px-5"
                >
                  <span>Checkout</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
