'use client'

import { useEffect, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { AnimatePresence, motion } from 'framer-motion'
import { Clock, Minus, Plus, ShoppingBag, Tag, Utensils, X } from 'lucide-react'
import type { MenuItem } from '@/lib/types'
import { cn, formatPaise, formatPrepTime } from '@/lib/utils/format'

interface ItemSheetProps {
  item: MenuItem | null
  categoryName?: string
  onClose: () => void
  onAddToCart: (item: MenuItem, qty: number, origin: { x: number; y: number }) => void
}

export function ItemSheet({
  item,
  categoryName,
  onClose,
  onAddToCart,
}: ItemSheetProps) {
  const [qty, setQty] = useState(1)
  const [imgError, setImgError] = useState(false)

  useEffect(() => {
    setQty(1)
    setImgError(false)
  }, [item?.id])

  const handleConfirm = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!item || !item.in_stock) return
    const rect = e.currentTarget.getBoundingClientRect()
    onAddToCart(item, qty, {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    })
    onClose()
  }

  return (
    <Dialog.Root open={Boolean(item)} onOpenChange={(open) => !open && onClose()}>
      <AnimatePresence>
        {item && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs"
              />
            </Dialog.Overlay>

            <Dialog.Content asChild>
              <motion.div
                initial={{ y: '100%', opacity: 0.6 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: '100%', opacity: 0 }}
                transition={{ type: 'spring', damping: 30, stiffness: 320 }}
                className="fixed inset-x-0 bottom-0 z-50 max-h-[90vh] overflow-y-auto rounded-t-3xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl focus:outline-none sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-full sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl"
              >
                {/* Drag handle on mobile */}
                <div className="flex justify-center pt-3 sm:hidden">
                  <div className="h-1.5 w-12 rounded-full bg-[var(--border)]" />
                </div>

                {/* Image / Gradient Hero */}
                <motion.div
                  layoutId={`menu-image-${item.id}`}
                  className="relative mt-2 h-52 w-full overflow-hidden bg-gradient-to-br from-[var(--primary)]/20 via-[var(--accent)]/15 to-[var(--surface-2)] sm:mt-0"
                >
                  {item.image_url && !imgError ? (
                    <img
                      src={item.image_url}
                      alt={item.name}
                      onError={() => setImgError(true)}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <div className="flex h-20 w-20 items-center justify-center rounded-3xl border border-[var(--border)] bg-[var(--surface)]/80 text-[var(--primary)] shadow-md backdrop-blur-sm">
                        <Utensils className="h-10 w-10" />
                      </div>
                    </div>
                  )}

                  <Dialog.Close asChild>
                    <button
                      type="button"
                      aria-label="Close item details"
                      className="absolute right-3 top-3 inline-flex h-11 w-11 min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)]/90 text-[var(--text)] shadow-sm backdrop-blur-sm transition-colors hover:bg-[var(--surface-2)]"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </Dialog.Close>

                  {categoryName && (
                    <span className="absolute bottom-3 left-4 rounded-full border border-[var(--border)] bg-[var(--surface)]/90 px-3 py-1 text-xs font-semibold text-[var(--text)] backdrop-blur-sm">
                      {categoryName}
                    </span>
                  )}
                </motion.div>

                {/* Content */}
                <div className="space-y-4 p-5 sm:p-6">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Dialog.Title className="text-xl font-bold text-[var(--text)]">
                        {item.name}
                      </Dialog.Title>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-2)] px-2.5 py-1 text-xs font-medium text-[var(--text)]">
                          <Clock className="h-3.5 w-3.5 text-[var(--accent)]" />
                          {formatPrepTime(item.prep_seconds)}
                        </span>
                        <span
                          className={cn(
                            'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold',
                            item.in_stock
                              ? 'bg-[var(--success)]/12 text-[var(--success)]'
                              : 'bg-[var(--danger)]/12 text-[var(--danger)]'
                          )}
                        >
                          <span
                            className={cn(
                              'h-1.5 w-1.5 rounded-full',
                              item.in_stock ? 'bg-[var(--success)]' : 'bg-[var(--danger)]'
                            )}
                          />
                          {item.in_stock ? 'In stock' : 'Currently unavailable'}
                        </span>
                      </div>
                    </div>

                    <p className="text-2xl font-bold text-[var(--primary)]">
                      {formatPaise(item.price_paise)}
                    </p>
                  </div>

                  <Dialog.Description className="text-sm leading-relaxed text-[var(--text-muted)]">
                    {item.description?.trim() ||
                      `Freshly prepared ${item.name.toLowerCase()} from the MITE canteen kitchen. Ready for pickup at your chosen slot.`}
                  </Dialog.Description>

                  {item.tags && item.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {item.tags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1 text-xs font-medium text-[var(--text-muted)]"
                        >
                          <Tag className="h-3 w-3" />
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Qty Stepper + Add Button */}
                  <div className="flex items-center gap-3 pt-2">
                    <div className="inline-flex items-center rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-1">
                      <button
                        type="button"
                        onClick={() => setQty((q) => Math.max(1, q - 1))}
                        disabled={qty <= 1 || !item.in_stock}
                        aria-label="Decrease quantity"
                        className="inline-flex h-10 w-10 min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center rounded-lg text-[var(--text)] transition-colors hover:bg-[var(--surface)] disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="min-w-[2.25rem] text-center text-base font-bold text-[var(--text)]">
                        {qty}
                      </span>
                      <button
                        type="button"
                        onClick={() => setQty((q) => Math.min(20, q + 1))}
                        disabled={!item.in_stock}
                        aria-label="Increase quantity"
                        className="inline-flex h-10 w-10 min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center rounded-lg text-[var(--text)] transition-colors hover:bg-[var(--surface)] disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>

                    <button
                      type="button"
                      disabled={!item.in_stock}
                      onClick={handleConfirm}
                      className={cn(
                        'inline-flex h-12 min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold shadow-sm transition-all',
                        item.in_stock
                          ? 'cursor-pointer bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] active:scale-[0.98]'
                          : 'cursor-not-allowed border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-muted)]'
                      )}
                    >
                      <ShoppingBag className="h-4 w-4" />
                      <span>
                        {item.in_stock
                          ? `Add to cart · ${formatPaise(item.price_paise * qty)}`
                          : 'Out of stock'}
                      </span>
                    </button>
                  </div>
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  )
}
