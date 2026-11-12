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
  Sparkles,
  UserPlus,
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

interface AuthFormBodyProps {
  mode: 'signin' | 'register'
  step: 'email' | 'otp'
  email: string
  otp: string
  otpError: boolean
  sendingOtp: boolean
  verifyingOtp: boolean
  resendCooldown: number
  trimmedEmail: string
  hasTypedEmail: boolean
  isEmailValid: boolean
  rolePreview: 'student' | 'faculty' | null
  onEmailChange: (value: string) => void
  onOtpChange: (value: string) => void
  onEmailSubmit: (event: React.FormEvent) => void
  onVerifySubmit: (codeOverride?: string) => void
  onResend: () => void
  onResetToEmail: () => void
}

function AuthFormBody({
  mode,
  step,
  email,
  otp,
  otpError,
  sendingOtp,
  verifyingOtp,
  resendCooldown,
  trimmedEmail,
  hasTypedEmail,
  isEmailValid,
  rolePreview,
  onEmailChange,
  onOtpChange,
  onEmailSubmit,
  onVerifySubmit,
  onResend,
  onResetToEmail,
}: AuthFormBodyProps) {
  const isRegister = mode === 'register'
  const inputId = isRegister ? 'register-college-email' : 'signin-college-email'
  const otpPrefix = isRegister ? 'register-otp' : 'signin-otp'
  const emailLocal = email.includes('@') ? email.split('@')[0] : email

  return (
    <div className="w-full">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--primary)] text-white shadow-sm">
          {isRegister ? (
            <UserPlus className="h-5 w-5" />
          ) : (
            <UtensilsCrossed className="h-5 w-5" />
          )}
        </div>
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight text-[var(--text)]">
            {isRegister ? 'Create Account' : 'Sign In'}
          </h1>
          <p className="text-xs text-[var(--text-muted)]">
            {isRegister
              ? 'Register with your @mite.ac.in college email'
              : 'Passwordless sign-in with your college email'}
          </p>
        </div>
      </div>

      {isRegister && step === 'email' && (
        <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-[var(--primary-soft)] px-3 py-1 text-[11px] font-semibold text-[var(--primary)]">
          <Sparkles className="h-3 w-3 shrink-0" />
          <span>Step 1: Email OTP · Step 2: Phone Verification</span>
        </div>
      )}

      <div className="mt-6">
        <AnimatePresence mode="wait">
          {step === 'email' ? (
            <motion.form
              key={`${mode}-step-email`}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              onSubmit={onEmailSubmit}
              noValidate
              className="space-y-4 sm:space-y-5"
            >
              <div>
                <label
                  htmlFor={inputId}
                  className="block text-sm font-semibold text-[var(--text)]"
                >
                  College Email Address
                </label>
                <div
                  className={`relative mt-2 flex h-12 min-h-[44px] w-full items-center rounded-xl border bg-[var(--bg)] transition-all ${
                    !hasTypedEmail
                      ? 'border-[var(--border)] focus-within:border-[var(--primary)] focus-within:ring-3 focus-within:ring-[var(--primary)]/15'
                      : isEmailValid
                      ? 'border-[var(--success)] focus-within:ring-3 focus-within:ring-[var(--success)]/15'
                      : 'border-[var(--danger)] focus-within:ring-3 focus-within:ring-[var(--danger)]/15'
                  }`}
                >
                  <span className="pointer-events-none pl-3.5 pr-2 text-[var(--text-muted)]">
                    <Mail className="h-4 w-4" />
                  </span>
                  <input
                    id={inputId}
                    type="text"
                    inputMode="text"
                    autoComplete="username"
                    value={emailLocal}
                    onChange={(e) => {
                      const raw = e.target.value.toLowerCase().replace(/\s+/g, '')
                      const cleaned = raw.replace(/@mite\.ac\.in$/i, '').replace(/@.*$/, '')
                      onEmailChange(cleaned ? `${cleaned}@mite.ac.in` : '')
                    }}
                    placeholder="4mt21cs001"
                    className="h-full flex-1 bg-transparent py-2 pl-0 pr-1 text-base sm:text-sm text-[var(--text)] placeholder:text-[var(--text-muted)]/60 outline-none"
                  />
                  <span className="pointer-events-none select-none pr-3 text-sm font-medium text-[var(--text-muted)] sm:text-xs">
                    @mite.ac.in
                  </span>
                  {hasTypedEmail && (
                    <span
                      aria-live="polite"
                      className="pointer-events-none pr-3.5"
                    >
                      {isEmailValid ? (
                        <CheckCircle2
                          className="h-5 w-5 text-[var(--success)]"
                          aria-label="Valid MITE email"
                        />
                      ) : (
                        <XCircle
                          className="h-5 w-5 text-[var(--danger)]"
                          aria-label="Invalid email format"
                        />
                      )}
                    </span>
                  )}
                </div>

                <div className="mt-2 min-h-[20px] flex flex-wrap items-center justify-between gap-2 text-xs">
                  {!hasTypedEmail ? (
                    <span className="text-[var(--text-muted)]">
                      Enter your USN or username (e.g. <code className="font-mono">4mt21cs001</code>)
                    </span>
                  ) : isEmailValid ? (
                    <span className="font-medium text-[var(--success)]">
                      Valid MITE address ({trimmedEmail})
                    </span>
                  ) : (
                    <span className="font-medium text-[var(--danger)]">
                      Please enter a valid USN or username
                    </span>
                  )}

                  {rolePreview && (
                    <span className="inline-flex items-center rounded-full bg-[var(--primary-soft)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--primary)]">
                      {rolePreview === 'student' ? 'Student' : 'Faculty'}
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
                  <span>{isRegister ? 'Register with OTP' : 'Send OTP'}</span>
                )}
              </button>
            </motion.form>
          ) : (
            <motion.form
              key={`${mode}-step-otp`}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 16 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              onSubmit={(e) => {
                e.preventDefault()
                void onVerifySubmit()
              }}
              className="space-y-5"
            >
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-[var(--text-muted)]">
                    Code sent to
                  </p>
                  <p className="truncate text-sm font-semibold text-[var(--text)]">
                    {trimmedEmail}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onResetToEmail}
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
                  <code className="rounded bg-[var(--primary-soft)] px-1.5 py-0.5 font-mono font-bold tabular-nums text-[var(--primary)]">
                    1234
                  </code>
                </p>
                <OtpInput
                  length={4}
                  value={otp}
                  onChange={onOtpChange}
                  onComplete={(val) => {
                    void onVerifySubmit(val)
                  }}
                  disabled={verifyingOtp}
                  error={otpError}
                  idPrefix={otpPrefix}
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
                  <span>{isRegister ? 'Verify & Register' : 'Verify & Continue'}</span>
                )}
              </button>

              <div className="flex items-center justify-center">
                {resendCooldown > 0 ? (
                  <p className="text-xs font-medium text-[var(--text-muted)]">
                    Resend OTP in{' '}
                    <span className="font-mono font-bold tabular-nums text-[var(--text)]">
                      {resendCooldown}s
                    </span>
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={onResend}
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

      <div className="mt-6 border-t border-[var(--border)] pt-4 flex items-center justify-between gap-2 text-xs text-[var(--text-muted)]">
        <span className="inline-flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-[var(--accent)]" />
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
  )
}

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const nextPath = getSafeNextPath(searchParams.get('next'))
  const initialMode =
    searchParams.get('mode') === 'register' || searchParams.get('mode') === 'signup'

  const [isRegister, setIsRegister] = useState(initialMode)
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

  const switchMode = (targetRegister: boolean) => {
    if (targetRegister === isRegister) return
    setIsRegister(targetRegister)
    setStep('email')
    setOtp('')
    setOtpError(false)
  }

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

      toast.success('Email verified')
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

  const sharedFormProps: Omit<AuthFormBodyProps, 'mode'> = {
    step,
    email,
    otp,
    otpError,
    sendingOtp,
    verifyingOtp,
    resendCooldown,
    trimmedEmail,
    hasTypedEmail,
    isEmailValid,
    rolePreview,
    onEmailChange: setEmail,
    onOtpChange: (val) => {
      setOtp(val)
      if (otpError) setOtpError(false)
    },
    onEmailSubmit: handleEmailSubmit,
    onVerifySubmit: handleVerifySubmit,
    onResend: handleResend,
    onResetToEmail: () => {
      setStep('email')
      setOtp('')
      setOtpError(false)
    },
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

      <main className="flex-1 flex items-center justify-center px-4 py-6 sm:py-10">
        {/* Desktop (>= md): Classic dual-panel sliding overlay card */}
        <div className="hidden md:block relative w-full max-w-[840px] min-h-[540px] rounded-3xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl overflow-hidden">
          {/* Sign In panel (left 50% when active) */}
          <div
            aria-hidden={isRegister}
            className={`absolute top-0 left-0 flex h-full w-1/2 items-center px-9 py-10 transition-all duration-700 ease-in-out motion-reduce:transition-none ${
              isRegister
                ? 'translate-x-full opacity-0 z-10 pointer-events-none'
                : 'translate-x-0 opacity-100 z-20'
            }`}
          >
            <AuthFormBody mode="signin" {...sharedFormProps} />
          </div>

          {/* Register / Sign Up panel (slides into right 50% when active) */}
          <div
            aria-hidden={!isRegister}
            className={`absolute top-0 left-0 flex h-full w-1/2 items-center px-9 py-10 transition-all duration-700 ease-in-out motion-reduce:transition-none ${
              isRegister
                ? 'translate-x-full opacity-100 z-20'
                : 'translate-x-0 opacity-0 z-10 pointer-events-none'
            }`}
          >
            <AuthFormBody mode="register" {...sharedFormProps} />
          </div>

          {/* Sliding Overlay Container */}
          <div
            className={`absolute top-0 left-1/2 h-full w-1/2 overflow-hidden z-30 transition-transform duration-700 ease-in-out motion-reduce:transition-none ${
              isRegister ? '-translate-x-full' : 'translate-x-0'
            }`}
          >
            <div
              className={`relative -left-full h-full w-[200%] bg-gradient-to-br from-[var(--primary)] via-[var(--primary)] to-[var(--primary-hover)] text-white transition-transform duration-700 ease-in-out motion-reduce:transition-none ${
                isRegister ? 'translate-x-1/2' : 'translate-x-0'
              }`}
            >
              {/* Left Overlay Panel (shown in Register mode -> invites to Sign In) */}
              <div
                className={`absolute top-0 left-0 flex h-full w-1/2 flex-col items-center justify-center px-10 text-center transition-transform duration-700 ease-in-out motion-reduce:transition-none ${
                  isRegister ? 'translate-x-0' : '-translate-x-[20%]'
                }`}
              >
                <h2 className="text-3xl font-bold tracking-tight text-white">
                  Welcome Back
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-white/85">
                  Already registered with your MITE email? Sign in to pre-order meals and print jobs.
                </p>
                <button
                  type="button"
                  onClick={() => switchMode(false)}
                  className="mt-7 inline-flex min-h-[44px] items-center justify-center rounded-xl border border-white/85 bg-transparent px-9 py-2.5 text-xs font-bold uppercase tracking-wider text-white transition-colors hover:bg-white/15 cursor-pointer"
                >
                  Sign In
                </button>
              </div>

              {/* Right Overlay Panel (shown in Sign In mode -> invites to Register) */}
              <div
                className={`absolute top-0 right-0 flex h-full w-1/2 flex-col items-center justify-center px-10 text-center transition-transform duration-700 ease-in-out motion-reduce:transition-none ${
                  isRegister ? 'translate-x-[20%]' : 'translate-x-0'
                }`}
              >
                <h2 className="text-3xl font-bold tracking-tight text-white">
                  Hello, MITEian
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-white/85">
                  New to MITE Canteen? Register with your @mite.ac.in email and skip the queue.
                </p>
                <button
                  type="button"
                  onClick={() => switchMode(true)}
                  className="mt-7 inline-flex min-h-[44px] items-center justify-center rounded-xl border border-white/85 bg-transparent px-9 py-2.5 text-xs font-bold uppercase tracking-wider text-white transition-colors hover:bg-white/15 cursor-pointer"
                >
                  Sign Up
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile (< md): Compact animated switcher + sliding form card */}
        <div className="md:hidden w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xl overflow-hidden">
          {/* Compact themed banner matching desktop overlay */}
          <div className="bg-gradient-to-r from-[var(--primary)] to-[var(--primary-hover)] px-5 pt-5 pb-4 text-white">
            <AnimatePresence mode="wait">
              <motion.div
                key={isRegister ? 'mobile-banner-register' : 'mobile-banner-signin'}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.22 }}
              >
                <h2 className="text-xl font-bold tracking-tight">
                  {isRegister ? 'Hello, MITEian' : 'Welcome Back'}
                </h2>
                <p className="mt-1 text-xs text-white/85">
                  {isRegister
                    ? 'Register with your @mite.ac.in email and skip the queue.'
                    : 'Sign in with your @mite.ac.in email to pre-order.'}
                </p>
              </motion.div>
            </AnimatePresence>

            {/* Sliding pill switcher */}
            <div
              role="tablist"
              aria-label="Authentication mode"
              className="mt-4 grid grid-cols-2 rounded-xl bg-black/20 p-1"
            >
              <button
                type="button"
                role="tab"
                aria-selected={!isRegister}
                onClick={() => switchMode(false)}
                className="relative min-h-[44px] rounded-lg text-xs font-bold uppercase tracking-wider text-white transition-colors cursor-pointer"
              >
                {!isRegister && (
                  <motion.span
                    layoutId="mobile-auth-pill"
                    transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                    className="absolute inset-0 rounded-lg bg-white/20 shadow-sm"
                  />
                )}
                <span className="relative z-10">Sign In</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={isRegister}
                onClick={() => switchMode(true)}
                className="relative min-h-[44px] rounded-lg text-xs font-bold uppercase tracking-wider text-white transition-colors cursor-pointer"
              >
                {isRegister && (
                  <motion.span
                    layoutId="mobile-auth-pill"
                    transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                    className="absolute inset-0 rounded-lg bg-white/20 shadow-sm"
                  />
                )}
                <span className="relative z-10">Sign Up</span>
              </button>
            </div>
          </div>

          {/* Sliding form container */}
          <div className="p-5 sm:p-6 overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.div
                key={isRegister ? 'mobile-form-register' : 'mobile-form-signin'}
                initial={{ opacity: 0, x: isRegister ? 28 : -28 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: isRegister ? -28 : 28 }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              >
                <AuthFormBody
                  mode={isRegister ? 'register' : 'signin'}
                  {...sharedFormProps}
                />
              </motion.div>
            </AnimatePresence>
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
