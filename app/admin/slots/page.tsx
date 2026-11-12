'use client'

import { useEffect, useState } from 'react'
import { CalendarPlus, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import type { PickupSlot } from '@/lib/types'
import { formatSlotTime } from '@/lib/utils/format'
import { AdminShell } from '@/components/admin/AdminShell'
import { DataGrid, type TableConfig } from '@/components/admin/DataGrid'

const SLOTS_CONFIG: TableConfig = {
  tableName: 'pickup_slots',
  searchable: ['slot_start', 'slot_end'],
  editable: true,
  creatable: false,
  deletable: true,
  columns: [
    { key: 'slot_start', label: 'Slot Start', type: 'datetime', editable: false },
    { key: 'slot_end', label: 'Slot End', type: 'datetime', editable: false },
    {
      key: 'capacity_units',
      label: 'Capacity Units',
      type: 'number',
      editable: true,
    },
    { key: 'used_units', label: 'Used Units', type: 'number', editable: true },
  ],
}

export default function AdminSlotsPage() {
  const [slots, setSlots] = useState<PickupSlot[]>([])
  const [refreshSignal, setRefreshSignal] = useState(0)
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch('/api/admin/pickup_slots?pageSize=200', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setSlots(data.rows ?? [])
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [refreshSignal])

  const handleGenerateSlots = async () => {
    setGenerating(true)
    try {
      const res = await fetch('/api/admin/slots/generate', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Failed to generate slots')
        return
      }
      toast.success(data.message || 'Slots updated')
      setRefreshSignal((s) => s + 1)
    } catch {
      toast.error('Network error generating slots')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <AdminShell
      title="Pickup Slots & Capacity"
      subtitle="Live 10-minute pickup window heatmap and capacity adjustments"
      actions={
        <button
          type="button"
          disabled={generating}
          onClick={handleGenerateSlots}
          className="inline-flex min-h-[42px] items-center gap-2 rounded-xl bg-[var(--primary)] px-4 text-xs font-extrabold text-white hover:bg-[var(--primary-hover)] disabled:opacity-50 cursor-pointer"
        >
          {generating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CalendarPlus className="h-4 w-4" />
          )}
          <span>Generate Today&apos;s Slots</span>
        </button>
      }
    >
      <div className="space-y-6">
        {/* Visual Heatmap */}
        <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-extrabold text-[var(--text)]">
              Slot Fill Heatmap ({slots.length} windows)
            </h2>
            <div className="flex items-center gap-3 text-xs font-bold text-[var(--text-muted)]">
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-sm bg-[var(--success)]" />
                &lt;50%
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-sm bg-[var(--warning)]" />
                50–80%
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-sm bg-[var(--danger)]" />
                &gt;80%
              </span>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2 sm:grid-cols-8 lg:grid-cols-12">
            {slots.slice(0, 72).map((slot) => {
              const cap = Math.max(1, slot.capacity_units)
              const pct = Math.min(100, Math.round((slot.used_units / cap) * 100))
              const style =
                pct > 80
                  ? 'border-[var(--danger)]/45 bg-[var(--danger)]/15 text-[var(--danger)]'
                  : pct >= 50
                    ? 'border-[var(--warning)]/45 bg-[var(--warning)]/15 text-[var(--warning)]'
                    : 'border-[var(--success)]/35 bg-[var(--success)]/12 text-[var(--success)]'

              return (
                <div
                  key={slot.id}
                  title={`${formatSlotTime(slot.slot_start)}: ${slot.used_units}/${slot.capacity_units}`}
                  className={`rounded-xl border p-2 text-center ${style}`}
                >
                  <div className="text-[11px] font-extrabold tabular-nums">
                    {formatSlotTime(slot.slot_start).replace(/\s?(am|pm)/i, '')}
                  </div>
                  <div className="text-[10px] font-bold tabular-nums">
                    {slot.used_units}/{slot.capacity_units}
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        <DataGrid config={SLOTS_CONFIG} refreshSignal={refreshSignal} />
      </div>
    </AdminShell>
  )
}
