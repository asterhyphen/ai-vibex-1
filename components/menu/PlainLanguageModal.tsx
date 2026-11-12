'use client'

import { useMemo, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, ArrowRightLeft, Minus, Plus, ShoppingCart, Sparkles, X } from 'lucide-react'
import { toast } from 'sonner'
import type { MenuItem } from '@/lib/types'
import { parseNaturalOrder } from '@/lib/utils/nlp'
import { PlainLanguageOrderSchema } from '@/lib/validators/order'
import { useCartStore } from '@/lib/stores/cart'
import { cn, formatPaise } from '@/lib/utils/format'

interface PlainLanguageModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  menuItems: MenuItem[]
  initialText?: string
  autoParse?: boolean
}

interface EditableParsedEntry {
  key: string
  menuItem: MenuItem
  qty: number
  originalText: string
}

const EXAMPLE_PROMPTS = [
  'two masala dosa and one filter coffee',
  '2x samosa, half a dozen gulab jamun',
  'a couple of idli vada and tea',
]

function parseIntoEntries(input: string, menuItems: MenuItem[]) {
  const parsed = parseNaturalOrder(input, menuItems)
  const matched: EditableParsedEntry[] = []
  const unmatched: string[] = []

  parsed.forEach((entry, idx) => {
    if (entry.matched && entry.menuItem) {
      matched.push({
        key: `${entry.menuItem.id}-${idx}`,
        menuItem: entry.menuItem,
        qty: entry.qty,
        originalText: entry.originalText,
      })
    } else if (entry.originalText) {
      unmatched.push(entry.originalText)
    }
  })

  return { matched, unmatched }
}

function PlainLanguageModalBody({
  menuItems,
  initialText,
  autoParse,
  onClose,
}: {
  menuItems: MenuItem[]
  initialText: string
  autoParse: boolean
  onClose: () => void
}) {
  const addItem = useCartStore((s) => s.addItem)

  const initialParsed = useMemo(() => {
    if (autoParse && initialText.trim()) {
      return parseIntoEntries(initialText.trim(), menuItems)
    }
    return null
  }, [autoParse, initialText, menuItems])

  const [text, setText] = useState(initialText)
  const [matchedEntries, setMatchedEntries] = useState<EditableParsedEntry[]>(
    () => initialParsed?.matched ?? []
  )
  const [unmatchedWords, setUnmatchedWords] = useState<string[]>(
    () => initialParsed?.unmatched ?? []
  )
  const [hasParsed, setHasParsed] = useState<boolean>(() => Boolean(initialParsed))

  const runParse = (input: string) => {
    const validated = PlainLanguageOrderSchema.safeParse({ text: input })
    if (!validated.success) {
      toast.error(validated.error.issues[0]?.message ?? 'Please enter an order description')
      return
    }
    const { matched, unmatched } = parseIntoEntries(validated.data.text, menuItems)
    setMatchedEntries(matched)
    setUnmatchedWords(unmatched)
    setHasParsed(true)
  }

  const getAlternatives = (item: MenuItem): MenuItem[] => {
    const sameCategory = menuItems.filter(
      (candidate) =>
        candidate.in_stock &&
        candidate.is_active !== false &&
        candidate.id !== item.id &&
        candidate.category_id === item.category_id
    )
    if (sameCategory.length >= 2) return sameCategory.slice(0, 2)
    const others = menuItems.filter(
      (candidate) =>
        candidate.in_stock &&
        candidate.is_active !== false &&
        candidate.id !== item.id &&
        !sameCategory.some((s) => s.id === candidate.id)
    )
    return [...sameCategory, ...others].slice(0, 2)
  }

  const updateEntryQty = (key: string, delta: number) => {
    setMatchedEntries((prev) =>
      prev
        .map((entry) =>
          entry.key === key ? { ...entry, qty: Math.min(50, entry.qty + delta) } : entry
        )
        .filter((entry) => entry.qty > 0)
    )
  }

  const swapAlternative = (key: string, replacement: MenuItem) => {
    setMatchedEntries((prev) => {
      const target = prev.find((e) => e.key === key)
      if (!target) return prev
      const alreadyHas = prev.find((e) => e.menuItem.id === replacement.id && e.key !== key)
      if (alreadyHas) {
        return prev
          .map((e) =>
            e.menuItem.id === replacement.id ? { ...e, qty: Math.min(50, e.qty + target.qty) } : e
          )
          .filter((e) => e.key !== key)
      }
      return prev.map((e) => (e.key === key ? { ...e, menuItem: replacement } : e))
    })
    toast.success(`Switched to ${replacement.name}`)
  }

  const inStockEntries = useMemo(
    () => matchedEntries.filter((e) => e.menuItem.in_stock),
    [matchedEntries]
  )

  const outOfStockCount = matchedEntries.length - inStockEntries.length

  const totalPaise = useMemo(
    () => inStockEntries.reduce((sum, e) => sum + e.menuItem.price_paise * e.qty, 0),
    [inStockEntries]
  )

  const totalQty = useMemo(
    () => inStockEntries.reduce((sum, e) => sum + e.qty, 0),
    [inStockEntries]
  )

  const handleConfirmCart = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (inStockEntries.length === 0) {
      toast.error('No in-stock items to add')
      return
    }
    const rect = e.currentTarget.getBoundingClientRect()
    const origin = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }

    inStockEntries.forEach((entry, idx) => {
      addItem(
        {
          menuItemId: entry.menuItem.id,
          name: entry.menuItem.name,
          price_paise: entry.menuItem.price_paise,
          prep_seconds: entry.menuItem.prep_seconds,
          qty: entry.qty,
        },
        idx === 0 ? origin : undefined
      )
    })

    toast.success(`Added ${totalQty} ${totalQty === 1 ? 'item' : 'items'} to your cart`)
    onClose()
  }

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div>
          <Dialog.Title className="flex items-center gap-2 text-lg font-bold text-[var(--text)]">
            <Sparkles className="h-5 w-5 text-[var(--accent)]" />
            Order in plain words
          </Dialog.Title>
          <Dialog.Description className="mt-1 text-xs text-[var(--text-muted)]">
            Type naturally with quantities like &ldquo;two&rdquo;, &ldquo;2x&rdquo;, &ldquo;a couple&rdquo;, or &ldquo;half a dozen&rdquo;.
          </Dialog.Description>
        </div>
        <Dialog.Close asChild>
          <button
            type="button"
            aria-label="Close modal"
            className="inline-flex h-11 w-11 min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] transition-colors hover:bg-[var(--border)]/50"
          >
            <X className="h-5 w-5" />
          </button>
        </Dialog.Close>
      </div>

      {/* Input area */}
      <div className="mt-4 space-y-2.5">
        <textarea
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. two masala dosa and one filter coffee"
          className="w-full resize-none rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-3.5 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:border-[var(--primary)] focus:outline-none"
        />

        <div className="flex flex-wrap items-center gap-1.5">
          {EXAMPLE_PROMPTS.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => {
                setText(example)
                runParse(example)
              }}
              className="cursor-pointer rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-muted)] transition-colors hover:border-[var(--primary)]/40 hover:text-[var(--text)]"
            >
              {example}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => runParse(text)}
          className="inline-flex h-11 min-h-[44px] w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-[var(--primary-hover)]"
        >
          <Sparkles className="h-4 w-4" />
          Parse order
        </button>
      </div>

      {/* Results */}
      {hasParsed && (
        <div className="mt-5 space-y-3 border-t border-[var(--border)] pt-4">
          {unmatchedWords.length > 0 && (
            <div className="flex items-start gap-2.5 rounded-2xl border border-[var(--warning)]/40 bg-[var(--warning)]/12 p-3 text-xs text-[var(--text)]">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--warning)]" />
              <div>
                <span className="font-semibold">Didn&apos;t catch: </span>
                <span>{unmatchedWords.join(', ')}</span>
              </div>
            </div>
          )}

          {matchedEntries.length === 0 ? (
            <p className="rounded-2xl bg-[var(--surface-2)] p-4 text-center text-sm text-[var(--text-muted)]">
              No matching menu items found. Try naming dishes from the menu like &ldquo;samosa&rdquo;, &ldquo;masala dosa&rdquo;, or &ldquo;tea&rdquo;.
            </p>
          ) : (
            <div className="space-y-2.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                Detected items ({matchedEntries.length})
              </p>
              <div className="max-h-60 space-y-2 overflow-y-auto pr-0.5">
                {matchedEntries.map((entry) => {
                  const outOfStock = !entry.menuItem.in_stock
                  const alternatives = outOfStock ? getAlternatives(entry.menuItem) : []
                  return (
                    <div
                      key={entry.key}
                      className={cn(
                        'rounded-2xl border p-3',
                        outOfStock
                          ? 'border-[var(--danger)]/40 bg-[var(--danger)]/6'
                          : 'border-[var(--border)] bg-[var(--surface-2)]/60'
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-semibold text-[var(--text)]">
                              {entry.menuItem.name}
                            </p>
                            {outOfStock && (
                              <span className="shrink-0 rounded-full bg-[var(--danger)] px-2 py-0.5 text-[10px] font-semibold text-white">
                                Out of stock
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-[var(--text-muted)]">
                            {formatPaise(entry.menuItem.price_paise)} each · matched &ldquo;{entry.originalText}&rdquo;
                          </p>
                        </div>

                        <div className="flex items-center gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-0.5">
                          <button
                            type="button"
                            onClick={() => updateEntryQty(entry.key, -1)}
                            aria-label={`Decrease ${entry.menuItem.name}`}
                            className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-[var(--text)] hover:bg-[var(--surface-2)]"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span className="min-w-[1.5rem] text-center text-sm font-bold text-[var(--text)]">
                            {entry.qty}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateEntryQty(entry.key, 1)}
                            aria-label={`Increase ${entry.menuItem.name}`}
                            className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-[var(--text)] hover:bg-[var(--surface-2)]"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      {outOfStock && alternatives.length > 0 && (
                        <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-[var(--border)]/60 pt-2">
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--text-muted)]">
                            <ArrowRightLeft className="h-3 w-3" />
                            Try instead:
                          </span>
                          {alternatives.map((alt) => (
                            <button
                              key={alt.id}
                              type="button"
                              onClick={() => swapAlternative(entry.key, alt)}
                              className="cursor-pointer rounded-full border border-[var(--primary)]/35 bg-[var(--surface)] px-2.5 py-1 text-[11px] font-semibold text-[var(--primary)] transition-colors hover:bg-[var(--primary-soft)]"
                            >
                              {alt.name} ({formatPaise(alt.price_paise)})
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {outOfStockCount > 0 && (
                <p className="text-[11px] text-[var(--text-muted)]">
                  Out-of-stock items won&apos;t be added unless you swap them above.
                </p>
              )}

              <button
                type="button"
                disabled={inStockEntries.length === 0}
                onClick={handleConfirmCart}
                className="mt-2 inline-flex h-12 min-h-[44px] w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[var(--primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ShoppingCart className="h-4 w-4" />
                <span>
                  Add to cart · {totalQty} {totalQty === 1 ? 'item' : 'items'} ({formatPaise(totalPaise)})
                </span>
              </button>
            </div>
          )}
        </div>
      )}
    </>
  )
}

export function PlainLanguageModal({
  open,
  onOpenChange,
  menuItems,
  initialText = '',
  autoParse = false,
}: PlainLanguageModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs"
              />
            </Dialog.Overlay>

            <Dialog.Content asChild>
              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 16 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-x-3 bottom-3 z-50 max-h-[88vh] overflow-y-auto rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xl focus:outline-none sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-full sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:p-6"
              >
                <PlainLanguageModalBody
                  key={`${initialText}-${autoParse}`}
                  menuItems={menuItems}
                  initialText={initialText}
                  autoParse={autoParse}
                  onClose={() => onOpenChange(false)}
                />
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  )
}
