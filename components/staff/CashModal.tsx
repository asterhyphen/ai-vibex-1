'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertCircle, Banknote, Check, Delete, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import type { OrderWithItems } from '@/lib/types'

interface CashModalProps {
  order: OrderWithItems | null
  onClose: () => void
  onCollected: (updatedOrder: OrderWithItems) => void
}

function formatMoney2(paise: number): string {
  return `₹${(paise / 100).toFixed(2)}`
}

export function CashModal({ order, onClose, onCollected }: CashModalProps) {
  const [rupeeInput, setRupeeInput] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  if (!order) return null

  const totalPaise = order.total_paise ?? 0
  const parsedRupees = rupeeInput === '' ? 0 : Number.parseFloat(rupeeInput)
  const receivedPaise = Number.isFinite(parsedRupees)
    ? Math.round(parsedRupees * 100)
    : 0
  const changePaise = receivedPaise - totalPaise
  const isSufficient = receivedPaise >= totalPaise && totalPaise > 0

  const handleDigit = (digit: string) => {
    setErrorMsg(null)
    setRupeeInput((prev) => {
      if (prev.length >= 6) return prev
      if (prev === '0') return digit
      return `${prev}${digit}`
    })
  }

  const handleBackspace = () => {
    setErrorMsg(null)
    setRupeeInput((prev) => prev.slice(0, -1))
  }

  const handleConfirm = async () => {
    if (!isSufficient) {
      const shortPaise = Math.max(0, totalPaise - receivedPaise)
      setErrorMsg(`Cash received is short by ${formatMoney2(shortPaise)}`)
      return
    }

    setSubmitting(true)
    setErrorMsg(null)
    try {
      const res = await fetch(`/api/staff/orders/${order.id}/cash`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cash_received_paise: receivedPaise }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErrorMsg(data.error || 'Could not record cash payment')
        return
      }
      toast.success(`Cash collected for ${order.code} · Change ${formatMoney2(changePaise)}`)
      setRupeeInput('')
      onCollected(data.order)
      onClose()
    } catch {
      setErrorMsg('Network error while recording cash payment')
    } finally {
      setSubmitting(false)
    }
  }

  const keypadButtons: Array<{
    label: string
    kind: 'digit' | 'backspace' | 'confirm'
    value?: string
  }> = [
    { label: '1', kind: 'digit', value: '1' },
    { label: '2', kind: 'digit', value: '2' },
    { label: '3', kind: 'digit', value: '3' },
    { label: '4', kind: 'digit', value: '4' },
    { label: '5', kind: 'digit', value: '5' },
    { label: '6', kind: 'digit', value: '6' },
    { label: '7', kind: 'digit', value: '7' },
    { label: '8', kind: 'digit', value: '8' },
    { label: '9', kind: 'digit', value: '9' },
    { label: '⌫', kind: 'backspace' },
    { label: '0', kind: 'digit', value: '0' },
    { label: 'Confirm', kind: 'confirm' },
  ]

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 12 }}
          className="w-full max-w-md overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
            <div className="flex items-center gap-2.5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--warning)]/20 text-[var(--warning)]">
                <Banknote className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-lg font-extrabold text-[var(--text)]">
                  Collect Cash · {order.code}
                </h2>
                <p className="text-xs text-[var(--text-muted)]">
                  Confirm cash received to move order to kitchen queue
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close cash modal"
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-4 p-6">
            {/* Totals Banner */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-3.5">
                <div className="text-xs font-semibold text-[var(--text-muted)]">
                  Order Total
                </div>
                <div className="mt-1 text-2xl font-black text-[var(--primary)] tabular-nums">
                  {formatMoney2(totalPaise)}
                </div>
              </div>

              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-3.5">
                <div className="text-xs font-semibold text-[var(--text-muted)]">
                  Change to Return
                </div>
                <div
                  className={`mt-1 text-2xl font-black tabular-nums ${
                    changePaise >= 0 ? 'text-[var(--accent)]' : 'text-[var(--danger)]'
                  }`}
                >
                  {rupeeInput === ''
                    ? '₹0.00'
                    : changePaise >= 0
                      ? formatMoney2(changePaise)
                      : `-${formatMoney2(Math.abs(changePaise))}`}
                </div>
              </div>
            </div>

            {/* Cash Received Display */}
            <div>
              <div className="mb-1.5 flex items-center justify-between text-xs font-bold text-[var(--text-muted)]">
                <span>Cash Received</span>
                <button
                  type="button"
                  onClick={() => {
                    setErrorMsg(null)
                    setRupeeInput(String(Math.ceil(totalPaise / 100)))
                  }}
                  className="font-bold text-[var(--primary)] hover:underline cursor-pointer"
                >
                  Exact ({formatMoney2(totalPaise)})
                </button>
              </div>

              <div className="flex min-h-[56px] items-center justify-between rounded-2xl border-2 border-[var(--primary)]/50 bg-[var(--bg)] px-4">
                <span className="text-2xl font-black text-[var(--text-muted)]">₹</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={rupeeInput}
                  onChange={(e) => {
                    setErrorMsg(null)
                    setRupeeInput(e.target.value.replace(/[^\d]/g, '').slice(0, 6))
                  }}
                  placeholder="0"
                  aria-label="Cash received in rupees"
                  className="w-full bg-transparent text-right text-3xl font-black text-[var(--text)] outline-none tabular-nums"
                />
              </div>

              {/* Quick Tender Notes */}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {[50, 100, 200, 500].map((note) => (
                  <button
                    key={note}
                    type="button"
                    onClick={() => {
                      setErrorMsg(null)
                      setRupeeInput(String(note))
                    }}
                    className="min-h-[38px] flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-xs font-bold text-[var(--text)] hover:border-[var(--primary)] cursor-pointer"
                  >
                    ₹{note}
                  </button>
                ))}
              </div>
            </div>

            {errorMsg && (
              <div className="flex items-center gap-2 rounded-xl border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3.5 py-2.5 text-xs font-bold text-[var(--danger)]">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* 12-button Numeric Keypad */}
            <div className="grid grid-cols-3 gap-2.5">
              {keypadButtons.map((btn) => {
                if (btn.kind === 'confirm') {
                  return (
                    <button
                      key="confirm"
                      type="button"
                      disabled={submitting}
                      onClick={handleConfirm}
                      className="flex min-h-[56px] items-center justify-center gap-1.5 rounded-2xl bg-[var(--success)] text-sm font-extrabold text-white shadow-sm transition-transform active:scale-95 hover:opacity-90 disabled:opacity-50 cursor-pointer"
                    >
                      {submitting ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <>
                          <Check className="h-4 w-4" />
                          <span>Confirm</span>
                        </>
                      )}
                    </button>
                  )
                }

                if (btn.kind === 'backspace') {
                  return (
                    <button
                      key="backspace"
                      type="button"
                      onClick={handleBackspace}
                      aria-label="Backspace"
                      className="flex min-h-[56px] items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] text-lg font-bold text-[var(--text)] transition-transform active:scale-95 hover:border-[var(--primary)] cursor-pointer"
                    >
                      <Delete className="h-5 w-5" />
                    </button>
                  )
                }

                return (
                  <button
                    key={btn.value}
                    type="button"
                    onClick={() => handleDigit(btn.value!)}
                    className="flex min-h-[56px] items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] text-xl font-extrabold text-[var(--text)] transition-transform active:scale-95 hover:border-[var(--primary)] cursor-pointer tabular-nums"
                  >
                    {btn.label}
                  </button>
                )
              })}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
