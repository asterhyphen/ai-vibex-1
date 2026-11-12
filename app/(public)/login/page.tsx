'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Mail,
  RefreshCw,
  ShieldCheck,
  UtensilsCrossed,
  XCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { OtpInput } from '@/components/auth/OtpInput'
import { ThemeToggle } from '@/components/auth/ThemeToggle'
import {
  EmailRequestSchema,
  OtpVerifySchema,
  deriveRoleFromEmail,
  isValidMiteEmail,
  normalizeEmail,
} from '@/lib/validators/auth'

const RESEND_SECONDS = 30
const SAFE_STUDENT_PREFIXES = ['/home', '/checkout', '/orders', '/history', '/print', '/profile']

function getSafeNextPath(nextParam: string | null): string | null {
  if (!nextParam || !nextParam.startsWith('/') || nextParam.startsWith('//')) {
    return null
  }
  return SAFE_STUDENT_PREFIXES.some((prefix) => nextParam.startsWith(prefix))
    ? nextParam
    : null
}

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const nextPath = getSafeNextPath(searchParams.get('next'))

  const [step, setStep] = useState<'email' | 'otp'>('email')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [otpError, setOtpError] = useState(false)
  const [sendingOtp, setSendingOtp] = useState(false)
  const [verifyingOtp, setVerifyingOtp] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)

  const trimmedEmail = normalizeEmail(email)
  const hasTypedEmail = trimmedEmail.length > 0
  const isEmailValid = isValidMiteEmail(trimmedEmail)
  const rolePreview = isEmailValid ? deriveRoleFromEmail(trimmedEmail) : null

  useEffect(() => {
    if (resendCooldown <= 0) return
    const timer = window.setInterval(() => {
      setResendCooldown((prev) => (prev <= 1 ? 0 : prev - 1))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [resendCooldown])

  const requestOtp = async (targetEmail: string): Promise<boolean> => {
    const parsed = EmailRequestSchema.safeParse({ email: targetEmail })
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message || 'Only @mite.ac.in emails allowed')
      return false
    }

    setSendingOtp(true)
    try {
      const response = await fetch('/api/auth/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: parsed.data.email }),
      })

      const data = (await response.json().catch(() => ({}))) as {
        message?: string
        error?: string
        retryAfter?: number
      }

      if (!response.ok) {
        if (response.status === 429 && data.retryAfter) {
          toast.error(`${data.error || 'Too many requests'}. Retry in ${data.retryAfter}s.`)
        } else {
          toast.error(data.error || 'Could not send verification code')
        }
        return false
      }

      toast.success(data.message || 'Verification code ready (Demo OTP: 1234)')
      setResendCooldown(RESEND_SECONDS)
      return true
    } catch {
      toast.error('Network error while sending OTP')
      return false
    } finally {
      setSendingOtp(false)
    }
  }

  const handleEmailSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (sendingOtp) return

    const ok = await requestOtp(trimmedEmail)
    if (ok) {
      setEmail(trimmedEmail)
      setOtp('')
      setOtpError(false)
      setStep('otp')
    }
  }

  const handleResend = async () => {
    if (sendingOtp || resendCooldown > 0) return
    const ok = await requestOtp(trimmedEmail)
    if (ok) {
      setOtp('')
      setOtpError(false)
    }
  }

  const handleVerifySubmit = async (codeOverride?: string) => {
    if (verifyingOtp) return
    const token = (codeOverride ?? otp).trim()
    const parsed = OtpVerifySchema.safeParse({ email: trimmedEmail, token })

    if (!parsed.success) {
      setOtpError(true)
      toast.error(parsed.error.issues[0]?.message || 'Enter the 4-digit OTP')
      return
    }

    setVerifyingOtp(true)
    setOtpError(false)

    try {
      const response = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      })

      const data = (await response.json().catch(() => ({}))) as {
        redirect?: string
        error?: string
      }

      if (!response.ok || !data.redirect) {
        setOtpError(true)
        toast.error(data.error || 'Invalid or expired verification code')
        return
      }

      toast.success('Email verified!')
      const destination =
        data.redirect === '/home' && nextPath ? nextPath : data.redirect
      router.push(destination)
      router.refresh()
    } catch {
      setOtpError(true)
      toast.error('Network error while verifying OTP')
    } finally {
      setVerifyingOtp(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg)] text-[var(--text)]">
      {/* Top header */}
      <header className="mx-auto w-full max-w-5xl px-4 sm:px-6 pt-5 flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl px-3 text-sm font-medium text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)] transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back</span>
        </Link>
        <ThemeToggle />
      </header>

      {/* Center card */}
      <main className="flex-1 flex items-center justify-center px-4 py-8 sm:py-12">
        <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 sm:p-8 shadow-xl overflow-hidden">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--primary)] text-white shadow-sm">
              <UtensilsCrossed className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight text-[var(--text)]">
                MITE Canteen Login
              </h1>
              <p className="text-xs text-[var(--text-muted)]">
                Passwordless sign-in with your college email
              </p>
            </div>
          </div>

          <div className="mt-6">
            <AnimatePresence mode="wait">
              {step === 'email' ? (
                <motion.form
                  key="step-email"
                  initial={{ opacity: 0, x: -24 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -24 }}
                  transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                  onSubmit={handleEmailSubmit}
                  noValidate
                  className="space-y-5"
                >
                  <div>
                    <label
                      htmlFor="college-email"
                      className="block text-sm font-semibold text-[var(--text)]"
                    >
                      College Email Address
                    </label>
                    <div className="relative mt-2">
                      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
                        <Mail className="h-4 w-4" />
                      </span>
                      <input
                        id="college-email"
                        type="email"
                        inputMode="email"
                        autoComplete="email"
                        autoFocus
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="4mt21cs001@mite.ac.in"
                        className={`h-12 min-h-[44px] w-full rounded-xl border bg-[var(--bg)] pl-10 pr-11 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)]/70 outline-none transition-all ${
                          !hasTypedEmail
                            ? 'border-[var(--border)] focus:border-[var(--primary)] focus:ring-3 focus:ring-[var(--primary)]/15'
                            : isEmailValid
                            ? 'border-[var(--success)] focus:ring-3 focus:ring-[var(--success)]/15'
                            : 'border-[var(--danger)] focus:ring-3 focus:ring-[var(--danger)]/15'
                        }`}
                      />
                      {hasTypedEmail && (
                        <span
                          aria-live="polite"
                          className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2"
                        >
                          {isEmailValid ? (
                            <CheckCircle2
                              className="h-5 w-5 text-[var(--success)]"
                              aria-label="Valid MITE email"
                            />
                          ) : (
                            <XCircle
                              className="h-5 w-5 text-[var(--danger)]"
                              aria-label="Invalid email domain"
                            />
                          )}
                        </span>
                      )}
                    </div>

                    <div className="mt-2 min-h-[20px] flex items-center justify-between gap-2 text-xs">
                      {!hasTypedEmail ? (
                        <span className="text-[var(--text-muted)]">
                          Must end with <code className="font-mono">@mite.ac.in</code>
                        </span>
                      ) : isEmailValid ? (
                        <span className="font-medium text-[var(--success)]">
                          Valid MITE address
                        </span>
                      ) : (
                        <span className="font-medium text-[var(--danger)]">
                          Only exact @mite.ac.in addresses are accepted
                        </span>
                      )}

                      {rolePreview && (
                        <span className="inline-flex items-center rounded-full bg-[var(--primary-soft)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--primary)]">
                          {rolePreview === 'student' ? 'Student 🎓' : 'Faculty ⭐'}
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={sendingOtp}
                    className="inline-flex h-12 min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[var(--primary-hover)] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {sendingOtp ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Sending OTP…</span>
                      </>
                    ) : (
                      <span>Send OTP</span>
                    )}
                  </button>
                </motion.form>
              ) : (
                <motion.form
                  key="step-otp"
                  initial={{ opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 24 }}
                  transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                  onSubmit={(e) => {
                    e.preventDefault()
                    void handleVerifySubmit()
                  }}
                  className="space-y-6"
                >
                  <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
                        Code sent to
                      </p>
                      <p className="truncate text-sm font-semibold text-[var(--text)]">
                        {trimmedEmail}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setStep('email')
                        setOtp('')
                        setOtpError(false)
                      }}
                      className="inline-flex min-h-[44px] shrink-0 items-center rounded-lg px-3 text-xs font-semibold text-[var(--primary)] hover:bg-[var(--primary-soft)] transition-colors cursor-pointer"
                    >
                      Change
                    </button>
                  </div>

                  <div>
                    <label className="block text-center text-sm font-semibold text-[var(--text)] mb-1.5">
                      Enter 4-digit verification code
                    </label>
                    <p className="mb-3 text-center text-xs font-medium text-[var(--text-muted)]">
                      Demo OTP:{' '}
                      <code className="rounded bg-[var(--primary-soft)] px-1.5 py-0.5 font-mono font-bold text-[var(--primary)]">
                        1234
                      </code>
                    </p>
                    <OtpInput
                      length={4}
                      value={otp}
                      onChange={(val) => {
                        setOtp(val)
                        if (otpError) setOtpError(false)
                      }}
                      onComplete={(val) => {
                        void handleVerifySubmit(val)
                      }}
                      disabled={verifyingOtp}
                      error={otpError}
                      idPrefix="login-otp"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={verifyingOtp || otp.length !== 4}
                    className="inline-flex h-12 min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[var(--primary-hover)] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {verifyingOtp ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Verifying…</span>
                      </>
                    ) : (
                      <span>Verify &amp; Continue</span>
                    )}
                  </button>

                  <div className="flex items-center justify-center">
                    {resendCooldown > 0 ? (
                      <p className="text-xs font-medium text-[var(--text-muted)]">
                        Resend OTP in{' '}
                        <span className="font-mono font-bold text-[var(--text)]">
                          {resendCooldown}s
                        </span>
                      </p>
                    ) : (
                      <button
                        type="button"
                        onClick={handleResend}
                        disabled={sendingOtp}
                        className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl px-4 text-xs font-semibold text-[var(--primary)] hover:bg-[var(--primary-soft)] transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        <RefreshCw
                          className={`h-3.5 w-3.5 ${sendingOtp ? 'animate-spin' : ''}`}
                        />
                        <span>Resend OTP</span>
                      </button>
                    )}
                  </div>
                </motion.form>
              )}
            </AnimatePresence>
          </div>

          <div className="mt-6 border-t border-[var(--border)] pt-4 flex items-center justify-between text-xs text-[var(--text-muted)]">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-[var(--accent)]" />
              MITE domain enforced
            </span>
            <Link
              href="/staff/login"
              className="inline-flex min-h-[44px] items-center font-medium text-[var(--primary)] hover:underline"
            >
              Staff Login →
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] text-[var(--text-muted)]">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--primary)]" />
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  )
}
