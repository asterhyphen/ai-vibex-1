'use client'

import { useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  FileCheck2,
  FileUp,
  Layers,
  Loader2,
  Minus,
  Plus,
  Printer,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Trash2,
  Wallet,
} from 'lucide-react'
import { toast } from 'sonner'
import { ThemeToggle } from '@/components/auth/ThemeToggle'
import { AnimatedPrice } from '@/components/print/AnimatedPrice'
import { formatPaise } from '@/lib/utils/format'
import { calculatePrintCostPaise } from '@/lib/validators/print'

interface UploadedPdfInfo {
  file_path: string
  original_name: string
  pages: number
  sanitised: boolean
  stripped_elements?: string[]
}

const MAX_BYTES = 20 * 1024 * 1024

export default function PrintUploadPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [dragActive, setDragActive] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploaded, setUploaded] = useState<UploadedPdfInfo | null>(null)

  // Print options
  const [color, setColor] = useState(false)
  const [doubleSided, setDoubleSided] = useState(false)
  const [copies, setCopies] = useState(1)
  const [paper, setPaper] = useState<'A4' | 'A3'>('A4')

  // Fake gateway state
  const [gatewayTab, setGatewayTab] = useState<'upi' | 'card' | 'wallet'>('upi')
  const [upiId, setUpiId] = useState('mitecanteen@upi')
  const [cardName, setCardName] = useState('')
  const [cardNumber, setCardNumber] = useState('4532 •••• •••• 8891')
  const [cardExpiry, setCardExpiry] = useState('08/28')
  const [cardCvv, setCardCvv] = useState('421')
  const [walletApp, setWalletApp] = useState<'GPay' | 'PhonePe' | 'Paytm'>('GPay')
  const [payStage, setPayStage] = useState<'idle' | 'processing' | 'success'>('idle')

  const costBreakdown = useMemo(() => {
    const pages = uploaded?.pages ?? 1
    return calculatePrintCostPaise({
      pages,
      color,
      double_sided: doubleSided,
      copies,
      paper,
    })
  }, [uploaded?.pages, color, doubleSided, copies, paper])

  const processFile = async (file: File) => {
    setUploadError(null)
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      const msg = 'Only PDF files (.pdf) are supported'
      setUploadError(msg)
      toast.error(msg)
      return
    }
    if (file.size > MAX_BYTES) {
      const msg = 'File exceeds 20 MB maximum size limit'
      setUploadError(msg)
      toast.error(msg)
      return
    }

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/print/upload', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) {
        setUploadError(data.error || 'PDF verification failed')
        toast.error(data.error || 'Could not process PDF')
        return
      }
      setUploaded(data as UploadedPdfInfo)
      toast.success('PDF scanned, cleaned, and verified!')
    } catch {
      setUploadError('Network error uploading PDF')
      toast.error('Network error uploading PDF')
    } finally {
      setUploading(false)
    }
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    const dropped = e.dataTransfer.files?.[0]
    if (dropped) processFile(dropped)
  }

  const handlePayAndSubmit = async () => {
    if (!uploaded || payStage !== 'idle') return
    setPayStage('processing')

    // Simulated 2s payment gateway animation
    await new Promise((r) => setTimeout(r, 1800))

    try {
      const res = await fetch('/api/print/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_path: uploaded.file_path,
          original_name: uploaded.original_name,
          pages: uploaded.pages,
          color,
          double_sided: doubleSided,
          copies,
          paper,
          payment_method: 'online',
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setPayStage('idle')
        toast.error(data.error || 'Could not submit print job')
        return
      }

      setPayStage('success')
      toast.success('Print job paid & queued!')
      setTimeout(() => {
        router.push(`/print/${data.job.id}`)
      }, 900)
    } catch {
      setPayStage('idle')
      toast.error('Network error submitting print job')
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] pb-16">
      {/* Top Bar */}
      <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Link
              href="/home"
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] hover:border-[var(--primary)]"
              aria-label="Back to menu"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-lg font-black tracking-tight text-[var(--text)]">
                MITE Print Shop
              </h1>
              <p className="text-xs text-[var(--text-muted)]">
                Upload PDF, sanitise &amp; skip the print counter queue
              </p>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6">
        {/* Step 1: Drag-and-drop PDF Upload */}
        <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)]">
                <Printer className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-base font-extrabold text-[var(--text)]">
                  1. Upload PDF Document
                </h2>
                <p className="text-xs text-[var(--text-muted)]">
                  PDF only · Max 20 MB · Max 100 pages · Auto-sanitised server-side
                </p>
              </div>
            </div>

            {uploaded && (
              <button
                type="button"
                onClick={() => {
                  setUploaded(null)
                  setUploadError(null)
                  setPayStage('idle')
                }}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-[var(--border)] px-3 text-xs font-bold text-[var(--text-muted)] hover:border-[var(--danger)] hover:text-[var(--danger)] cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Replace PDF</span>
              </button>
            )}
          </div>

          {!uploaded ? (
            <motion.div
              animate={{
                scale: dragActive ? 1.015 : 1,
                borderColor: dragActive ? 'var(--primary)' : 'var(--border)',
              }}
              onDragEnter={(e) => {
                e.preventDefault()
                setDragActive(true)
              }}
              onDragOver={(e) => {
                e.preventDefault()
                setDragActive(true)
              }}
              onDragLeave={(e) => {
                e.preventDefault()
                setDragActive(false)
              }}
              onDrop={handleDrop}
              onClick={() => !uploading && fileInputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  fileInputRef.current?.click()
                }
              }}
              className={`relative flex min-h-[220px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition-colors ${
                dragActive
                  ? 'bg-[var(--primary-soft)]/60 border-[var(--primary)]'
                  : 'bg-[var(--surface-2)]/60 hover:border-[var(--primary)]'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={(e) => {
                  const chosen = e.target.files?.[0]
                  if (chosen) processFile(chosen)
                  e.target.value = ''
                }}
              />

              {uploading ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="h-12 w-12 animate-spin text-[var(--primary)]" />
                  <p className="text-base font-extrabold text-[var(--text)]">
                    Scanning &amp; sanitising PDF...
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">
                    Checking magic bytes, stripping scripts/actions, counting pages
                  </p>
                </div>
              ) : (
                <>
                  <motion.div
                    animate={dragActive ? { y: -6 } : { y: [0, -4, 0] }}
                    transition={{ repeat: Infinity, duration: 2.4, ease: 'easeInOut' }}
                    className="mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--primary-soft)] text-[var(--primary)]"
                  >
                    <FileUp className="h-8 w-8" />
                  </motion.div>
                  <p className="text-base font-extrabold text-[var(--text)]">
                    Drag &amp; drop your PDF here, or tap to browse
                  </p>
                  <p className="mt-1 text-xs font-medium text-[var(--text-muted)]">
                    Active links, JavaScript, and embedded files are automatically stripped
                  </p>
                </>
              )}
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border-2 border-[var(--success)]/45 bg-[var(--success)]/8 p-4 sm:p-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--success)] text-white shadow-sm">
                    <FileCheck2 className="h-6 w-6" />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-base font-extrabold text-[var(--text)]">
                      {uploaded.original_name}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs font-bold text-[var(--text-muted)]">
                      <span>{uploaded.pages} {uploaded.pages === 1 ? 'page' : 'pages'}</span>
                      <span>·</span>
                      <span>Ready for print</span>
                    </div>
                  </div>
                </div>

                {/* Scanned and cleaned ✓ Shield Badge with check animation */}
                <motion.div
                  initial={{ scale: 0.85, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                  className="inline-flex items-center gap-2 rounded-full bg-[var(--success)] px-4 py-2 text-xs font-extrabold text-white shadow-sm"
                >
                  <ShieldCheck className="h-4 w-4" />
                  <span>Scanned and cleaned ✓</span>
                </motion.div>
              </div>

              {uploaded.stripped_elements && uploaded.stripped_elements.length > 0 && (
                <div className="mt-3 rounded-xl bg-[var(--surface)] px-3 py-2 text-xs font-medium text-[var(--text-muted)]">
                  Removed {uploaded.stripped_elements.length} potentially active PDF element
                  {uploaded.stripped_elements.length === 1 ? '' : 's'} during page rebuild.
                </div>
              )}
            </motion.div>
          )}

          {uploadError && (
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-4 py-3 text-sm font-bold text-[var(--danger)]">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{uploadError}</span>
            </div>
          )}
        </section>

        {/* Step 2 & 3: Options Panel + Payment */}
        <AnimatePresence>
          {uploaded && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid grid-cols-1 gap-6 lg:grid-cols-12"
            >
              {/* Options Panel */}
              <section className="space-y-5 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm sm:p-6 lg:col-span-7">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--accent)]/20 text-[var(--accent)]">
                    <Layers className="h-5 w-5" />
                  </span>
                  <div>
                    <h2 className="text-base font-extrabold text-[var(--text)]">
                      2. Print Preferences
                    </h2>
                    <p className="text-xs text-[var(--text-muted)]">
                      Customize colour, sides, copies, and sheet size
                    </p>
                  </div>
                </div>

                {/* Colour Mode */}
                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                    Ink / Colour
                  </label>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setColor(false)}
                      className={`min-h-[54px] rounded-2xl border-2 px-4 text-left transition-all cursor-pointer ${
                        !color
                          ? 'border-[var(--primary)] bg-[var(--primary-soft)]'
                          : 'border-[var(--border)] bg-[var(--surface-2)]'
                      }`}
                    >
                      <div className="text-sm font-extrabold text-[var(--text)]">
                        Black &amp; White
                      </div>
                      <div className="text-xs font-semibold text-[var(--text-muted)]">
                        ₹2 / page (A4)
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setColor(true)}
                      className={`min-h-[54px] rounded-2xl border-2 px-4 text-left transition-all cursor-pointer ${
                        color
                          ? 'border-[var(--primary)] bg-[var(--primary-soft)]'
                          : 'border-[var(--border)] bg-[var(--surface-2)]'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 text-sm font-extrabold text-[var(--text)]">
                        <span>Colour</span>
                        <Sparkles className="h-3.5 w-3.5 text-[var(--accent)]" />
                      </div>
                      <div className="text-xs font-semibold text-[var(--text-muted)]">
                        ₹10 / page (A4)
                      </div>
                    </button>
                  </div>
                </div>

                {/* Sides */}
                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                    Printing Sides
                  </label>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setDoubleSided(false)}
                      className={`min-h-[52px] rounded-2xl border-2 px-4 text-left transition-all cursor-pointer ${
                        !doubleSided
                          ? 'border-[var(--primary)] bg-[var(--primary-soft)]'
                          : 'border-[var(--border)] bg-[var(--surface-2)]'
                      }`}
                    >
                      <div className="text-sm font-extrabold text-[var(--text)]">
                        Single-sided
                      </div>
                      <div className="text-xs text-[var(--text-muted)]">
                        {uploaded.pages} sheets
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setDoubleSided(true)}
                      className={`min-h-[52px] rounded-2xl border-2 px-4 text-left transition-all cursor-pointer ${
                        doubleSided
                          ? 'border-[var(--primary)] bg-[var(--primary-soft)]'
                          : 'border-[var(--border)] bg-[var(--surface-2)]'
                      }`}
                    >
                      <div className="text-sm font-extrabold text-[var(--text)]">
                        Double-sided
                      </div>
                      <div className="text-xs text-[var(--text-muted)]">
                        {Math.ceil(uploaded.pages / 2)} sheets (ceil(pages/2))
                      </div>
                    </button>
                  </div>
                </div>

                {/* Copies & Paper */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                      Copies (1–50)
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setCopies((c) => Math.max(1, c - 1))}
                        aria-label="Decrease copies"
                        className="flex h-12 w-12 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] hover:border-[var(--primary)] cursor-pointer"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <input
                        type="number"
                        min={1}
                        max={50}
                        value={copies}
                        onChange={(e) => {
                          const n = Number.parseInt(e.target.value, 10)
                          if (Number.isFinite(n)) {
                            setCopies(Math.max(1, Math.min(50, n)))
                          }
                        }}
                        className="h-12 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] text-center text-lg font-black text-[var(--text)] outline-none focus:border-[var(--primary)] tabular-nums"
                      />
                      <button
                        type="button"
                        onClick={() => setCopies((c) => Math.min(50, c + 1))}
                        aria-label="Increase copies"
                        className="flex h-12 w-12 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] hover:border-[var(--primary)] cursor-pointer"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                      Paper Size
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {(['A4', 'A3'] as const).map((sz) => (
                        <button
                          key={sz}
                          type="button"
                          onClick={() => setPaper(sz)}
                          className={`min-h-[48px] rounded-xl border-2 text-sm font-extrabold transition-all cursor-pointer ${
                            paper === sz
                              ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]'
                              : 'border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)]'
                          }`}
                        >
                          {sz} {sz === 'A3' ? '(2×)' : ''}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Live Animated Total & Breakdown */}
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm font-bold text-[var(--text-muted)]">
                      Estimated Total
                    </span>
                    <AnimatedPrice
                      paise={costBreakdown.totalPaise}
                      className="text-3xl font-black text-[var(--primary)]"
                    />
                  </div>
                  <div className="mt-2 space-y-1 border-t border-[var(--border)] pt-2 text-xs text-[var(--text-muted)]">
                    <div className="flex justify-between">
                      <span>
                        Effective sheets ({doubleSided ? `ceil(${uploaded.pages}/2)` : uploaded.pages})
                      </span>
                      <span className="font-bold text-[var(--text)]">
                        {costBreakdown.effectivePages} sheets
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>
                        Rate ({color ? 'Colour' : 'B&W'} × {paper})
                      </span>
                      <span className="font-bold text-[var(--text)]">
                        {formatPaise(costBreakdown.unitRatePaise)} / sheet
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Formula</span>
                      <span className="font-bold text-[var(--text)]">
                        {costBreakdown.effectivePages} × {formatPaise(costBreakdown.unitRatePaise)} × {copies}{' '}
                        {copies === 1 ? 'copy' : 'copies'}
                      </span>
                    </div>
                  </div>
                </div>
              </section>

              {/* Fake Payment Gateway */}
              <section className="flex flex-col justify-between rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm sm:p-6 lg:col-span-5">
                <div>
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-base font-extrabold text-[var(--text)]">
                      3. Pay &amp; Queue Job
                    </h2>
                    <span className="rounded-full bg-[var(--surface-2)] px-2.5 py-0.5 text-[11px] font-bold text-[var(--text-muted)]">
                      Demo Gateway
                    </span>
                  </div>

                  {payStage === 'success' ? (
                    <div className="flex min-h-[260px] flex-col items-center justify-center text-center">
                      <svg className="h-20 w-20 text-[var(--success)]" viewBox="0 0 52 52">
                        <circle
                          cx="26"
                          cy="26"
                          r="24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                          opacity="0.25"
                        />
                        <motion.path
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="4"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M14 27l8 8 16-16"
                          initial={{ pathLength: 0 }}
                          animate={{ pathLength: 1 }}
                          transition={{ duration: 0.6, ease: 'easeOut' }}
                        />
                      </svg>
                      <h3 className="mt-3 text-xl font-black text-[var(--success)]">
                        Payment Confirmed!
                      </h3>
                      <p className="mt-1 text-xs text-[var(--text-muted)]">
                        Generating your collection QR &amp; redirecting...
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* Sub-tabs: UPI / Card / Wallet */}
                      <div className="mb-4 grid grid-cols-3 gap-1.5 rounded-2xl bg-[var(--surface-2)] p-1.5">
                        {[
                          { id: 'upi', label: 'UPI', icon: Smartphone },
                          { id: 'card', label: 'Card', icon: CreditCard },
                          { id: 'wallet', label: 'Wallet', icon: Wallet },
                        ].map((tab) => {
                          const Icon = tab.icon
                          const active = gatewayTab === tab.id
                          return (
                            <button
                              key={tab.id}
                              type="button"
                              onClick={() => setGatewayTab(tab.id as 'upi' | 'card' | 'wallet')}
                              className={`flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                                active
                                  ? 'bg-[var(--surface)] text-[var(--primary)] shadow-sm'
                                  : 'text-[var(--text-muted)]'
                              }`}
                            >
                              <Icon className="h-3.5 w-3.5" />
                              <span>{tab.label}</span>
                            </button>
                          )
                        })}
                      </div>

                      {gatewayTab === 'upi' && (
                        <div className="space-y-3">
                          <label className="block text-xs font-bold text-[var(--text-muted)]">
                            UPI ID
                          </label>
                          <input
                            type="text"
                            value={upiId}
                            onChange={(e) => setUpiId(e.target.value)}
                            className="min-h-[48px] w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-4 text-sm font-semibold text-[var(--text)] outline-none focus:border-[var(--primary)]"
                          />
                          <p className="text-xs text-[var(--text-muted)]">
                            Instant simulated UPI collect for demo verification.
                          </p>
                        </div>
                      )}

                      {gatewayTab === 'card' && (
                        <div className="space-y-3">
                          <input
                            type="text"
                            value={cardName}
                            onChange={(e) => setCardName(e.target.value)}
                            placeholder="Cardholder Name"
                            className="min-h-[44px] w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3.5 text-sm text-[var(--text)] outline-none focus:border-[var(--primary)]"
                          />
                          <input
                            type="text"
                            value={cardNumber}
                            onChange={(e) => setCardNumber(e.target.value)}
                            placeholder="Card Number"
                            className="min-h-[44px] w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3.5 text-sm text-[var(--text)] outline-none focus:border-[var(--primary)] tabular-nums"
                          />
                          <div className="grid grid-cols-2 gap-2.5">
                            <input
                              type="text"
                              value={cardExpiry}
                              onChange={(e) => setCardExpiry(e.target.value)}
                              placeholder="MM/YY"
                              className="min-h-[44px] rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3.5 text-sm text-[var(--text)] outline-none focus:border-[var(--primary)] tabular-nums"
                            />
                            <input
                              type="password"
                              value={cardCvv}
                              onChange={(e) => setCardCvv(e.target.value)}
                              placeholder="CVV"
                              className="min-h-[44px] rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3.5 text-sm text-[var(--text)] outline-none focus:border-[var(--primary)] tabular-nums"
                            />
                          </div>
                        </div>
                      )}

                      {gatewayTab === 'wallet' && (
                        <div className="grid grid-cols-3 gap-2">
                          {(['GPay', 'PhonePe', 'Paytm'] as const).map((app) => (
                            <button
                              key={app}
                              type="button"
                              onClick={() => setWalletApp(app)}
                              className={`min-h-[56px] rounded-xl border-2 text-xs font-extrabold transition-colors cursor-pointer ${
                                walletApp === app
                                  ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]'
                                  : 'border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)]'
                              }`}
                            >
                              {app}
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>

                {payStage !== 'success' && (
                  <button
                    type="button"
                    disabled={payStage === 'processing'}
                    onClick={handlePayAndSubmit}
                    className="mt-6 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-[var(--primary)] px-6 text-base font-extrabold text-white shadow-md transition-transform active:scale-[0.98] hover:bg-[var(--primary-hover)] disabled:opacity-60 cursor-pointer"
                  >
                    {payStage === 'processing' ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span>Authorising Payment...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-5 w-5" />
                        <span>
                          Pay <AnimatedPrice paise={costBreakdown.totalPaise} />
                        </span>
                      </>
                    )}
                  </button>
                )}
              </section>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  )
}
