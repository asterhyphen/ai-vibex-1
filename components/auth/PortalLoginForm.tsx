'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  AlertTriangle,
  ArrowLeft,
  Clock,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
} from 'lucide-react'
import { toast } from 'sonner'
import { ThemeToggle } from '@/components/auth/ThemeToggle'
import type { PortalAuthResult } from '@/lib/auth/portal-login'
import { PortalLoginSchema } from '@/lib/validators/auth'

const emptySubscribe = () => () => {}

interface PortalLoginFormProps {
  portal: 'staff' | 'admin'
  heading: string
  subtitle: string
  placeholderEmail: string
  initialLastLoginAt: string | null
  onAuthenticate: (input: {
    email: string
    password: string
  }) => Promise<PortalAuthResult>
}

function formatLoginTimestamp(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

export function PortalLoginForm({
  portal,
  heading,
  subtitle,
  placeholderEmail,
  initialLastLoginAt,
  onAuthenticate,
}: PortalLoginFormProps) {
  const router = useRouter()
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  )

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [lockedUntil, setLockedUntil] = useState<string | null>(null)
  const [nowMs, setNowMs] = useState<number>(0)
  const [lastLoginAt, setLastLoginAt] = useState<string | null>(initialLastLoginAt)

  const formattedLastLogin =
    mounted && lastLoginAt ? formatLoginTimestamp(lastLoginAt) : null

  useEffect(() => {
    if (!lockedUntil) return
    const init = window.setTimeout(() => {
      setNowMs(Date.now())
    }, 0)
    const timer = window.setInterval(() => {
      setNowMs(Date.now())
    }, 10_000)
    return () => {
      window.clearTimeout(init)
      window.clearInterval(timer)
    }
  }, [lockedUntil])

  const lockedUntilMs = lockedUntil ? Date.parse(lockedUntil) : Number.NaN
  const remainingMs =
    nowMs > 0 && !Number.isNaN(lockedUntilMs) ? lockedUntilMs - nowMs : 0
  const isLocked = Boolean(lockedUntil) && remainingMs > 0
  const minutesLeft = isLocked ? Math.max(1, Math.ceil(remainingMs / 60_000)) : 0
  const lockMessage = isLocked
    ? `Account locked. Try again in ${minutesLeft} ${
        minutesLeft === 1 ? 'minute' : 'minutes'
      }.`
    : null

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (submitting || isLocked) return

    const parsed = PortalLoginSchema.safeParse({ email, password })
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message || 'Enter your email and password')
      return
    }

    setSubmitting(true)
    try {
      const result = await onAuthenticate(parsed.data)

      if (!result.success) {
        if (result.lockedUntil) {
          setNowMs(Date.now())
          setLockedUntil(result.lockedUntil)
        }
        toast.error(result.error || 'Sign in failed')
        return
      }

      if (result.lastLoginAt) {
        setLastLoginAt(result.lastLoginAt)
        toast.success(`Signed in · Last login: ${formatLoginTimestamp(result.lastLoginAt)}`)
      } else {
        toast.success('Signed in successfully')
      }

      router.push(result.redirect || (portal === 'admin' ? '/admin' : '/staff'))
      router.refresh()
    } catch {
      toast.error('Unable to sign in right now')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg)] text-[var(--text)]">
      <header className="mx-auto w-full max-w-5xl px-4 sm:px-6 pt-5 flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl px-3 text-sm font-medium text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)] transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Home</span>
        </Link>
        <ThemeToggle />
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-8 sm:py-12">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 sm:p-8 shadow-xl"
        >
          <div className="flex items-start gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--primary)] text-white shadow-sm">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-widest text-[var(--accent)]">
                {portal === 'admin' ? 'Admin Portal' : 'Staff Portal'}
              </span>
              <h1 className="mt-0.5 text-xl sm:text-2xl font-extrabold tracking-tight text-[var(--text)]">
                {heading}
              </h1>
              <p className="mt-1 text-xs sm:text-sm text-[var(--text-muted)]">
                {subtitle}
              </p>
            </div>
          </div>

          {formattedLastLogin && (
            <div className="mt-5 flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3.5 py-2.5 text-xs text-[var(--text-muted)]">
              <Clock className="h-4 w-4 shrink-0 text-[var(--accent)]" />
              <span>
                Last login:{' '}
                <strong className="font-semibold text-[var(--text)]">
                  {formattedLastLogin}
                </strong>
              </span>
            </div>
          )}

          {lockMessage && (
            <div
              role="alert"
              className="mt-5 flex items-start gap-2.5 rounded-xl border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3.5 py-3 text-xs sm:text-sm font-medium text-[var(--danger)]"
            >
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{lockMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
            <div>
              <label
                htmlFor={`${portal}-email`}
                className="block text-sm font-semibold text-[var(--text)]"
              >
                Email
              </label>
              <div className="relative mt-1.5">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
                  <Mail className="h-4 w-4" />
                </span>
                <input
                  id={`${portal}-email`}
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={submitting || isLocked}
                  placeholder={placeholderEmail}
                  className="h-12 min-h-[44px] w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] pl-10 pr-4 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)]/60 outline-none transition-all focus:border-[var(--primary)] focus:ring-3 focus:ring-[var(--primary)]/15 disabled:opacity-60"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor={`${portal}-password`}
                className="block text-sm font-semibold text-[var(--text)]"
              >
                Password
              </label>
              <div className="relative mt-1.5">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
                  <Lock className="h-4 w-4" />
                </span>
                <input
                  id={`${portal}-password`}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={submitting || isLocked}
                  placeholder="Enter your password"
                  className="h-12 min-h-[44px] w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] pl-10 pr-12 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)]/60 outline-none transition-all focus:border-[var(--primary)] focus:ring-3 focus:ring-[var(--primary)]/15 disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-1 top-1/2 -translate-y-1/2 inline-flex h-10 w-10 min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--text)] transition-colors cursor-pointer"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting || isLocked}
              className="mt-2 inline-flex h-12 min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[var(--primary-hover)] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Signing in…</span>
                </>
              ) : (
                <span>
                  {portal === 'admin' ? 'Sign in to Admin' : 'Sign in to Kitchen Board'}
                </span>
              )}
            </button>
          </form>

          <div className="mt-6 border-t border-[var(--border)] pt-4 flex items-center justify-between text-xs text-[var(--text-muted)]">
            <Link
              href="/login"
              className="inline-flex min-h-[44px] items-center font-medium hover:text-[var(--text)] transition-colors"
            >
              ← Student &amp; Faculty OTP
            </Link>
            <Link
              href={portal === 'admin' ? '/staff/login' : '/admin/login'}
              className="inline-flex min-h-[44px] items-center font-medium text-[var(--primary)] hover:underline"
            >
              {portal === 'admin' ? 'Staff Login →' : 'Admin Login →'}
            </Link>
          </div>
        </motion.div>
      </main>
    </div>
  )
}
