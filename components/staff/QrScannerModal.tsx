'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Camera,
  CheckCircle2,
  KeyRound,
  Loader2,
  QrCode,
  RotateCcw,
  X,
  XCircle,
} from 'lucide-react'

interface QrScannerModalProps {
  open: boolean
  kind?: 'order' | 'print'
  initialCode?: string
  onClose: () => void
  onCollected?: (result: { kind: 'order' | 'print'; id?: string }) => void
}

type ScanOutcome =
  | {
      state: 'collected'
      title: string
      subtitle: string
      kind: 'order' | 'print'
      id?: string
    }
  | {
      state: 'already_collected' | 'invalid' | 'not_ready'
      title: string
      subtitle: string
    }

interface BarcodeDetectorLike {
  detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>>
}

export function QrScannerModal(props: QrScannerModalProps) {
  if (!props.open) return null
  return <QrScannerModalInner {...props} />
}

function QrScannerModalInner({
  kind = 'order',
  initialCode = '',
  onClose,
  onCollected,
}: QrScannerModalProps) {
  const [tab, setTab] = useState<'camera' | 'manual'>(initialCode ? 'manual' : 'camera')
  const [manualCode, setManualCode] = useState(initialCode)
  const [manualOtp, setManualOtp] = useState('')
  const [tokenInput, setTokenInput] = useState('')
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [detectorSupported, setDetectorSupported] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [outcome, setOutcome] = useState<ScanOutcome | null>(null)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const scanLockRef = useRef(false)

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
  }, [])

  const submitScan = useCallback(
    async (payload: { qr_token?: string; code?: string; otp?: string }) => {
      if (scanLockRef.current) return
      scanLockRef.current = true
      setSubmitting(true)

      try {
        const res = await fetch('/api/staff/orders/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, kind }),
        })
        const data = await res.json()

        if (res.ok && data.status === 'collected') {
          stopCamera()
          const itemLabel =
            data.kind === 'print'
              ? data.printJob?.original_name || 'Print Job'
              : data.order?.code || 'Order'
          const itemId = data.kind === 'print' ? data.printJob?.id : data.order?.id
          setOutcome({
            state: 'collected',
            title: 'Collected',
            subtitle: `${itemLabel} verified and marked as collected.`,
            kind: data.kind ?? kind,
            id: itemId,
          })
          onCollected?.({ kind: data.kind ?? kind, id: itemId })
          return
        }

        if (data.status === 'already_collected') {
          setOutcome({
            state: 'already_collected',
            title: 'Already Collected',
            subtitle: data.error || 'This QR token has already been used.',
          })
          return
        }

        if (data.status === 'not_ready') {
          setOutcome({
            state: 'not_ready',
            title: 'Not Ready Yet',
            subtitle: data.error || 'Order is still in progress.',
          })
          return
        }

        setOutcome({
          state: 'invalid',
          title: 'Invalid QR',
          subtitle: data.error || 'QR token or OTP did not match any ready item.',
        })
      } catch {
        setOutcome({
          state: 'invalid',
          title: 'Verification Error',
          subtitle: 'Could not reach verification server.',
        })
      } finally {
        setSubmitting(false)
      }
    },
    [kind, onCollected, stopCamera]
  )

  // Live camera + BarcodeDetector loop when Camera tab is active
  useEffect(() => {
    if (tab !== 'camera' || outcome) {
      stopCamera()
      return
    }

    let cancelled = false
    let intervalId: ReturnType<typeof setInterval> | null = null

    async function startCamera() {
      setCameraError(null)
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError('Camera access is not supported in this browser.')
        return
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play().catch(() => {})
        }

        const win = window as unknown as {
          BarcodeDetector?: new (opts: { formats: string[] }) => BarcodeDetectorLike
        }

        if (!win.BarcodeDetector) {
          setDetectorSupported(false)
          return
        }

        setDetectorSupported(true)
        const detector = new win.BarcodeDetector({ formats: ['qr_code'] })
        intervalId = setInterval(async () => {
          if (cancelled || scanLockRef.current || !videoRef.current) return
          if (videoRef.current.readyState < 2) return
          try {
            const results = await detector.detect(videoRef.current)
            const rawValue = results[0]?.rawValue?.trim()
            if (rawValue) {
              await submitScan({ qr_token: rawValue })
            }
          } catch {
            // Ignore transient frame decode errors
          }
        }, 280)
      } catch {
        setCameraError('Camera permission denied or unavailable. Use manual code or paste token.')
      }
    }

    startCamera()

    return () => {
      cancelled = true
      if (intervalId) clearInterval(intervalId)
      stopCamera()
    }
  }, [tab, outcome, stopCamera, submitScan])

  const resetScanner = () => {
    scanLockRef.current = false
    setOutcome(null)
    setManualOtp('')
    setTokenInput('')
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 12 }}
          className="w-full max-w-lg overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl"
        >
          {/* Modal Header */}
          <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
            <div className="flex items-center gap-2.5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)]">
                <QrCode className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-lg font-semibold text-[var(--text)]">
                  {kind === 'print' ? 'Collect Print Job' : 'Verify Collection QR'}
                </h2>
                <p className="text-xs text-[var(--text-muted)]">
                  Scan customer QR or verify with Code + 6-digit OTP
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                stopCamera()
                onClose()
              }}
              aria-label="Close scanner"
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Tabs */}
          {!outcome && (
            <div className="grid grid-cols-2 gap-2 border-b border-[var(--border)] bg-[var(--surface-2)] p-2">
              <button
                type="button"
                onClick={() => setTab('camera')}
                className={`flex min-h-[44px] items-center justify-center gap-2 rounded-xl text-sm font-bold transition-colors cursor-pointer ${
                  tab === 'camera'
                    ? 'bg-[var(--surface)] text-[var(--primary)] shadow-sm'
                    : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                }`}
              >
                <Camera className="h-4 w-4" />
                <span>Camera Scan</span>
              </button>
              <button
                type="button"
                onClick={() => setTab('manual')}
                className={`flex min-h-[44px] items-center justify-center gap-2 rounded-xl text-sm font-bold transition-colors cursor-pointer ${
                  tab === 'manual'
                    ? 'bg-[var(--surface)] text-[var(--primary)] shadow-sm'
                    : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                }`}
              >
                <KeyRound className="h-4 w-4" />
                <span>Code + OTP</span>
              </button>
            </div>
          )}

          <div className="p-6">
            {outcome ? (
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 24 }}
                className={`flex flex-col items-center justify-center rounded-2xl border-2 p-8 text-center ${
                  outcome.state === 'collected'
                    ? 'border-[var(--success)] bg-[var(--success)]/12'
                    : 'border-[var(--danger)] bg-[var(--danger)]/12'
                }`}
              >
                {outcome.state === 'collected' ? (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: [0, 1.2, 1] }}
                    transition={{ duration: 0.45 }}
                  >
                    <CheckCircle2 className="h-16 w-16 text-[var(--success)]" />
                  </motion.div>
                ) : (
                  <motion.div
                    initial={{ x: -8 }}
                    animate={{ x: [0, -8, 8, -5, 5, 0] }}
                    transition={{ duration: 0.4 }}
                  >
                    <XCircle className="h-16 w-16 text-[var(--danger)]" />
                  </motion.div>
                )}

                <h3
                  className={`mt-4 text-2xl font-bold ${
                    outcome.state === 'collected'
                      ? 'text-[var(--success)]'
                      : 'text-[var(--danger)]'
                  }`}
                >
                  {outcome.title}
                </h3>
                <p className="mt-2 text-sm font-medium text-[var(--text)]">
                  {outcome.subtitle}
                </p>

                <div className="mt-6 flex w-full gap-3">
                  <button
                    type="button"
                    onClick={resetScanner}
                    className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-bold text-[var(--text)] hover:border-[var(--primary)] cursor-pointer"
                  >
                    <RotateCcw className="h-4 w-4" />
                    <span>Scan Next</span>
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex min-h-[48px] flex-1 items-center justify-center rounded-xl bg-[var(--primary)] px-4 text-sm font-bold text-white hover:bg-[var(--primary-hover)] cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </motion.div>
            ) : tab === 'camera' ? (
              <div className="space-y-4">
                <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-[var(--border)] bg-black">
                  <video
                    ref={videoRef}
                    muted
                    playsInline
                    className="h-full w-full object-cover"
                  />
                  {/* Reticle overlay */}
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <div className="h-44 w-44 rounded-2xl border-2 border-[var(--accent)] shadow-[0_0_0_9999px_rgba(0,0,0,0.42)]" />
                  </div>
                  {cameraError && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 p-6 text-center text-white">
                      <Camera className="mb-2 h-9 w-9 text-[var(--accent)]" />
                      <p className="text-sm font-semibold">{cameraError}</p>
                    </div>
                  )}
                  {!cameraError && !detectorSupported && (
                    <div className="absolute bottom-3 left-3 right-3 rounded-xl bg-black/75 px-3 py-2 text-center text-xs font-medium text-amber-200">
                      Auto QR decoding unavailable in this browser — paste QR token below or use Code + OTP.
                    </div>
                  )}
                </div>

                {/* Direct QR Token Fallback Input */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    if (!tokenInput.trim()) return
                    submitScan({ qr_token: tokenInput.trim() })
                  }}
                  className="flex gap-2"
                >
                  <input
                    type="text"
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    placeholder="Or paste QR token string..."
                    className="min-h-[48px] flex-1 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3.5 text-sm text-[var(--text)] outline-none focus:border-[var(--primary)]"
                  />
                  <button
                    type="submit"
                    disabled={submitting || !tokenInput.trim()}
                    className="min-h-[48px] rounded-xl bg-[var(--primary)] px-4 text-sm font-bold text-white hover:bg-[var(--primary-hover)] disabled:opacity-50 cursor-pointer"
                  >
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verify'}
                  </button>
                </form>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  if (!manualCode.trim() || manualOtp.trim().length !== 6) return
                  submitScan({
                    code: manualCode.trim().toUpperCase(),
                    otp: manualOtp.trim(),
                  })
                }}
                className="space-y-4"
              >
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                    {kind === 'print' ? 'Print Job Code (e.g. P-A1B2C3)' : 'Order Code (e.g. A-0142)'}
                  </label>
                  <input
                    type="text"
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                    placeholder={kind === 'print' ? 'P-A1B2C3' : 'A-0142'}
                    required
                    className="min-h-[48px] w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-4 text-base font-bold uppercase tracking-wider text-[var(--text)] outline-none focus:border-[var(--primary)]"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                    6-Digit Collection OTP
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={manualOtp}
                    onChange={(e) => setManualOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="123456"
                    required
                    className="min-h-[48px] w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-4 text-center text-2xl font-bold tracking-[0.4em] text-[var(--text)] outline-none focus:border-[var(--primary)] tabular-nums"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting || !manualCode.trim() || manualOtp.length !== 6}
                  className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-white shadow-sm hover:bg-[var(--primary-hover)] disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <span>Verify &amp; Mark Collected</span>
                  )}
                </button>
              </form>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
