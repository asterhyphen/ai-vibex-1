'use client'

import { useEffect, useState } from 'react'
import { Loader2, Save } from 'lucide-react'
import { toast } from 'sonner'
import type { Setting } from '@/lib/types'
import { AdminShell } from '@/components/admin/AdminShell'
import { DataGrid, type TableConfig } from '@/components/admin/DataGrid'
import { DangerZonePanel } from '@/components/admin/DangerZonePanel'

const SETTINGS_CONFIG: TableConfig = {
  tableName: 'settings',
  searchable: ['key'],
  editable: true,
  creatable: true,
  deletable: true,
  columns: [
    { key: 'key', label: 'Key', editable: true, required: true },
    { key: 'value', label: 'JSON Value', type: 'json', editable: true, required: true },
    { key: 'updated_at', label: 'Last Updated', type: 'datetime', editable: false },
  ],
}

export default function AdminSettingsPage() {
  const [generalRow, setGeneralRow] = useState<Setting | null>(null)
  const [facultyBoost, setFacultyBoost] = useState(5)
  const [slotCapacity, setSlotCapacity] = useState(20)
  const [bwRate, setBwRate] = useState(200)
  const [colorRate, setColorRate] = useState(1000)
  const [a3Multiplier, setA3Multiplier] = useState(2)
  const [smsTemplate, setSmsTemplate] = useState(
    'Your order {code} is confirmed. Collect by {slot}.'
  )
  const [saving, setSaving] = useState(false)
  const [refreshSignal, setRefreshSignal] = useState(0)

  useEffect(() => {
    let cancelled = false
    fetch('/api/admin/settings?pageSize=50', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return
        const rows = (data.rows ?? []) as Setting[]
        const general = rows.find((r) => r.key === 'general')
        if (general) {
          setGeneralRow(general)
          const v = (general.value ?? {}) as Record<string, unknown>
          if (typeof v.faculty_boost_minutes === 'number')
            setFacultyBoost(v.faculty_boost_minutes)
          if (typeof v.slot_capacity === 'number') setSlotCapacity(v.slot_capacity)
          if (typeof v.bw_rate_paise === 'number') setBwRate(v.bw_rate_paise)
          if (typeof v.color_rate_paise === 'number') setColorRate(v.color_rate_paise)
          if (typeof v.a3_multiplier === 'number') setA3Multiplier(v.a3_multiplier)
          if (typeof v.sms_template === 'string') setSmsTemplate(v.sms_template)
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const handleSaveGeneral = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const nextValue = {
      ...(generalRow?.value ?? {}),
      faculty_boost_minutes: facultyBoost,
      slot_capacity: slotCapacity,
      bw_rate_paise: bwRate,
      color_rate_paise: colorRate,
      a3_multiplier: a3Multiplier,
      sms_template: smsTemplate,
    }

    try {
      const url = generalRow
        ? `/api/admin/settings/${generalRow.id}`
        : '/api/admin/settings'
      const method = generalRow ? 'PATCH' : 'POST'
      const body = generalRow
        ? { value: nextValue }
        : { key: 'general', value: nextValue }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Failed to save settings')
        return
      }
      setGeneralRow(data.row)
      setRefreshSignal((s) => s + 1)
      toast.success('System settings saved & logged')
    } catch {
      toast.error('Network error saving settings')
    } finally {
      setSaving(false)
    }
  }

  return (
    <AdminShell
      title="System Settings"
      subtitle="Configure priority boost, print pricing, slot capacity, and SMS templates"
    >
      <div className="space-y-6">
        <form
          onSubmit={handleSaveGeneral}
          className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm"
        >
          <div className="mb-4 flex items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-[var(--text)]">
                General Configuration
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                Applied immediately by priority scoring, checkout, and print pricing
              </p>
            </div>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[var(--primary)] px-4 text-xs font-semibold text-white hover:bg-[var(--primary-hover)] disabled:opacity-50 cursor-pointer"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              <span>Save Config</span>
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-bold text-[var(--text-muted)]">
                Faculty Priority Boost (minutes)
              </label>
              <input
                type="number"
                value={facultyBoost}
                onChange={(e) => setFacultyBoost(Number(e.target.value))}
                className="min-h-[44px] w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3.5 text-sm font-bold"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-[var(--text-muted)]">
                Default Slot Capacity (units)
              </label>
              <input
                type="number"
                value={slotCapacity}
                onChange={(e) => setSlotCapacity(Number(e.target.value))}
                className="min-h-[44px] w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3.5 text-sm font-bold"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-[var(--text-muted)]">
                B&amp;W Print Rate (paise/page)
              </label>
              <input
                type="number"
                value={bwRate}
                onChange={(e) => setBwRate(Number(e.target.value))}
                className="min-h-[44px] w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3.5 text-sm font-bold"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-[var(--text-muted)]">
                Colour Print Rate (paise/page)
              </label>
              <input
                type="number"
                value={colorRate}
                onChange={(e) => setColorRate(Number(e.target.value))}
                className="min-h-[44px] w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3.5 text-sm font-bold"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-[var(--text-muted)]">
                A3 Size Multiplier
              </label>
              <input
                type="number"
                value={a3Multiplier}
                onChange={(e) => setA3Multiplier(Number(e.target.value))}
                className="min-h-[44px] w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3.5 text-sm font-bold"
              />
            </div>

            <div className="sm:col-span-2 lg:col-span-1">
              <label className="mb-1 block text-xs font-bold text-[var(--text-muted)]">
                SMS Confirmation Template
              </label>
              <input
                type="text"
                value={smsTemplate}
                onChange={(e) => setSmsTemplate(e.target.value)}
                className="min-h-[44px] w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3.5 text-sm"
              />
            </div>
          </div>
        </form>

        <DataGrid config={SETTINGS_CONFIG} refreshSignal={refreshSignal} />

        <DangerZonePanel onComplete={() => setRefreshSignal((s) => s + 1)} />
      </div>
    </AdminShell>
  )
}
