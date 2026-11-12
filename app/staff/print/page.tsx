'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  CheckCircle2,
  Download,
  FileText,
  Loader2,
  Printer,
  QrCode,
  ShieldCheck,
  XCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import type { PrintJob } from '@/lib/types'
import { formatPaise } from '@/lib/utils/format'
import { StaffHeader } from '@/components/staff/StaffHeader'
import { QrScannerModal } from '@/components/staff/QrScannerModal'
import { RejectModal } from '@/components/staff/RejectModal'

interface EnrichedPrintJob extends PrintJob {
  customer_name?: string
  customer_role?: string
}

const STATUS_STYLE: Record<string, string> = {
  paid: 'bg-[var(--info)]/15 text-[var(--info)]',
  printing: 'bg-[var(--warning)]/20 text-[var(--warning)]',
  ready: 'bg-[var(--success)]/15 text-[var(--success)]',
  collected: 'bg-[var(--surface-2)] text-[var(--text-muted)]',
  rejected: 'bg-[var(--danger)]/15 text-[var(--danger)]',
}

export default function PrintQueuePage() {
  const [jobs, setJobs] = useState<EnrichedPrintJob[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'active' | 'completed'>('active')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [scannerCode, setScannerCode] = useState('')
  const [rejectJob, setRejectJob] = useState<EnrichedPrintJob | null>(null)
  const [rejectSubmitting, setRejectSubmitting] = useState(false)

  const fetchQueue = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const res = await fetch('/api/staff/print', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) {
        if (!silent) toast.error(data.error || 'Failed to load print queue')
        return
      }
      setJobs(data.jobs ?? [])
    } catch {
      if (!silent) toast.error('Network error loading print queue')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    fetch('/api/staff/print', { cache: 'no-store' })
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (cancelled) return
        if (!ok) {
          toast.error(data.error || 'Failed to load print queue')
          return
        }
        setJobs(data.jobs ?? [])
      })
      .catch(() => {
        if (!cancelled) toast.error('Network error loading print queue')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return
    }
    const supabase = createClient()
    const channel = supabase
      .channel('staff-print-queue')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'print_jobs' },
        () => fetchQueue(true)
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchQueue])

  const handleDownload = async (job: EnrichedPrintJob) => {
    setBusyId(job.id)
    try {
      const res = await fetch(`/api/staff/print/${job.id}/download`)
      const data = await res.json()
      if (!res.ok || !data.url) {
        toast.error(data.error || 'Could not generate download link')
        return
      }
      const link = document.createElement('a')
      link.href = data.url
      link.download = data.filename || job.original_name || 'document.pdf'
      link.rel = 'noopener noreferrer'
      document.body.appendChild(link)
      link.click()
      link.remove()
      toast.success(`Downloading ${data.filename}`)
    } catch {
      toast.error('Network error generating download URL')
    } finally {
      setBusyId(null)
    }
  }

  const handleStatusAction = async (
    job: EnrichedPrintJob,
    action: 'start_printing' | 'ready'
  ) => {
    setBusyId(job.id)
    try {
      const res = await fetch(`/api/staff/print/${job.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Could not update print job')
        return
      }
      setJobs((prev) =>
        prev.map((j) => (j.id === job.id ? { ...j, ...data.job } : j))
      )
      toast.success(
        action === 'start_printing'
          ? 'Print job started'
          : 'Print job marked Ready · student notified'
      )
    } catch {
      toast.error('Network error updating print job')
    } finally {
      setBusyId(null)
    }
  }

  const handleConfirmReject = async (reason: string) => {
    if (!rejectJob) return
    setRejectSubmitting(true)
    try {
      const res = await fetch(`/api/staff/print/${rejectJob.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', reason }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Could not reject print job')
        return
      }
      setJobs((prev) =>
        prev.map((j) => (j.id === rejectJob.id ? { ...j, ...data.job } : j))
      )
      toast.success('Print job rejected')
      setRejectJob(null)
    } catch {
      toast.error('Network error rejecting print job')
    } finally {
      setRejectSubmitting(false)
    }
  }

  const activeJobs = useMemo(
    () =>
      jobs.filter(
        (j) => j.status === 'paid' || j.status === 'printing' || j.status === 'ready'
      ),
    [jobs]
  )

  const completedJobs = useMemo(
    () => jobs.filter((j) => j.status === 'collected' || j.status === 'rejected'),
    [jobs]
  )

  const visibleJobs = tab === 'active' ? activeJobs : completedJobs

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <StaffHeader
        staffName="Print Counter"
        onOpenScanner={() => {
          setScannerCode('')
          setScannerOpen(true)
        }}
      />

      <main className="mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-[var(--text)]">
              Print Shop Queue
            </h1>
            <p className="text-sm text-[var(--text-muted)]">
              Download sanitised PDFs, track print progress, and scan QR codes on pickup.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTab('active')}
              className={`min-h-[48px] rounded-xl px-4 text-sm font-bold cursor-pointer ${
                tab === 'active'
                  ? 'bg-[var(--primary)] text-white'
                  : 'border border-[var(--border)] bg-[var(--surface)] text-[var(--text)]'
              }`}
            >
              Active Queue ({activeJobs.length})
            </button>
            <button
              type="button"
              onClick={() => setTab('completed')}
              className={`min-h-[48px] rounded-xl px-4 text-sm font-bold cursor-pointer ${
                tab === 'completed'
                  ? 'bg-[var(--primary)] text-white'
                  : 'border border-[var(--border)] bg-[var(--surface)] text-[var(--text)]'
              }`}
            >
              Completed ({completedJobs.length})
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-[300px] items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
            <Loader2 className="h-7 w-7 animate-spin text-[var(--primary)]" />
          </div>
        ) : visibleJobs.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-[var(--border)] bg-[var(--surface)] py-16 text-center">
            <Printer className="mx-auto mb-3 h-10 w-10 text-[var(--text-muted)]" />
            <p className="text-base font-bold text-[var(--text)]">
              No {tab} print jobs right now
            </p>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Paid PDF submissions from students will appear here automatically.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {visibleJobs.map((job) => {
              const shortRef = `P-${job.id.slice(0, 6).toUpperCase()}`
              const busy = busyId === job.id
              return (
                <motion.article
                  key={job.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)]">
                          <FileText className="h-5 w-5" />
                        </span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-black tracking-wider text-[var(--primary)] tabular-nums">
                              {shortRef}
                            </span>
                            {job.sanitised && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--success)]/15 px-2 py-0.5 text-[11px] font-bold text-[var(--success)]">
                                <ShieldCheck className="h-3 w-3" />
                                Cleaned
                              </span>
                            )}
                          </div>
                          <h2 className="mt-0.5 truncate text-base font-extrabold text-[var(--text)]">
                            {job.original_name || 'document.pdf'}
                          </h2>
                          <p className="text-xs font-medium text-[var(--text-muted)]">
                            {job.customer_name || 'Student'} ·{' '}
                            {new Date(job.created_at).toLocaleTimeString('en-IN', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>
                      </div>

                      <span
                        className={`shrink-0 rounded-full px-3 py-1 text-xs font-extrabold capitalize ${
                          STATUS_STYLE[job.status] || 'bg-[var(--surface-2)]'
                        }`}
                      >
                        {job.status}
                      </span>
                    </div>

                    {/* Options summary */}
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[var(--surface-2)] p-3 text-xs font-bold">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="rounded-lg bg-[var(--surface)] px-2 py-1 text-[var(--text)]">
                          {job.pages ?? '?'} pages
                        </span>
                        <span className="rounded-lg bg-[var(--surface)] px-2 py-1 text-[var(--text)]">
                          {job.color ? 'Colour' : 'B&W'}
                        </span>
                        <span className="rounded-lg bg-[var(--surface)] px-2 py-1 text-[var(--text)]">
                          {job.double_sided ? '2-sided' : '1-sided'}
                        </span>
                        <span className="rounded-lg bg-[var(--surface)] px-2 py-1 text-[var(--text)]">
                          {job.copies} {job.copies === 1 ? 'copy' : 'copies'}
                        </span>
                        <span className="rounded-lg bg-[var(--surface)] px-2 py-1 text-[var(--text)]">
                          {job.paper}
                        </span>
                      </div>
                      <span className="text-base font-black text-[var(--primary)] tabular-nums">
                        {formatPaise(job.cost_paise)}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={busy || !job.file_path}
                      onClick={() => handleDownload(job)}
                      className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 text-sm font-bold text-[var(--text)] hover:border-[var(--primary)] disabled:opacity-50 cursor-pointer"
                    >
                      <Download className="h-4 w-4 text-[var(--primary)]" />
                      <span>Download to Print</span>
                    </button>

                    {job.status === 'paid' && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleStatusAction(job, 'start_printing')}
                        className="inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 text-sm font-extrabold text-white hover:opacity-90 disabled:opacity-50 cursor-pointer"
                      >
                        <Printer className="h-4 w-4" />
                        <span>Start Printing</span>
                      </button>
                    )}

                    {job.status === 'printing' && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleStatusAction(job, 'ready')}
                        className="inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--success)] px-4 text-sm font-extrabold text-white hover:opacity-90 disabled:opacity-50 cursor-pointer"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        <span>Mark Ready</span>
                      </button>
                    )}

                    {job.status === 'ready' && (
                      <button
                        type="button"
                        onClick={() => {
                          setScannerCode(shortRef)
                          setScannerOpen(true)
                        }}
                        className="inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 text-sm font-extrabold text-white hover:bg-[var(--primary-hover)] cursor-pointer"
                      >
                        <QrCode className="h-4 w-4" />
                        <span>Collected (Scan QR)</span>
                      </button>
                    )}

                    {(job.status === 'paid' || job.status === 'printing') && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setRejectJob(job)}
                        aria-label={`Reject ${shortRef}`}
                        className="inline-flex min-h-[48px] min-w-[48px] items-center justify-center rounded-xl border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 text-[var(--danger)] hover:bg-[var(--danger)] hover:text-white cursor-pointer"
                      >
                        <XCircle className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </motion.article>
              )
            })}
          </div>
        )}
      </main>

      <QrScannerModal
        open={scannerOpen}
        kind="print"
        initialCode={scannerCode}
        onClose={() => setScannerOpen(false)}
        onCollected={() => fetchQueue(true)}
      />

      <RejectModal
        open={Boolean(rejectJob)}
        title={rejectJob ? `Reject ${rejectJob.original_name}` : 'Reject Print Job'}
        presets={[
          'Corrupt or unprintable layout',
          'Paper size out of stock',
          'Printer maintenance',
        ]}
        submitting={rejectSubmitting}
        onClose={() => setRejectJob(null)}
        onConfirm={handleConfirmReject}
      />
    </div>
  )
}
