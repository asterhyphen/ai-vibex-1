'use client'

import { useMemo } from 'react'
import { Clock } from 'lucide-react'
import type { PickupSlot } from '@/lib/types'
import { formatSlotTime } from '@/lib/utils/format'

interface SlotHeatmapProps {
  slots: PickupSlot[]
  nowMs: number
}

export function SlotHeatmap({ slots, nowMs }: SlotHeatmapProps) {
  const windowSlots = useMemo(() => {
    if (slots.length === 0) return []
    const twoHoursLater = nowMs + 2 * 60 * 60 * 1000
    const upcomingWindow = slots.filter((slot) => {
      const endMs = new Date(slot.slot_end).getTime()
      const startMs = new Date(slot.slot_start).getTime()
      return endMs >= nowMs - 10 * 60_000 && startMs <= twoHoursLater
    })
    if (upcomingWindow.length > 0) return upcomingWindow.slice(0, 12)
    return slots.slice(0, 12)
  }, [slots, nowMs])

  if (windowSlots.length === 0) {
    return null
  }

  return (
    <section
      aria-label="Upcoming pickup slot load"
      className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5 shadow-sm"
    >
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
          <Clock className="h-3.5 w-3.5 text-[var(--primary)]" />
          <span>Next 2 Hours · Pickup Slot Heatmap</span>
        </div>
        <div className="flex items-center gap-3 text-[11px] font-medium text-[var(--text-muted)]">
          <span className="inline-flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-[var(--success)]" />
            &lt;50%
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-[var(--warning)]" />
            50–80%
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-[var(--danger)]" />
            &gt;80%
          </span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6 lg:grid-cols-12">
        {windowSlots.map((slot) => {
          const cap = Math.max(1, slot.capacity_units)
          const pct = Math.min(100, Math.round((slot.used_units / cap) * 100))
          const barColor =
            pct > 80
              ? 'bg-[var(--danger)]'
              : pct >= 50
                ? 'bg-[var(--warning)]'
                : 'bg-[var(--success)]'

          const badgeText =
            pct > 80
              ? 'text-[var(--danger)]'
              : pct >= 50
                ? 'text-[var(--warning)]'
                : 'text-[var(--success)]'

          return (
            <div
              key={slot.id}
              title={`${formatSlotTime(slot.slot_start)}: ${slot.used_units}/${slot.capacity_units} units (${pct}%)`}
              className="flex flex-col justify-between rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-2"
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-[11px] font-bold text-[var(--text)] tabular-nums">
                  {formatSlotTime(slot.slot_start).replace(/\s?(am|pm)/i, '')}
                </span>
                <span className={`text-[10px] font-bold tabular-nums ${badgeText}`}>
                  {pct}%
                </span>
              </div>
              <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-[var(--border)]">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                  style={{ width: `${Math.max(pct, slot.used_units > 0 ? 8 : 0)}%` }}
                />
              </div>
              <div className="mt-1 text-[10px] font-medium text-[var(--text-muted)] tabular-nums">
                {slot.used_units}/{slot.capacity_units}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
