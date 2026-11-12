'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Activity,
  Clock,
  IndianRupee,
  Loader2,
  Printer,
  RefreshCw,
  ShieldBan,
  ShoppingBag,
  TrendingUp,
} from 'lucide-react'
import { toast } from 'sonner'
import type { PickupSlot } from '@/lib/types'
import { formatPaise, formatSlotTime } from '@/lib/utils/format'
import { AdminShell } from '@/components/admin/AdminShell'

interface DashboardData {
  kpis: {
    ordersToday: number
    revenueTodayPaise: number
    avgWaitMinutes: number
    queueLength: number
    printJobsToday: number
  }
  ordersPerHour: Array<{ hour: string; label: string; count: number }>
  slots: PickupSlot[]
  top5Items: Array<{ name: string; qty: number; revenue_paise: number }>
  security: {
    blockedRequests: number
    activeLockouts: number
    blockedUsers: number
  }
}

function OrdersPerHourChart({
  data,
}: {
  data: Array<{ hour: string; label: string; count: number }>
}) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  const width = 680
  const height = 220
  const padL = 36
  const padR = 16
  const padT = 18
  const padB = 30
  const plotW = width - padL - padR
  const plotH = height - padT - padB

  const maxCount = Math.max(4, ...data.map((d) => d.count))
  const points = data.map((d, idx) => {
    const x =
      data.length > 1
        ? padL + (idx / (data.length - 1)) * plotW
        : padL + plotW / 2
    const y = padT + plotH - (d.count / maxCount) * plotH
    return { x, y, ...d }
  })

  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ')

  const areaPath =
    points.length > 0
      ? `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${(padT + plotH).toFixed(1)} L ${points[0].x.toFixed(1)} ${(padT + plotH).toFixed(1)} Z`
      : ''

  return (
    <div className="relative w-full">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-56 w-full overflow-visible"
        role="img"
        aria-label="Orders per hour over the last 24 hours"
      >
        <defs>
          <linearGradient id="miteOrdersArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.32" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Horizontal gridlines */}
        {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
          const y = padT + plotH - frac * plotH
          const val = Math.round(frac * maxCount)
          return (
            <g key={frac}>
              <line
                x1={padL}
                x2={width - padR}
                y1={y}
                y2={y}
                stroke="var(--border)"
                strokeDasharray="3 4"
              />
              <text
                x={padL - 8}
                y={y + 4}
                textAnchor="end"
                fontSize="10"
                fill="var(--text-muted)"
              >
                {val}
              </text>
            </g>
          )
        })}

        {/* Area + Line */}
        {areaPath && <path d={areaPath} fill="url(#miteOrdersArea)" />}
        {linePath && (
          <path
            d={linePath}
            fill="none"
            stroke="var(--primary)"
            strokeWidth="2.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Data dots & hover targets */}
        {points.map((pt, idx) => (
          <g key={pt.hour}>
            {idx % 4 === 0 && (
              <text
                x={pt.x}
                y={height - 8}
                textAnchor="middle"
                fontSize="10"
                fill="var(--text-muted)"
              >
                {pt.label}:00
              </text>
            )}
            <circle
              cx={pt.x}
              cy={pt.y}
              r={hoverIdx === idx ? 5.5 : 3}
              fill={hoverIdx === idx ? 'var(--accent)' : 'var(--primary)'}
              stroke="var(--surface)"
              strokeWidth="1.5"
            />
            <rect
              x={pt.x - plotW / Math.max(1, data.length) / 2}
              y={padT}
              width={plotW / Math.max(1, data.length)}
              height={plotH}
              fill="transparent"
              onMouseEnter={() => setHoverIdx(idx)}
              onMouseLeave={() => setHoverIdx(null)}
            />
          </g>
        ))}
      </svg>

      {hoverIdx !== null && points[hoverIdx] && (
        <div className="mt-1 flex items-center justify-end gap-2 text-xs font-bold text-[var(--text-muted)]">
          <span>{points[hoverIdx].label}:00</span>
          <span className="text-[var(--primary)]">
            {points[hoverIdx].count} orders
          </span>
        </div>
      )}
    </div>
  )
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  const loadDashboard = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/dashboard', { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error || 'Failed to load dashboard metrics')
        return
      }
      setData(json as DashboardData)
    } catch {
      toast.error('Network error loading dashboard')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    fetch('/api/admin/dashboard', { cache: 'no-store' })
      .then((res) => res.json().then((json) => ({ ok: res.ok, json })))
      .then(({ ok, json }) => {
        if (cancelled) return
        if (!ok) {
          toast.error(json.error || 'Failed to load dashboard metrics')
          return
        }
        setData(json as DashboardData)
      })
      .catch(() => {
        if (!cancelled) toast.error('Network error loading dashboard')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const kpis = data?.kpis ?? {
    ordersToday: 0,
    revenueTodayPaise: 0,
    avgWaitMinutes: 0,
    queueLength: 0,
    printJobsToday: 0,
  }

  return (
    <AdminShell
      title="Operations Dashboard"
      subtitle="Live canteen throughput, slot load, top items & security telemetry"
      actions={
        <button
          type="button"
          onClick={loadDashboard}
          className="inline-flex min-h-[42px] items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3.5 text-xs font-bold text-[var(--text)] hover:border-[var(--primary)] cursor-pointer"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      }
    >
      {loading && !data ? (
        <div className="flex min-h-[380px] items-center justify-center rounded-3xl border border-[var(--border)] bg-[var(--surface)]">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--primary)]" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* KPI Cards */}
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
              <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                <span>Orders Today</span>
                <ShoppingBag className="h-4 w-4 text-[var(--primary)]" />
              </div>
              <div className="mt-2 text-3xl font-black text-[var(--text)] tabular-nums">
                {kpis.ordersToday}
              </div>
            </div>

            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
              <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                <span>Revenue Today</span>
                <IndianRupee className="h-4 w-4 text-[var(--success)]" />
              </div>
              <div className="mt-2 text-3xl font-black text-[var(--primary)] tabular-nums">
                {formatPaise(kpis.revenueTodayPaise)}
              </div>
            </div>

            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
              <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                <span>Avg Wait</span>
                <Clock className="h-4 w-4 text-[var(--accent)]" />
              </div>
              <div className="mt-2 text-3xl font-black text-[var(--text)] tabular-nums">
                {kpis.avgWaitMinutes} <span className="text-base font-bold text-[var(--text-muted)]">min</span>
              </div>
            </div>

            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
              <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                <span>Queue Length</span>
                <Activity className="h-4 w-4 text-[var(--warning)]" />
              </div>
              <div className="mt-2 text-3xl font-black text-[var(--text)] tabular-nums">
                {kpis.queueLength}
              </div>
            </div>

            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
              <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                <span>Print Jobs</span>
                <Printer className="h-4 w-4 text-[var(--info)]" />
              </div>
              <div className="mt-2 text-3xl font-black text-[var(--text)] tabular-nums">
                {kpis.printJobsToday}
              </div>
            </div>
          </section>

          {/* Line Chart + Security / Blocked Counter */}
          <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm lg:col-span-8">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-extrabold text-[var(--text)]">
                    Orders per Hour (Last 24h)
                  </h2>
                  <p className="text-xs text-[var(--text-muted)]">
                    Hourly order volume across app and walk-in counter
                  </p>
                </div>
                <TrendingUp className="h-5 w-5 text-[var(--primary)]" />
              </div>
              <OrdersPerHourChart data={data?.ordersPerHour ?? []} />
            </div>

            <div className="flex flex-col justify-between rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm lg:col-span-4">
              <div>
                <div className="flex items-center gap-2.5">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--danger)]/15 text-[var(--danger)]">
                    <ShieldBan className="h-5 w-5" />
                  </span>
                  <div>
                    <h2 className="text-base font-extrabold text-[var(--text)]">
                      Security &amp; Rate Limits
                    </h2>
                    <p className="text-xs text-[var(--text-muted)]">
                      Blocked requests &amp; login lockout monitor
                    </p>
                  </div>
                </div>

                <div className="mt-5 space-y-3">
                  <div className="flex items-center justify-between rounded-2xl bg-[var(--surface-2)] p-4">
                    <span className="text-xs font-bold text-[var(--text-muted)]">
                      Blocked / Failed Auth Hits
                    </span>
                    <span className="text-2xl font-black text-[var(--danger)] tabular-nums">
                      {data?.security.blockedRequests ?? 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl bg-[var(--surface-2)] p-4">
                    <span className="text-xs font-bold text-[var(--text-muted)]">
                      Active Portal Lockouts
                    </span>
                    <span className="text-xl font-black text-[var(--warning)] tabular-nums">
                      {data?.security.activeLockouts ?? 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl bg-[var(--surface-2)] p-4">
                    <span className="text-xs font-bold text-[var(--text-muted)]">
                      Blocked Accounts
                    </span>
                    <span className="text-xl font-black text-[var(--text)] tabular-nums">
                      {data?.security.blockedUsers ?? 0}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Slot Heatmap + Top 5 Items */}
          <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Slot Heatmap */}
            <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm lg:col-span-7">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-extrabold text-[var(--text)]">
                    Today&apos;s Pickup Slot Heatmap
                  </h2>
                  <p className="text-xs text-[var(--text-muted)]">
                    Grid of all 10-minute slots colored by capacity fill %
                  </p>
                </div>
                <div className="flex items-center gap-3 text-[11px] font-bold text-[var(--text-muted)]">
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

              {(data?.slots ?? []).length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[var(--border)] py-10 text-center text-sm text-[var(--text-muted)]">
                  No slots seeded for today. Visit Slots to generate today&apos;s windows.
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">
                  {(data?.slots ?? []).map((slot) => {
                    const cap = Math.max(1, slot.capacity_units)
                    const pct = Math.min(100, Math.round((slot.used_units / cap) * 100))
                    const tileStyle =
                      pct > 80
                        ? 'border-[var(--danger)]/40 bg-[var(--danger)]/15 text-[var(--danger)]'
                        : pct >= 50
                          ? 'border-[var(--warning)]/40 bg-[var(--warning)]/15 text-[var(--warning)]'
                          : 'border-[var(--success)]/30 bg-[var(--success)]/12 text-[var(--success)]'

                    return (
                      <div
                        key={slot.id}
                        title={`${formatSlotTime(slot.slot_start)}: ${slot.used_units}/${slot.capacity_units} (${pct}%)`}
                        className={`rounded-xl border p-2 text-center ${tileStyle}`}
                      >
                        <div className="text-[11px] font-extrabold tabular-nums">
                          {formatSlotTime(slot.slot_start).replace(/\s?(am|pm)/i, '')}
                        </div>
                        <div className="text-[10px] font-bold opacity-85 tabular-nums">
                          {pct}%
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Top 5 Items Table */}
            <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm lg:col-span-5">
              <h2 className="text-base font-extrabold text-[var(--text)]">
                Top 5 Items Today
              </h2>
              <p className="mb-4 text-xs text-[var(--text-muted)]">
                Ranked by units ordered since 00:00
              </p>

              {(data?.top5Items ?? []).length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[var(--border)] py-10 text-center text-sm text-[var(--text-muted)]">
                  No item sales recorded yet today
                </div>
              ) : (
                <div className="overflow-hidden rounded-2xl border border-[var(--border)]">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-[var(--surface-2)] text-xs font-extrabold uppercase text-[var(--text-muted)]">
                      <tr>
                        <th className="px-4 py-2.5">Item</th>
                        <th className="px-4 py-2.5 text-right">Qty</th>
                        <th className="px-4 py-2.5 text-right">Revenue</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                      {data?.top5Items.map((item, idx) => (
                        <tr key={item.name}>
                          <td className="px-4 py-3 font-bold">
                            <span className="mr-2 text-xs text-[var(--primary)]">
                              #{idx + 1}
                            </span>
                            {item.name}
                          </td>
                          <td className="px-4 py-3 text-right font-extrabold tabular-nums">
                            {item.qty}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-[var(--primary)] tabular-nums">
                            {formatPaise(item.revenue_paise)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </AdminShell>
  )
}
