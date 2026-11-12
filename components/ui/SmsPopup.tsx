'use client'

import { useEffect, useSyncExternalStore } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Copy, MessageSquare, X } from 'lucide-react'
import { cn } from '@/lib/utils/format'

export interface SmsMessage {
  id: string
  sender?: string
  body: string
  code?: string
  kind?: 'info' | 'success' | 'warning' | 'error'
  durationMs?: number
  onAutofill?: (code: string) => void
}

interface SmsBubbleProps {
  message: SmsMessage
  queuedCount?: number
  onDismiss: (id: string) => void
}

function subscribeMediaQuery(callback: () => void) {
  const mq = window.matchMedia('(min-width: 640px)')
  mq.addEventListener('change', callback)
  return () => mq.removeEventListener('change', callback)
}

function useIsDesktop() {
  return useSyncExternalStore(
    subscribeMediaQuery,
    () => window.matchMedia('(min-width: 640px)').matches,
    () => true
  )
}

function SmsBubble({ message, queuedCount = 0, onDismiss }: SmsBubbleProps) {
  const isDesktop = useIsDesktop()
  const durationMs = message.durationMs ?? 8000

  useEffect(() => {
    const timer = window.setTimeout(() => {
      onDismiss(message.id)
    }, durationMs)
    return () => window.clearTimeout(timer)
  }, [message.id, durationMs, onDismiss])

  const badgeColor =
    message.kind === 'error'
      ? 'bg-[#FF453A]'
      : message.kind === 'warning'
        ? 'bg-[#FF9F0A]'
        : 'bg-[#34C759]'

  return (
    <motion.aside
      key={message.id}
      role="status"
      aria-live="polite"
      initial={
        isDesktop
          ? { opacity: 0, x: 110, y: 0, scale: 0.96 }
          : { opacity: 0, x: 0, y: 90, scale: 0.97 }
      }
      animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
      exit={
        isDesktop
          ? { opacity: 0, x: 110, y: 0, scale: 0.96 }
          : { opacity: 0, x: 0, y: 90, scale: 0.97 }
      }
      transition={{ type: 'spring', stiffness: 320, damping: 28 }}
      className={cn(
        'fixed z-50 left-3 right-3 bottom-3',
        'sm:left-auto sm:bottom-auto sm:top-5 sm:right-5 sm:w-[368px]'
      )}
    >
      <div className="relative overflow-hidden rounded-[22px] border border-white/15 bg-[#1C1C1E]/95 text-white shadow-2xl backdrop-blur-xl p-3.5">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-sm',
              badgeColor
            )}
          >
            <MessageSquare className="h-5 w-5 fill-current" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-white/90">
                <span aria-hidden="true">📱</span>
                <span>{message.sender ?? 'MITE Canteen'}</span>
                {queuedCount > 0 && (
                  <span className="rounded-full bg-white/15 px-1.5 py-0.5 text-[10px] font-medium text-white/80">
                    +{queuedCount} queued
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1">
                <span className="text-[11px] text-white/50">now</span>
                <button
                  type="button"
                  onClick={() => onDismiss(message.id)}
                  aria-label="Dismiss SMS notification"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full text-white/60 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <p className="mt-1 text-sm leading-snug text-white/95">
              {message.body}
              {message.code && (
                <>
                  {' '}
                  <span className="font-mono text-base font-bold tracking-widest text-[#34C759]">
                    {message.code}
                  </span>
                </>
              )}
            </p>

            {message.code && message.onAutofill && (
              <div className="mt-2 flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => message.onAutofill?.(message.code!)}
                  className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-white/25 transition-colors cursor-pointer"
                >
                  <Copy className="h-3 w-3" />
                  Tap to fill
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Auto-dismiss countdown progress */}
        <motion.div
          key={`bar-${message.id}`}
          initial={{ scaleX: 1 }}
          animate={{ scaleX: 0 }}
          transition={{ duration: durationMs / 1000, ease: 'linear' }}
          style={{ transformOrigin: 'left' }}
          className={cn('mt-2.5 h-0.5 w-full rounded-full opacity-80', badgeColor)}
        />
      </div>
    </motion.aside>
  )
}

interface SmsPopupQueueProps {
  messages: SmsMessage[]
  onDismiss: (id: string) => void
}

/**
 * Displays queued iPhone-style SMS notifications sequentially,
 * auto-dismissing each bubble after 8 seconds.
 */
export function SmsPopupQueue({ messages, onDismiss }: SmsPopupQueueProps) {
  const current = messages[0]

  return (
    <AnimatePresence mode="wait">
      {current && (
        <SmsBubble
          key={current.id}
          message={current}
          queuedCount={Math.max(0, messages.length - 1)}
          onDismiss={onDismiss}
        />
      )}
    </AnimatePresence>
  )
}

interface SmsPopupProps {
  open: boolean
  body?: string
  code?: string | null
  sender?: string
  kind?: SmsMessage['kind']
  durationMs?: number
  onClose: () => void
  onAutofill?: (code: string) => void
}

/**
 * Standalone single SMS popup wrapper for direct usage.
 */
export function SmsPopup({
  open,
  body,
  code,
  sender = 'MITE Canteen',
  kind = 'info',
  durationMs = 8000,
  onClose,
  onAutofill,
}: SmsPopupProps) {
  const activeMessage: SmsMessage | null = open
    ? {
        id: `${code ?? 'msg'}-${body ?? ''}`,
        sender,
        body: body ?? (code ? 'Your verification code:' : ''),
        code: code ?? undefined,
        kind,
        durationMs,
        onAutofill,
      }
    : null

  return (
    <AnimatePresence>
      {activeMessage && (
        <SmsBubble
          key={activeMessage.id}
          message={activeMessage}
          onDismiss={() => onClose()}
        />
      )}
    </AnimatePresence>
  )
}
