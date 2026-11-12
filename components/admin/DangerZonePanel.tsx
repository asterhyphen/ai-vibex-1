'use client'

import { useState } from 'react'
import { AlertTriangle, CalendarSync, ClockAlert, Loader2, RotateCcw, ShieldOff, X } from 'lucide-react'
import { toast } from 'sonner'

type DangerAction = 'reset_orders' | 'reseed_slots' | 'flag_noshows' | 'clear_lockouts'

interface DangerActionConfig {
  id: DangerAction
  label: string
  description: string
  buttonText: string
  icon: typeof RotateCcw
}

const ACTIONS: DangerActionConfig[] = [
  {
    id: 'flag_noshows',
    label: 'Flag Overdue No-Shows',
    description:
      'Runs flag_overdue_noshows() to mark orders >20m overdue and release slot capacity.',
    buttonText: 'Run No-Show Sweep',
    icon: ClockAlert,
  },
  {
    id: 'reseed_slots',
    label: "Regenerate Today's Pickup Slots",
    description:
      'Rebuilds today’s 72 slots (08:00–20:00, 10-min intervals) with default capacity.',
    buttonText: 'Regenerate Slots',
    icon: CalendarSync,
  },
  {
    id: 'clear_lockouts',
    label: 'Clear Portal Lockouts',
    description:
      'Removes all failed staff/admin login attempt counters and active 5-minute lockouts.',
    buttonText: 'Clear Lockouts',
    icon: ShieldOff,
  },
  {
    id: 'reset_orders',
    label: 'Reset Demo Orders & Print Jobs',
    description:
      'Deletes all orders, order_items, print_jobs, notifications, and resets slot usage to 0.',
    buttonText: 'Reset Transactional Data',
    icon: RotateCcw,
  },
]

export function DangerZonePanel({ onComplete }: { onComplete?: () => void }) {
  const [selected, setSelected] = useState<DangerActionConfig | null>(null)
  const [confirmText, setConfirmText] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleRun = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selected || confirmText.trim() !== 'CONFIRM') return
    setSubmitting(true)
    try {
      const res = await fetch('/api/admin/danger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: selected.id, confirm: 'CONFIRM' }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Action failed')
        return
      }
      toast.success(data.message || 'Operation completed')
      setSelected(null)
      setConfirmText('')
      onComplete?.()
    } catch {
      toast.error('Network error executing operation')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="rounded-3xl border-2 border-[var(--danger)]/40 bg-[var(--danger)]/5 p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--danger)]/15 text-[var(--danger)]">
          <AlertTriangle className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-base font-black text-[var(--danger)]">
            Danger Zone
          </h2>
          <p className="text-xs font-medium text-[var(--text-muted)]">
            Destructive maintenance &amp; demo-reset controls (every run is audited)
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {ACTIONS.map((item) => {
          const Icon = item.icon
          return (
            <div
              key={item.id}
              className="flex flex-col justify-between gap-3 rounded-2xl border border-[var(--danger)]/30 bg-[var(--surface)] p-4"
            >
              <div>
                <div className="flex items-center gap-2 text-sm font-extrabold text-[var(--text)]">
                  <Icon className="h-4 w-4 text-[var(--danger)]" />
                  <span>{item.label}</span>
                </div>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  {item.description}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setConfirmText('')
                  setSelected(item)
                }}
                className="min-h-[42px] self-start rounded-xl border border-[var(--danger)] bg-[var(--danger)]/10 px-4 text-xs font-extrabold text-[var(--danger)] hover:bg-[var(--danger)] hover:text-white transition-colors cursor-pointer"
              >
                {item.buttonText}
              </button>
            </div>
          )
        })}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-black text-[var(--danger)]">
                Confirm: {selected.label}
              </h3>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-xl border border-[var(--border)] p-2 text-[var(--text-muted)] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-sm text-[var(--text-muted)]">
              {selected.description}
            </p>

            <form onSubmit={handleRun} className="mt-4 space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-bold text-[var(--text-muted)]">
                  Type <span className="font-black text-[var(--danger)]">CONFIRM</span> to proceed
                </label>
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="CONFIRM"
                  autoFocus
                  className="min-h-[44px] w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3.5 text-sm font-bold uppercase text-[var(--text)] outline-none focus:border-[var(--danger)]"
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="min-h-[44px] flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-sm font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || confirmText.trim() !== 'CONFIRM'}
                  className="flex min-h-[44px] flex-1 items-center justify-center rounded-xl bg-[var(--danger)] text-sm font-extrabold text-white disabled:opacity-45 cursor-pointer"
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Execute'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  )
}
