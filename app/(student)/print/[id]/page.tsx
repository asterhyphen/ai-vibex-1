'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { motion } from 'framer-motion'
import QRCode from 'qrcode'
import {
  ArrowLeft,
  CheckCircle2,
  FileText,
  Loader2,
  Printer,
  QrCode,
  RotateCw,
  ShieldCheck,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import type { PrintJob } from '@/lib/types'
import { formatPaise } from '@/lib/utils/format'
import { ThemeToggle } from '@/components/auth/ThemeToggle'

const PRINT_STEPS = [
  { key: 'paid', label: 'Paid & Queued', desc: 'Waiting for print counter' },
  { key: 'printing', label: 'Printing', desc: 'Your PDF is on the printer' },
  { key: 'ready', label: 'Ready for Pickup', desc: 'Show QR code at print desk' },
  { key: 'collected', label: 'Collected', desc: 'Handover completed' },
] as const

function PrintJobTrackingContent() {
  const params = useParams<{ id: string }>()
  const jobId = params?.id

  const [job, setJob] = useState<PrintJob | null>(null)
  const [otp, setOtp] = useState<string>('')
  const [qrDataUrl, setQrDataUrl] = useState<string>('')
  const [flipped, setFlipped] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!jobId) return
    let cancelled = false
    fetch(`/api/print/jobs/${jobId}`, { cache: 'no-store' })
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(async ({ ok, data }) => {
        if (cancelled) return
        if (!ok) {
          setError(data.error || 'Could not load print job')
          return
        }
        setJob(data.job)
        setOtp(data.otp || '')
        if (data.job?.qr_token) {
          const url = await QRCode.toDataURL(data.job.qr_token, {
            width: 240,
            margin: 1,
            color: { dark: '#2B1117', light: '#FFFFFF' },
          })
          if (!cancelled) setQrDataUrl(url)
        }
      })
      .catch(() => {
        if (!cancelled) setError('Network error loading print job')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [jobId])

  useEffect(() => {
    if (!jobId || !isSupabaseConfigured()) {
      return
    }
    const supabase = createClient()
    const channel = supabase
      .channel(`print-job-${jobId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'print_jobs',
          filter: `id=eq.${jobId}`,
        },
        (payload) => {
          setJob((prev) =>
            prev ? { ...prev, ...(payload.new as PrintJob) } : (payload.new as PrintJob)
          )
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [jobId])

  const shortRef = job ? `P-${job.id.slice(0, 6).toUpperCase()}` : ''
  const activeStepIdx = job
    ? PRINT_STEPS.findIndex((s) => s.key === job.status)
    : 0

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] pb-16">
      <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Link
              href="/print"
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] hover:border-[var(--primary)]"
              aria-label="Back to print shop"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-lg font-black text-[var(--text)]">
                Print Tracking {shortRef}
              </h1>
              <p className="text-xs text-[var(--text-muted)]">
                Live updates from the MITE Print Desk
              </p>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6">
        {loading ? (
          <div className="flex min-h-[320px] items-center justify-center rounded-3xl border border-[var(--border)] bg-[var(--surface)]">
            <Loader2 className="h-8 w-8 animate-spin text-[var(--primary)]" />
          </div>
        ) : error || !job ? (
          <div className="rounded-3xl border border-[var(--danger)]/40 bg-[var(--surface)] p-8 text-center">
            <p className="text-base font-bold text-[var(--danger)]">
              {error || 'Print job not found'}
            </p>
            <Link
              href="/print"
              className="mt-4 inline-flex min-h-[44px] items-center rounded-xl bg-[var(--primary)] px-5 text-sm font-bold text-white"
            >
              Upload a PDF
            </Link>
          </div>
        ) : (
          <>
            {job.status === 'ready' && (
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-3 rounded-2xl border-2 border-[var(--success)] bg-[var(--success)]/15 p-4 text-[var(--success)]"
              >
                <CheckCircle2 className="h-7 w-7 shrink-0" />
                <div>
                  <div className="text-base font-black">Your printouts are ready! 🎉</div>
                  <div className="text-xs font-semibold">
                    Tap the card below to show your QR code at the print desk.
                  </div>
                </div>
              </motion.div>
            )}

            {/* Flippable QR & Details Card */}
            <div className="perspective-[1200px]">
              <motion.div
                onClick={() => setFlipped((f) => !f)}
                animate={{ rotateY: flipped ? 180 : 0 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                style={{ transformStyle: 'preserve-3d' }}
                className="relative min-h-[300px] cursor-pointer rounded-3xl border border-[var(--border)] bg-[var(--surface)] shadow-lg"
              >
                {/* Front: Job summary */}
                <div
                  style={{ backfaceVisibility: 'hidden' }}
                  className="flex h-full flex-col justify-between p-6"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--primary-soft)] text-[var(--primary)]">
                        <FileText className="h-6 w-6" />
                      </span>
                      <div className="min-w-0">
                        <div className="text-xs font-black tracking-wider text-[var(--primary)]">
                          {shortRef}
                        </div>
                        <h2 className="truncate text-lg font-extrabold text-[var(--text)]">
                          {job.original_name}
                        </h2>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--success)]/15 px-3 py-1 text-xs font-bold text-[var(--success)]">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Cleaned
                    </span>
                  </div>

                  <div className="my-5 grid grid-cols-2 gap-3 rounded-2xl bg-[var(--surface-2)] p-4 text-sm sm:grid-cols-4">
                    <div>
                      <div className="text-xs text-[var(--text-muted)]">Pages</div>
                      <div className="font-extrabold">{job.pages}</div>
                    </div>
                    <div>
                      <div className="text-xs text-[var(--text-muted)]">Colour</div>
                      <div className="font-extrabold">{job.color ? 'Colour' : 'B&W'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-[var(--text-muted)]">Sides &amp; Size</div>
                      <div className="font-extrabold">
                        {job.double_sided ? '2-sided' : '1-sided'} · {job.paper}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-[var(--text-muted)]">Total Paid</div>
                      <div className="font-black text-[var(--primary)]">
                        {formatPaise(job.cost_paise)} ({job.copies}×)
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-center gap-2 text-xs font-bold text-[var(--primary)]">
                    <QrCode className="h-4 w-4" />
                    <span>Tap card to flip &amp; reveal collection QR</span>
                    <RotateCw className="h-3.5 w-3.5" />
                  </div>
                </div>

                {/* Back: QR Code */}
                <div
                  style={{
                    backfaceVisibility: 'hidden',
                    transform: 'rotateY(180deg)',
                  }}
                  className="absolute inset-0 flex flex-col items-center justify-center rounded-3xl bg-[var(--surface)] p-6 text-center"
                >
                  {qrDataUrl && (
                    <div className="rounded-2xl border border-[var(--border)] bg-white p-3 shadow-sm">
                      <img
                        src={qrDataUrl}
                        alt={`QR for print job ${shortRef}`}
                        className="h-44 w-44"
                      />
                    </div>
                  )}
                  <div className="mt-3 text-lg font-black tracking-wider text-[var(--primary)]">
                    {shortRef}
                  </div>
                  {otp && (
                    <div className="mt-1 text-xs font-bold text-[var(--text-muted)] tabular-nums">
                      Manual Fallback OTP: <span className="text-[var(--text)]">{otp}</span>
                    </div>
                  )}
                  <div className="mt-2 text-xs font-semibold text-[var(--text-muted)]">
                    Tap card to flip back
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Progress Stepper */}
            <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
              <h3 className="mb-4 text-sm font-extrabold uppercase tracking-wider text-[var(--text-muted)]">
                Print Status
              </h3>

              {job.status === 'rejected' ? (
                <div className="rounded-2xl border border-[var(--danger)]/40 bg-[var(--danger)]/10 p-4 text-sm font-bold text-[var(--danger)]">
                  This print job was rejected by staff and refunded.
                </div>
              ) : (
                <ol className="space-y-4">
                  {PRINT_STEPS.map((step, idx) => {
                    const done = idx <= activeStepIdx
                    const isCurrent = idx === activeStepIdx
                    return (
                      <li key={step.key} className="flex items-start gap-3.5">
                        <span
                          className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black ${
                            done
                              ? 'bg-[var(--primary)] text-white'
                              : 'border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-muted)]'
                          } ${isCurrent ? 'ring-4 ring-[var(--primary)]/20' : ''}`}
                        >
                          {done ? '✓' : idx + 1}
                        </span>
                        <div>
                          <div className="text-sm font-extrabold text-[var(--text)]">
                            {step.label}
                          </div>
                          <div className="text-xs text-[var(--text-muted)]">
                            {step.desc}
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ol>
              )}
            </section>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/print"
                className="inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-bold text-[var(--text)] hover:border-[var(--primary)]"
              >
                <Printer className="h-4 w-4" />
                <span>Print Another PDF</span>
              </Link>
              <Link
                href="/home"
                className="inline-flex min-h-[48px] flex-1 items-center justify-center rounded-xl bg-[var(--primary)] px-4 text-sm font-bold text-white hover:bg-[var(--primary-hover)]"
              >
                Back to Canteen Home
              </Link>
            </div>
          </>
        )}
      </main>
    </div>
  )
}

export default function PrintJobTrackingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[var(--bg)]">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--primary)]" />
        </div>
      }
    >
      <PrintJobTrackingContent />
    </Suspense>
  )
}
