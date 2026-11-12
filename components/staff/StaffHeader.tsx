'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  ChefHat,
  LogOut,
  PackageCheck,
  Printer,
  QrCode,
  ShoppingBag,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { ThemeToggle } from '@/components/auth/ThemeToggle'

interface StaffHeaderProps {
  staffName: string
  counterType?: 'kitchen' | 'print'
  soundEnabled?: boolean
  onToggleSound?: () => void
  onOpenScanner?: () => void
  onOpenGuestPos?: () => void
}

export function StaffHeader({
  staffName,
  counterType,
  soundEnabled,
  onToggleSound,
  onOpenScanner,
  onOpenGuestPos,
}: StaffHeaderProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [clockText, setClockText] = useState<string>('')
  const [signingOut, setSigningOut] = useState(false)

  useEffect(() => {
    const updateClock = () => {
      setClockText(
        new Date().toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        })
      )
    }
    updateClock()
    const timer = setInterval(updateClock, 1000)
    return () => clearInterval(timer)
  }, [])

  const handleSignOut = async () => {
    setSigningOut(true)
    try {
      await fetch('/api/auth/signout', { method: 'POST' })
    } catch {
      // Ignore network error and redirect anyway
    } finally {
      router.push('/staff/login')
      router.refresh()
    }
  }

  const resolvedCounterType =
    counterType ?? (pathname.startsWith('/staff/print') ? 'print' : 'kitchen')

  const navItems =
    resolvedCounterType === 'print'
      ? [{ href: '/staff/print', label: 'Print Queue', icon: Printer }]
      : [
          { href: '/staff', label: 'Kitchen Board', icon: ChefHat },
          { href: '/staff/stock', label: 'Stock Control', icon: PackageCheck },
        ]

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        {/* Brand & Nav */}
        <div className="flex flex-wrap items-center gap-3 sm:gap-5">
          <Link
            href={resolvedCounterType === 'print' ? '/staff/print' : '/staff'}
            className="flex items-center gap-2.5 rounded-xl pr-2 focus-visible:outline-2 focus-visible:outline-[var(--primary)]"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--primary)] text-white shadow-sm">
              {resolvedCounterType === 'print' ? (
                <Printer className="h-6 w-6" />
              ) : (
                <ChefHat className="h-6 w-6" />
              )}
            </span>
            <div>
              <div className="text-base font-semibold tracking-tight text-[var(--text)] sm:text-lg">
                {resolvedCounterType === 'print' ? 'MITE Print Hub' : 'MITE Kitchen'}
              </div>
              <div className="text-xs font-medium text-[var(--text-muted)]">
                {resolvedCounterType === 'print' ? 'Print Counter' : 'Staff Operations'}
              </div>
            </div>
          </Link>

          <nav className="flex items-center gap-1.5" aria-label="Staff views">
            {navItems.map((item) => {
              const Icon = item.icon
              const active =
                item.href === '/staff'
                  ? pathname === '/staff'
                  : pathname.startsWith(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`inline-flex min-h-[48px] items-center gap-2 rounded-xl px-3.5 text-sm font-semibold transition-all ${
                    active
                      ? 'bg-[var(--primary)] text-white shadow-sm'
                      : 'border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] hover:border-[var(--primary)]'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{item.label}</span>
                </Link>
              )
            })}
          </nav>
        </div>

        {/* Live Clock, Staff Info, Quick Actions */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {onOpenGuestPos && (
            <button
              type="button"
              onClick={onOpenGuestPos}
              className="inline-flex min-h-[48px] items-center gap-2 rounded-xl border border-[var(--accent)] bg-[var(--accent)]/15 px-4 text-sm font-bold text-[var(--text)] transition-colors hover:bg-[var(--accent)]/25 cursor-pointer"
            >
              <ShoppingBag className="h-4 w-4 text-[var(--accent)]" />
              <span>New Walk-in Order</span>
            </button>
          )}

          {onOpenScanner && (
            <button
              type="button"
              onClick={onOpenScanner}
              className="inline-flex min-h-[48px] items-center gap-2 rounded-xl bg-[var(--primary)] px-4 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[var(--primary-hover)] cursor-pointer"
            >
              <QrCode className="h-4 w-4" />
              <span>Scan QR</span>
            </button>
          )}

          {onToggleSound && (
            <button
              type="button"
              onClick={onToggleSound}
              title={soundEnabled ? 'Mute chime alerts' : 'Enable chime alerts'}
              aria-label={soundEnabled ? 'Mute chime alerts' : 'Enable chime alerts'}
              className="inline-flex min-h-[48px] min-w-[48px] items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] transition-colors hover:border-[var(--primary)] cursor-pointer"
            >
              {soundEnabled ? (
                <Volume2 className="h-5 w-5 text-[var(--success)]" />
              ) : (
                <VolumeX className="h-5 w-5 text-[var(--text-muted)]" />
              )}
            </button>
          )}

          <div className="hidden md:flex flex-col items-end rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3.5 py-1.5">
            <span className="text-xs font-bold tabular-nums text-[var(--text)]">
              {clockText || '--:--:--'}
            </span>
            <span className="text-[11px] font-medium text-[var(--text-muted)]">
              {staffName}
            </span>
          </div>

          <ThemeToggle className="min-h-[48px] min-w-[48px] h-12 w-12" />

          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            className="inline-flex min-h-[48px] items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 text-sm font-semibold text-[var(--text)] transition-colors hover:border-[var(--danger)] hover:text-[var(--danger)] disabled:opacity-50 cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden lg:inline">{signingOut ? 'Signing out...' : 'Sign out'}</span>
          </button>
        </div>
      </div>
    </header>
  )
}
