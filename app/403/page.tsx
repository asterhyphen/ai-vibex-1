'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { ArrowLeft, Loader2, Lock } from 'lucide-react'
import { ThemeToggle } from '@/components/auth/ThemeToggle'

const ROLE_MESSAGES: Record<string, string> = {
  admin: 'This area is for administrators only.',
  staff: 'This area is restricted to canteen and print counter staff.',
  student: 'This area is only accessible to students and faculty.',
  blocked: 'Your account has been suspended. Please contact the canteen administrator.',
}

function ForbiddenContent() {
  const searchParams = useSearchParams()
  const reason = searchParams.get('reason') ?? ''
  const roleMessage =
    ROLE_MESSAGES[reason] ?? 'This area is for administrators only.'

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg)] text-[var(--text)]">
      <header className="mx-auto w-full max-w-5xl px-4 sm:px-6 pt-5 flex items-center justify-end">
        <ThemeToggle />
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center shadow-xl"
        >
          <motion.div
            initial={{ rotate: 0, scale: 0.85 }}
            animate={{
              rotate: [0, -14, 14, -10, 10, -5, 5, 0],
              scale: [0.85, 1.08, 1],
            }}
            transition={{
              duration: 0.75,
              ease: 'easeInOut',
            }}
            className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl border border-[var(--danger)]/30 bg-[var(--danger)]/10 text-[var(--danger)]"
          >
            <Lock className="h-10 w-10" strokeWidth={1.75} />
          </motion.div>

          <p className="mt-6 text-xs font-bold uppercase tracking-widest text-[var(--danger)]">
            Error 403
          </p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-[var(--text)]">
            Access Restricted
          </h1>
          <p className="mt-3 text-sm font-medium text-[var(--text)]">
            You don&apos;t have permission to view this page.
          </p>
          <p className="mt-1.5 text-xs sm:text-sm text-[var(--text-muted)]">
            {roleMessage}
          </p>

          <div className="mt-7 flex flex-col gap-2.5">
            <Link
              href="/home"
              className="inline-flex h-12 min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[var(--primary-hover)]"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Go to my dashboard</span>
            </Link>
            <Link
              href="/"
              className="inline-flex h-11 min-h-[44px] w-full items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
            >
              Back to Home
            </Link>
          </div>
        </motion.div>
      </main>
    </div>
  )
}

export default function ForbiddenPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] text-[var(--text-muted)]">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--primary)]" />
        </div>
      }
    >
      <ForbiddenContent />
    </Suspense>
  )
}
