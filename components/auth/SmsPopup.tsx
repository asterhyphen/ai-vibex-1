'use client'

import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Copy, MessageSquare, X } from 'lucide-react'

interface SmsPopupProps {
  code: string | null
  open: boolean
  onClose: () => void
  onAutofill?: (code: string) => void
  durationMs?: number
}

export function SmsPopup({
  code,
  open,
  onClose,
  onAutofill,
  durationMs = 8000,
}: SmsPopupProps) {
  useEffect(() => {
    if (!open || !code) return
    const timer = window.setTimeout(() => {
      onClose()
    }, durationMs)
    return () => window.clearTimeout(timer)
  }, [open, code, durationMs, onClose])

  return (
    <AnimatePresence>
      {open && code && (
        <motion.aside
          key={code}
          role="status"
          aria-live="polite"
          initial={{ opacity: 0, x: 100, scale: 0.96 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: 100, scale: 0.96 }}
          transition={{ type: 'spring', stiffness: 320, damping: 28 }}
          className="fixed top-4 right-4 left-4 sm:left-auto sm:top-5 sm:right-5 sm:w-[360px] z-50"
        >
          <div className="relative overflow-hidden rounded-[22px] border border-white/15 bg-[#1C1C1E]/95 text-white shadow-2xl backdrop-blur-xl p-3.5">
            <div className="flex items-start gap-3">
              {/* iOS Messages app badge */}
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#34C759] text-white shadow-sm">
                <MessageSquare className="h-5 w-5 fill-current" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-white/90">
                    <span aria-hidden="true">📱</span>
                    <span>MITE Canteen</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] text-white/50">now</span>
                    <button
                      type="button"
                      onClick={onClose}
                      aria-label="Dismiss SMS notification"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full text-white/60 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <p className="mt-0.5 text-sm leading-snug text-white/95">
                  Your verification code:{' '}
                  <span className="font-mono text-base font-bold tracking-widest text-[#34C759]">
                    {code}
                  </span>
                </p>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <p className="text-xs text-white/60">Valid for 10 minutes.</p>
                  {onAutofill && (
                    <button
                      type="button"
                      onClick={() => onAutofill(code)}
                      className="inline-flex items-center gap-1 rounded-full bg-white/12 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-white/20 transition-colors cursor-pointer"
                    >
                      <Copy className="h-3 w-3" />
                      Tap to fill
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Subtle 8s countdown bar */}
            <motion.div
              initial={{ scaleX: 1 }}
              animate={{ scaleX: 0 }}
              transition={{ duration: durationMs / 1000, ease: 'linear' }}
              style={{ transformOrigin: 'left' }}
              className="mt-2.5 h-0.5 w-full rounded-full bg-[#34C759]/70"
            />
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}
