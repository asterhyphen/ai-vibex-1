'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Bell, CheckCheck, Inbox } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Notification } from '@/lib/types'
import { cn } from '@/lib/utils/format'
import { useOptionalAlerts } from './RealtimeAlertsProvider'

function formatRelativeTime(iso: string): string {
  const diffSec = Math.max(
    0,
    Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  )
  if (diffSec < 60) return 'Just now'
  const mins = Math.floor(diffSec / 60)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

const KIND_ACCENT: Record<Notification['kind'], string> = {
  info: 'bg-[var(--info)]',
  success: 'bg-[var(--success)]',
  warning: 'bg-[var(--warning)]',
  error: 'bg-[var(--danger)]',
}

interface NotificationBellProps {
  className?: string
}

/**
 * Notification bell button with live unread count badge and animated
 * slide-down notification drawer. Fetches from `notifications` and marks
 * unread notifications read when opened.
 */
export function NotificationBell({ className }: NotificationBellProps) {
  const alertsCtx = useOptionalAlerts()
  const [open, setOpen] = useState(false)
  const [localNotifications, setLocalNotifications] = useState<Notification[]>([])
  const [localUserId, setLocalUserId] = useState<string | null>(null)
  const [loadingStandalone, setLoadingStandalone] = useState(false)
  const [highlightedUnreadIds, setHighlightedUnreadIds] = useState<string[]>([])
  const containerRef = useRef<HTMLDivElement>(null)

  const notifications = alertsCtx ? alertsCtx.notifications : localNotifications
  const unreadCount = alertsCtx
    ? alertsCtx.unreadCount
    : localNotifications.filter((n) => !n.read).length
  const isLoading = alertsCtx
    ? alertsCtx.loadingNotifications
    : loadingStandalone

  useEffect(() => {
    if (alertsCtx) return
    if (
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ) {
      return
    }

    let cancelled = false
    const supabase = createClient()

    supabase.auth
      .getUser()
      .then(async ({ data: { user } }) => {
        if (cancelled) return
        if (!user) {
          setLocalUserId(null)
          setLocalNotifications([])
          return
        }
        setLocalUserId(user.id)
        const { data } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(25)
        if (!cancelled && data) {
          setLocalNotifications(data as Notification[])
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingStandalone(false)
      })

    return () => {
      cancelled = true
    }
  }, [alertsCtx])

  const markAllRead = useCallback(async () => {
    setHighlightedUnreadIds([])
    if (alertsCtx) {
      await alertsCtx.markAllRead()
      return
    }
    if (!localUserId) return
    setLocalNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    const supabase = createClient()
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', localUserId)
      .eq('read', false)
  }, [alertsCtx, localUserId])

  const markIdsRead = useCallback(
    async (ids: string[]) => {
      if (ids.length === 0) return
      if (alertsCtx) {
        await alertsCtx.markIdsRead(ids)
        return
      }
      if (!localUserId) return
      setLocalNotifications((prev) =>
        prev.map((n) => (ids.includes(n.id) ? { ...n, read: true } : n))
      )
      const supabase = createClient()
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', localUserId)
        .in('id', ids)
    },
    [alertsCtx, localUserId]
  )

  const handleToggle = () => {
    const nextOpen = !open
    setOpen(nextOpen)

    if (nextOpen) {
      const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id)
      if (unreadIds.length > 0) {
        setHighlightedUnreadIds(unreadIds)
        void markIdsRead(unreadIds)
      }
    } else {
      setHighlightedUnreadIds([])
    }
  }

  // Close on outside click or Escape
  useEffect(() => {
    if (!open) return

    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false)
        setHighlightedUnreadIds([])
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        setHighlightedUnreadIds([])
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  return (
    <div ref={containerRef} className={cn('relative inline-block', className)}>
      <button
        type="button"
        onClick={handleToggle}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={
          unreadCount > 0
            ? `Notifications (${unreadCount} unread)`
            : 'Notifications'
        }
        className="relative inline-flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] shadow-xs transition-all duration-200 hover:border-[var(--primary)] hover:bg-[var(--surface-2)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] cursor-pointer"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[var(--primary)] px-1 text-[10px] font-bold text-white shadow-sm">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-label="Notifications panel"
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="absolute right-0 mt-2 w-[min(92vw,360px)] z-50 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3 bg-[var(--surface-2)]/60">
              <div>
                <h3 className="text-sm font-bold text-[var(--text)]">
                  Notifications
                </h3>
                <p className="text-[11px] text-[var(--text-muted)]">
                  Live order &amp; canteen updates
                </p>
              </div>
              <button
                type="button"
                onClick={() => void markAllRead()}
                disabled={notifications.length === 0}
                className="inline-flex min-h-[36px] items-center gap-1 rounded-lg px-2.5 text-xs font-semibold text-[var(--primary)] hover:bg-[var(--primary-soft)]/70 disabled:opacity-40 transition-colors cursor-pointer"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Mark all read
              </button>
            </div>

            <div className="max-h-[340px] overflow-y-auto divide-y divide-[var(--border)]">
              {isLoading ? (
                <div className="p-6 text-center text-xs text-[var(--text-muted)]">
                  Loading notifications...
                </div>
              ) : notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
                  <Inbox className="h-8 w-8 text-[var(--text-muted)]/60" />
                  <p className="mt-2 text-sm font-semibold text-[var(--text)]">
                    No notifications yet
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                    Order confirmations and ready alerts will appear here.
                  </p>
                </div>
              ) : (
                notifications.map((item) => {
                  const showUnreadDot =
                    !item.read || highlightedUnreadIds.includes(item.id)
                  return (
                    <div
                      key={item.id}
                      className={cn(
                        'flex items-start gap-3 px-4 py-3 transition-colors',
                        showUnreadDot
                          ? 'bg-[var(--primary-soft)]/35'
                          : 'hover:bg-[var(--surface-2)]/50'
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                          showUnreadDot
                            ? KIND_ACCENT[item.kind]
                            : 'bg-[var(--border)]'
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="truncate text-sm font-semibold text-[var(--text)]">
                            {item.title}
                          </p>
                          <span className="shrink-0 text-[11px] text-[var(--text-muted)]">
                            {formatRelativeTime(item.created_at)}
                          </span>
                        </div>
                        {item.body && (
                          <p className="mt-0.5 text-xs leading-relaxed text-[var(--text-muted)]">
                            {item.body}
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
