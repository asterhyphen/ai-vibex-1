'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { History, Printer, Sparkles, UtensilsCrossed } from 'lucide-react'
import { ThemeToggle } from '@/components/auth/ThemeToggle'
import { NotificationBell } from '@/components/ui/NotificationBell'
import type { Notification, Profile } from '@/lib/types'
import { getTimeGreeting } from '@/lib/utils/format'

interface TopBarProps {
  profile: Profile | null
  email?: string | null
  initialNotifications?: Notification[]
}

export function TopBar({ profile, email }: TopBarProps) {
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

  const [greeting, setGreeting] = useState('Hello')

  useEffect(() => {
    const id = window.setTimeout(() => {
      setGreeting(getTimeGreeting())
    }, 0)
    return () => window.clearTimeout(id)
  }, [])

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
          <NotificationBell />
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
