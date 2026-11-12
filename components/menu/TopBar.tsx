'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Bell, CheckCheck, History, Printer, Sparkles, UtensilsCrossed } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { ThemeToggle } from '@/components/auth/ThemeToggle'
import { createClient } from '@/lib/supabase/client'
import type { Notification, Profile } from '@/lib/types'
import { cn, getTimeGreeting } from '@/lib/utils/format'

interface TopBarProps {
  profile: Profile | null
  email?: string | null
  initialNotifications: Notification[]
}

export function TopBar({ profile, email, initialNotifications }: TopBarProps) {
  const [notifications, setNotifications] = useState<Notification[]>(initialNotifications)
  const [notifOpen, setNotifOpen] = useState(false)

  const unreadCount = notifications.filter((n) => !n.read).length

  const displayFirstName = (() => {
    const full = profile?.full_name?.trim()
    if (full) return full.split(/\s+/)[0]
    if (email) return email.split('@')[0]
    return 'Friend'
  })()

  const initials = (() => {
    const full = profile?.full_name?.trim() || displayFirstName
    const parts = full.split(/\s+/)
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    }
    return full.slice(0, 2).toUpperCase()
  })()

  const greeting = getTimeGreeting()

  const markAllRead = async () => {
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id)
    if (unreadIds.length === 0) return

    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))

    if (
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ) {
      try {
        const supabase = createClient()
        await supabase.from('notifications').update({ read: true }).in('id', unreadIds)
      } catch {
        // Ignore network errors on optimistic mark read
      }
    }
  }

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--bg)]/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        {/* Left: Greeting & Role */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Link
              href="/home"
              className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--primary)] text-white shadow-xs sm:inline-flex"
              aria-label="MITE Canteen Home"
            >
              <UtensilsCrossed className="h-4 w-4" />
            </Link>
            <div className="min-w-0">
              <h1 className="truncate text-base font-bold text-[var(--text)] sm:text-xl">
                {greeting}, {displayFirstName}! 👋
              </h1>
              <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                <span>MITE Campus Canteen</span>
                {profile?.role === 'faculty' && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[var(--accent)]/15 px-2 py-0.5 text-[10px] font-semibold text-[var(--accent)]">
                    <Sparkles className="h-2.5 w-2.5" />
                    Faculty Priority
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Center/Right quick links on desktop */}
        <nav className="hidden items-center gap-1 md:flex" aria-label="Student navigation">
          <Link
            href="/home"
            className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[var(--primary-soft)] px-3 text-sm font-semibold text-[var(--primary)]"
          >
            Menu
          </Link>
          <Link
            href="/history"
            className="inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-medium text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
          >
            <History className="h-4 w-4" />
            History
          </Link>
          <Link
            href="/print"
            className="inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-medium text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
          >
            <Printer className="h-4 w-4" />
            Print
          </Link>
        </nav>

        {/* Right actions */}
        <div className="relative flex items-center gap-2">
          {/* Notification Bell */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setNotifOpen((o) => !o)}
              aria-label={`Notifications (${unreadCount} unread)`}
              className="relative inline-flex h-11 w-11 min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] shadow-xs transition-colors hover:border-[var(--primary)] hover:bg-[var(--surface-2)]"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-[var(--primary)] px-1 text-[10px] font-bold text-white shadow-xs">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            <AnimatePresence>
              {notifOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.96 }}
                  transition={{ duration: 0.16 }}
                  className="absolute right-0 top-13 z-50 w-80 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xl"
                >
                  <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
                    <span className="text-sm font-bold text-[var(--text)]">Notifications</span>
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={markAllRead}
                        className="inline-flex cursor-pointer items-center gap-1 text-xs font-semibold text-[var(--primary)] hover:underline"
                      >
                        <CheckCheck className="h-3.5 w-3.5" />
                        Mark read
                      </button>
                    )}
                  </div>
                  <div className="max-h-72 divide-y divide-[var(--border)] overflow-y-auto">
                    {notifications.length === 0 ? (
                      <p className="p-6 text-center text-xs text-[var(--text-muted)]">
                        You&apos;re all caught up! Order updates appear here.
                      </p>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          className={cn(
                            'px-4 py-3 text-xs transition-colors',
                            !n.read && 'bg-[var(--primary-soft)]/45'
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-semibold text-[var(--text)]">{n.title}</p>
                            {!n.read && (
                              <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--primary)]" />
                            )}
                          </div>
                          {n.body && (
                            <p className="mt-0.5 text-[var(--text-muted)]">{n.body}</p>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                  <div className="border-t border-[var(--border)] bg-[var(--surface-2)]/50 px-4 py-2 text-center">
                    <Link
                      href="/history"
                      onClick={() => setNotifOpen(false)}
                      className="text-xs font-semibold text-[var(--primary)] hover:underline"
                    >
                      View order history →
                    </Link>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Theme Toggle */}
          <ThemeToggle />

          {/* Profile Avatar */}
          <Link
            href="/profile"
            aria-label="Profile"
            className="inline-flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--primary)] text-sm font-bold text-white shadow-xs transition-transform hover:scale-105"
          >
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={displayFirstName}
                className="h-full w-full object-cover"
              />
            ) : (
              <span>{initials}</span>
            )}
          </Link>
        </div>
      </div>

      {/* Mobile compact quick links */}
      <div className="flex items-center gap-2 border-t border-[var(--border)]/60 px-4 py-2 md:hidden">
        <Link
          href="/home"
          className="inline-flex flex-1 items-center justify-center rounded-lg bg-[var(--primary-soft)] py-1.5 text-xs font-semibold text-[var(--primary)]"
        >
          Menu
        </Link>
        <Link
          href="/history"
          className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-[var(--surface-2)] py-1.5 text-xs font-medium text-[var(--text)]"
        >
          <History className="h-3.5 w-3.5" />
          History
        </Link>
        <Link
          href="/print"
          className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-[var(--surface-2)] py-1.5 text-xs font-medium text-[var(--text)]"
        >
          <Printer className="h-3.5 w-3.5" />
          Print
        </Link>
      </div>
    </header>
  )
}
