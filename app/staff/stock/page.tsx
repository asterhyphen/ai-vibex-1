'use client'

import { useEffect, useMemo, useState } from 'react'
import { Clock, Loader2, PackageCheck, PackageX, Search } from 'lucide-react'
import { toast } from 'sonner'
import type { Category, MenuItem } from '@/lib/types'
import { formatPaise } from '@/lib/utils/format'
import { StaffHeader } from '@/components/staff/StaffHeader'

interface MenuItemWithCat extends MenuItem {
  category?: Category | null
}

function getBackAtTag(tags: string[] | undefined): string {
  const match = (tags ?? []).find((t) => t.startsWith('back_at:'))
  return match ? match.slice('back_at:'.length) : ''
}

export default function StockControlPage() {
  const [items, setItems] = useState<MenuItemWithCat[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [stockFilter, setStockFilter] = useState<'all' | 'in' | 'out'>('all')
  const [backAtDrafts, setBackAtDrafts] = useState<Record<string, string>>({})
  const [savingId, setSavingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch('/api/staff/stock', { cache: 'no-store' })
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (cancelled) return
        if (!ok) {
          toast.error(data.error || 'Failed to load menu stock')
          return
        }
        const loaded = (data.items ?? []) as MenuItemWithCat[]
        setItems(loaded)
        setCategories(data.categories ?? [])
        setBackAtDrafts(
          Object.fromEntries(loaded.map((item) => [item.id, getBackAtTag(item.tags)]))
        )
      })
      .catch(() => {
        if (!cancelled) toast.error('Network error loading stock items')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const updateStock = async (
    item: MenuItemWithCat,
    nextInStock: boolean,
    backAt?: string
  ) => {
    setSavingId(item.id)
    const nextBackAt = nextInStock ? '' : (backAt ?? backAtDrafts[item.id] ?? '')

    // Optimistic update
    setItems((prev) =>
      prev.map((m) =>
        m.id === item.id ? { ...m, in_stock: nextInStock } : m
      )
    )

    try {
      const res = await fetch(`/api/staff/stock/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          in_stock: nextInStock,
          back_at: nextBackAt || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        // Revert optimistic update
        setItems((prev) =>
          prev.map((m) =>
            m.id === item.id ? { ...m, in_stock: item.in_stock } : m
          )
        )
        toast.error(data.error || 'Failed to update stock')
        return
      }
      setItems((prev) =>
        prev.map((m) => (m.id === item.id ? (data.item as MenuItemWithCat) : m))
      )
      setBackAtDrafts((prev) => ({
        ...prev,
        [item.id]: getBackAtTag(data.item?.tags),
      }))
      toast.success(
        `${item.name} marked ${nextInStock ? 'In Stock' : 'Out of Stock'}`
      )
    } catch {
      setItems((prev) =>
        prev.map((m) =>
          m.id === item.id ? { ...m, in_stock: item.in_stock } : m
        )
      )
      toast.error('Network error updating stock')
    } finally {
      setSavingId(null)
    }
  }

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase()
    return items.filter((item) => {
      const matchSearch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        (item.category?.name ?? '').toLowerCase().includes(q)
      const matchCat =
        categoryFilter === 'all' || item.category_id === categoryFilter
      const matchStock =
        stockFilter === 'all' ||
        (stockFilter === 'in' && item.in_stock) ||
        (stockFilter === 'out' && !item.in_stock)
      return matchSearch && matchCat && matchStock
    })
  }, [items, search, categoryFilter, stockFilter])

  const inCount = items.filter((i) => i.in_stock).length
  const outCount = items.length - inCount

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <StaffHeader staffName="Kitchen Inventory" />

      <main className="mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-[var(--text)]">
              Stock Control
            </h1>
            <p className="text-sm text-[var(--text-muted)]">
              Toggle availability in real time. Out-of-stock items immediately lock in student menus.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setStockFilter('all')}
              className={`min-h-[44px] rounded-xl px-3.5 text-xs font-bold cursor-pointer ${
                stockFilter === 'all'
                  ? 'bg-[var(--primary)] text-white'
                  : 'border border-[var(--border)] bg-[var(--surface)] text-[var(--text)]'
              }`}
            >
              All ({items.length})
            </button>
            <button
              type="button"
              onClick={() => setStockFilter('in')}
              className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-xl px-3.5 text-xs font-bold cursor-pointer ${
                stockFilter === 'in'
                  ? 'bg-[var(--success)] text-white'
                  : 'border border-[var(--border)] bg-[var(--surface)] text-[var(--success)]'
              }`}
            >
              <PackageCheck className="h-4 w-4" />
              In Stock ({inCount})
            </button>
            <button
              type="button"
              onClick={() => setStockFilter('out')}
              className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-xl px-3.5 text-xs font-bold cursor-pointer ${
                stockFilter === 'out'
                  ? 'bg-[var(--danger)] text-white'
                  : 'border border-[var(--border)] bg-[var(--surface)] text-[var(--danger)]'
              }`}
            >
              <PackageX className="h-4 w-4" />
              Out ({outCount})
            </button>
          </div>
        </div>

        {/* Search & Category Bar */}
        <div className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search menu items or categories..."
              className="min-h-[48px] w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] pl-10 pr-4 text-sm text-[var(--text)] outline-none focus:border-[var(--primary)]"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto">
            <button
              type="button"
              onClick={() => setCategoryFilter('all')}
              className={`min-h-[44px] shrink-0 rounded-xl px-3.5 text-xs font-bold cursor-pointer ${
                categoryFilter === 'all'
                  ? 'bg-[var(--primary)] text-white'
                  : 'border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)]'
              }`}
            >
              All Categories
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategoryFilter(cat.id)}
                className={`min-h-[44px] shrink-0 rounded-xl px-3.5 text-xs font-bold cursor-pointer ${
                  categoryFilter === cat.id
                    ? 'bg-[var(--primary)] text-white'
                    : 'border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)]'
                }`}
              >
                {cat.icon ? `${cat.icon} ` : ''}
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Items List */}
        {loading ? (
          <div className="flex min-h-[300px] items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
            <Loader2 className="h-7 w-7 animate-spin text-[var(--primary)]" />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {filteredItems.map((item) => {
              const isBusy = savingId === item.id
              return (
                <div
                  key={item.id}
                  className={`flex flex-col justify-between gap-3 rounded-2xl border-2 bg-[var(--surface)] p-4 transition-colors ${
                    item.in_stock
                      ? 'border-[var(--border)]'
                      : 'border-[var(--danger)]/45 bg-[var(--danger)]/5'
                  }`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="truncate text-base font-extrabold text-[var(--text)]">
                          {item.name}
                        </h2>
                        {item.category && (
                          <span className="rounded-full bg-[var(--surface-2)] px-2.5 py-0.5 text-xs font-semibold text-[var(--text-muted)]">
                            {item.category.icon ? `${item.category.icon} ` : ''}
                            {item.category.name}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex items-center gap-3 text-sm font-bold text-[var(--primary)] tabular-nums">
                        <span>{formatPaise(item.price_paise)}</span>
                        <span className="text-xs font-medium text-[var(--text-muted)]">
                          ~{Math.max(1, Math.round(item.prep_seconds / 60))} min prep
                        </span>
                      </div>
                    </div>

                    {/* Big >=48px Touch Switch */}
                    <button
                      type="button"
                      role="switch"
                      aria-checked={item.in_stock}
                      aria-label={`Toggle ${item.name} stock`}
                      disabled={isBusy}
                      onClick={() => updateStock(item, !item.in_stock)}
                      className={`relative inline-flex h-12 min-h-[48px] w-28 shrink-0 items-center rounded-full p-1.5 transition-colors cursor-pointer disabled:opacity-60 ${
                        item.in_stock ? 'bg-[var(--success)]' : 'bg-[var(--danger)]'
                      }`}
                    >
                      <span
                        className={`inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-xs font-black shadow-md transition-transform ${
                          item.in_stock ? 'translate-x-16' : 'translate-x-0'
                        }`}
                      >
                        {isBusy ? (
                          <Loader2 className="h-4 w-4 animate-spin text-neutral-600" />
                        ) : item.in_stock ? (
                          'ON'
                        ) : (
                          'OFF'
                        )}
                      </span>
                      <span
                        className={`absolute text-xs font-extrabold text-white ${
                          item.in_stock ? 'left-3.5' : 'right-3.5'
                        }`}
                      >
                        {item.in_stock ? 'In Stock' : 'Out'}
                      </span>
                    </button>
                  </div>

                  {/* Optional "Back at" time input */}
                  {!item.in_stock && (
                    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2">
                      <Clock className="h-4 w-4 text-[var(--warning)]" />
                      <label className="text-xs font-bold text-[var(--text-muted)]">
                        Back at:
                      </label>
                      <input
                        type="time"
                        value={backAtDrafts[item.id] ?? ''}
                        onChange={(e) =>
                          setBackAtDrafts((prev) => ({
                            ...prev,
                            [item.id]: e.target.value,
                          }))
                        }
                        className="min-h-[38px] rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 text-xs font-bold text-[var(--text)] outline-none focus:border-[var(--primary)]"
                      />
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() =>
                          updateStock(item, false, backAtDrafts[item.id] ?? '')
                        }
                        className="ml-auto min-h-[38px] rounded-lg bg-[var(--primary)] px-3 text-xs font-bold text-white hover:bg-[var(--primary-hover)] cursor-pointer"
                      >
                        Save ETA
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
