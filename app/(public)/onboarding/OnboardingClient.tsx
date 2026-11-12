'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import {
  CheckCircle2,
  Loader2,
  Phone,
  ShieldCheck,
  Smartphone,
} from 'lucide-react'
import { toast } from 'sonner'
import { OtpInput } from '@/components/auth/OtpInput'
import { SmsPopup } from '@/components/auth/SmsPopup'
import { ThemeToggle } from '@/components/auth/ThemeToggle'
import { PhoneRequestSchema } from '@/lib/validators/auth'
import {
  completePhoneOnboarding,
  requestPhoneVerificationCode,
} from './actions'

interface OnboardingClientProps {
  initialRole: 'student' | 'faculty'
  fullName: string | null
  userEmail: string | null
  isAuthenticated: boolean
  supabaseConfigured: boolean
}

export function OnboardingClient({
  initialRole,
  fullName,
  userEmail,
  isAuthenticated,
  supabaseConfigured,
}: OnboardingClientProps) {
  const router = useRouter()

  const [step, setStep] = useState<'phone' | 'otp' | 'welcome'>('phone')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [issuedCode, setIssuedCode] = useState<string | null>(null)
  const [popupOpen, setPopupOpen] = useState(false)
  const [otpError, setOtpError] = useState(false)
  const [sending, setSending] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [verifiedRole, setVerifiedRole] = useState<'student' | 'faculty'>(initialRole)

  const sanitizedPhone = phone.replace(/\D/g, '').slice(0, 10)
  const isPhoneValid = PhoneRequestSchema.safeParse({ phone: sanitizedPhone }).success

  useEffect(() => {
    if (step !== 'welcome') return
    const timer = window.setTimeout(() => {
      router.push('/home')
      router.refresh()
    }, 2000)
    return () => window.clearTimeout(timer)
  }, [step, router])

  const handlePhoneSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (sending) return

    const parsed = PhoneRequestSchema.safeParse({ phone: sanitizedPhone })
    if (!parsed.success) {
      toast.error(
        parsed.error.issues[0]?.message ||
          'Enter a valid 10-digit Indian mobile number starting with 6–9'
      )
      return
    }

    setSending(true)
    try {
      const result = await requestPhoneVerificationCode(parsed.data.phone)
      if (!result.success || !result.code) {
        toast.error(result.error || 'Failed to generate verification code')
        return
      }

      setIssuedCode(result.code)
      setPopupOpen(true)
      setOtp('')
      setOtpError(false)
      setStep('otp')
      toast.success('Verification SMS delivered!')
    } catch {
      toast.error('Could not send verification code')
    } finally {
      setSending(false)
    }
  }

  const handleOtpVerify = async (codeOverride?: string) => {
    if (verifying) return
    const code = (codeOverride ?? otp).trim()
    if (code.length !== 4) {
      setOtpError(true)
      toast.error('Enter the 4-digit verification code')
      return
    }

    // Client-side immediate check against displayed code or 1234
    if (code !== issuedCode && code !== '1234') {
      setOtpError(true)
      toast.error('Code does not match the SMS notification (1234)')
      return
    }

    setVerifying(true)
    setOtpError(false)

    try {
      const result = await completePhoneOnboarding({
        phone: sanitizedPhone,
        code,
      })

      if (!result.success) {
        setOtpError(true)
        toast.error(result.error || 'Could not complete onboarding')
        return
      }

      if (result.role) {
        setVerifiedRole(result.role)
      }
      setPopupOpen(false)
      setStep('welcome')
      toast.success('Phone verified!')
    } catch {
      setOtpError(true)
      toast.error('Unexpected error completing phone verification')
    } finally {
      setVerifying(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg)] text-[var(--text)]">
      {/* Fake iPhone SMS notification */}
      <SmsPopup
        code={issuedCode}
        open={popupOpen}
        onClose={() => setPopupOpen(false)}
        onAutofill={(code) => {
          setOtp(code)
          setOtpError(false)
          setPopupOpen(false)
        }}
        durationMs={8000}
      />

      <header className="mx-auto w-full max-w-5xl px-4 sm:px-6 pt-5 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-bold text-[var(--text)]">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--primary)] text-white">
            <Smartphone className="h-4 w-4" />
          </span>
          <span>Account Setup</span>
        </div>
        <ThemeToggle />
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-8 sm:py-12">
        <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 sm:p-8 shadow-xl overflow-hidden">
          {!supabaseConfigured || !isAuthenticated ? (
            <div className="text-center space-y-4">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--primary-soft)] text-[var(--primary)]">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <h1 className="text-xl font-extrabold text-[var(--text)]">
                Sign in first to verify your phone
              </h1>
              <p className="text-sm text-[var(--text-muted)]">
                {!supabaseConfigured
                  ? 'Supabase environment variables are not configured yet.'
                  : 'Please sign in with your @mite.ac.in email before linking your mobile number.'}
              </p>
              <Link
                href="/login"
                className="inline-flex h-12 min-h-[44px] w-full items-center justify-center rounded-xl bg-[var(--primary)] px-5 text-sm font-semibold text-white hover:bg-[var(--primary-hover)] transition-colors"
              >
                Go to Login
              </Link>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              {step === 'phone' && (
                <motion.form
                  key="onboarding-phone"
                  initial={{ opacity: 0, x: -24 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -24 }}
                  transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                  onSubmit={handlePhoneSubmit}
                  noValidate
                  className="space-y-5"
                >
                  <div>
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-[var(--primary-soft)] px-3 py-1 text-xs font-semibold text-[var(--primary)]">
                      {initialRole === 'faculty' ? 'Faculty · Priority ⭐' : 'Student 🎓'}
                    </div>
                    <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-[var(--text)]">
                      Verify your mobile number
                    </h1>
                    <p className="mt-1 text-sm text-[var(--text-muted)]">
                      {fullName ? `Hi ${fullName}! ` : ''}
                      We&apos;ll send order-ready alerts to your phone.
                      {userEmail ? ` (${userEmail})` : ''}
                    </p>
                  </div>

                  <div>
                    <label
                      htmlFor="indian-phone"
                      className="block text-sm font-semibold text-[var(--text)]"
                    >
                      10-digit Mobile Number
                    </label>
                    <div className="mt-2 flex items-center rounded-xl border border-[var(--border)] bg-[var(--bg)] focus-within:border-[var(--primary)] focus-within:ring-3 focus-within:ring-[var(--primary)]/15 overflow-hidden">
                      <span className="inline-flex h-12 items-center gap-1.5 border-r border-[var(--border)] bg-[var(--surface-2)] px-3.5 text-sm font-semibold text-[var(--text)]">
                        <Phone className="h-3.5 w-3.5 text-[var(--primary)]" />
                        +91
                      </span>
                      <input
                        id="indian-phone"
                        type="tel"
                        inputMode="numeric"
                        autoComplete="tel-national"
                        autoFocus
                        maxLength={10}
                        value={sanitizedPhone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="9876543210"
                        className="h-12 min-h-[44px] w-full bg-transparent px-3.5 text-base font-medium tracking-wide text-[var(--text)] placeholder:text-[var(--text-muted)]/60 outline-none"
                      />
                    </div>
                    <p className="mt-2 text-xs text-[var(--text-muted)]">
                      Demo SMS: a verification bubble appears in the corner (Demo OTP:{' '}
                      <code className="font-mono font-semibold text-[var(--text)]">
                        1234
                      </code>
                      ).
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={sending || !isPhoneValid}
                    className="inline-flex h-12 min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[var(--primary-hover)] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {sending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Sending code…</span>
                      </>
                    ) : (
                      <span>Send verification code</span>
                    )}
                  </button>
                </motion.form>
              )}

              {step === 'otp' && (
                <motion.form
                  key="onboarding-otp"
                  initial={{ opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 24 }}
                  transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                  onSubmit={(e) => {
                    e.preventDefault()
                    void handleOtpVerify()
                  }}
                  className="space-y-6"
                >
                  <div>
                    <h1 className="text-xl font-extrabold tracking-tight text-[var(--text)]">
                      Enter SMS verification code
                    </h1>
                    <p className="mt-1 text-sm text-[var(--text-muted)]">
                      Sent to <span className="font-semibold text-[var(--text)]">+91 {sanitizedPhone}</span>.{' '}
                      <button
                        type="button"
                        onClick={() => {
                          setStep('phone')
                          setPopupOpen(false)
                        }}
                        className="font-semibold text-[var(--primary)] hover:underline cursor-pointer"
                      >
                        Change number
                      </button>
                    </p>
                  </div>

                  <OtpInput
                    length={4}
                    value={otp}
                    onChange={(val) => {
                      setOtp(val)
                      if (otpError) setOtpError(false)
                    }}
                    onComplete={(val) => {
                      void handleOtpVerify(val)
                    }}
                    disabled={verifying}
                    error={otpError}
                    idPrefix="onboarding-otp"
                  />

                  <p className="text-center text-xs text-[var(--text-muted)]">
                    Demo OTP:{' '}
                    <code className="rounded bg-[var(--primary-soft)] px-1.5 py-0.5 font-mono font-bold text-[var(--primary)]">
                      1234
                    </code>
                  </p>

                  <div className="space-y-2.5">
                    <button
                      type="submit"
                      disabled={verifying || otp.length !== 4}
                      className="inline-flex h-12 min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[var(--primary-hover)] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                    >
                      {verifying ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Confirming…</span>
                        </>
                      ) : (
                        <span>Verify &amp; Finish Setup</span>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={handlePhoneSubmit}
                      disabled={sending}
                      className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl text-xs font-semibold text-[var(--primary)] hover:bg-[var(--primary-soft)] transition-colors cursor-pointer"
                    >
                      {sending ? 'Resending SMS…' : 'Resend SMS popup'}
                    </button>
                  </div>
                </motion.form>
              )}

              {step === 'welcome' && (
                <motion.div
                  key="onboarding-welcome"
                  initial={{ opacity: 0, scale: 0.94 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                  className="py-4 text-center space-y-4"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 280, damping: 18 }}
                    className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[var(--success)]/15 text-[var(--success)]"
                  >
                    <CheckCircle2 className="h-9 w-9" />
                  </motion.div>

                  <div>
                    <span className="inline-flex items-center rounded-full bg-[var(--primary-soft)] px-3.5 py-1 text-xs font-bold text-[var(--primary)]">
                      {verifiedRole === 'faculty'
                        ? 'Faculty · Priority ⭐'
                        : 'Student 🎓'}
                    </span>
                    <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-[var(--text)]">
                      Welcome to MITE Canteen! You&apos;re all set.
                    </h1>
                    <p className="mt-1.5 text-sm text-[var(--text-muted)]">
                      Taking you to today&apos;s menu…
                    </p>
                  </div>

                  <div className="pt-2">
                    <Link
                      href="/home"
                      className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-[var(--primary)] px-6 text-sm font-semibold text-white hover:bg-[var(--primary-hover)] transition-colors"
                    >
                      Open Menu Now
                    </Link>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </div>
      </main>
    </div>
  )
}
