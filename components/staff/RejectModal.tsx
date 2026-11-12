'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Loader2, X, XCircle } from 'lucide-react'

interface RejectModalProps {
  open: boolean
  title: string
  presets?: string[]
  submitting?: boolean
  onClose: () => void
  onConfirm: (reason: string) => Promise<void> | void
}

const DEFAULT_PRESETS = [
  'Item just sold out',
  'Kitchen overloaded at this slot',
  'Counter closing soon',
  'Unable to fulfil custom note',
]

export function RejectModal({
  open,
  title,
  presets = DEFAULT_PRESETS,
  submitting = false,
  onClose,
  onConfirm,
}: RejectModalProps) {
  const [reason, setReason] = useState('')

  if (!open) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (reason.trim().length < 2) return
    await onConfirm(reason.trim())
    setReason('')
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 12 }}
          className="w-full max-w-md overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl"
        >
          <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
            <div className="flex items-center gap-2.5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--danger)]/15 text-[var(--danger)]">
                <XCircle className="h-5 w-5" />
              </span>
              <h2 className="text-lg font-extrabold text-[var(--text)]">{title}</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close reject modal"
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 p-6">
            <div>
              <div className="mb-2 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Quick Reasons
              </div>
              <div className="flex flex-wrap gap-2">
                {presets.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setReason(preset)}
                    className={`min-h-[38px] rounded-xl border px-3 text-xs font-bold transition-colors cursor-pointer ${
                      reason === preset
                        ? 'border-[var(--danger)] bg-[var(--danger)]/15 text-[var(--danger)]'
                        : 'border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] hover:border-[var(--danger)]/50'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Rejection Reason (sent to customer)
              </label>
              <textarea
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Explain why this cannot be fulfilled..."
                required
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3 text-sm text-[var(--text)] outline-none focus:border-[var(--danger)]"
              />
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="min-h-[48px] flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-sm font-bold text-[var(--text)] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || reason.trim().length < 2}
                className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--danger)] text-sm font-extrabold text-white hover:opacity-90 disabled:opacity-50 cursor-pointer"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <span>Confirm Reject</span>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
