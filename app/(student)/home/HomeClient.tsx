'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { LayoutGroup, motion } from 'framer-motion'
import type { User } from '@supabase/supabase-js'
import {
  ArrowRight,
  CheckCircle2,
  ChefHat,
  Clock,
  Search,
  Sparkles,
  Utensils,
} from 'lucide-react'
import { toast } from 'sonner'
import type { Category, MenuItem, Notification, OrderWithItems, OrderStatus, Profile } from '@/lib/types'
import { useCartStore } from '@/lib/stores/cart'
import { useSessionStore } from '@/lib/stores/session'
import { createClient } from '@/lib/supabase/client'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { cn, formatPaise, formatSlotTime } from '@/lib/utils/format'
import { TopBar } from '@/components/menu/TopBar'
import { CategoryChips } from '@/components/menu/CategoryChips'
import { MenuCard } from '@/components/menu/MenuCard'
import { ItemSheet } from '@/components/menu/ItemSheet'
import { PlainLanguageModal } from '@/components/menu/PlainLanguageModal'
import { CartBar } from '@/components/cart/CartBar'

interface HomeClientProps {
  user: User | null
  profile: Profile | null
  categories: Category[]
  menuItems: MenuItem[]
  activeOrder: OrderWithItems | null
  notifications: Notification[]
}

const STATUS_BADGE: Record<
  OrderStatus,
  { label: string; className: string }
> = {
  placed: {
    label: 'Order Placed',
    className: 'bg-[var(--info)]/15 text-[var(--info)]',
  },
  awaiting_cash: {
    label: 'Pay Cash at Counter',
    className: 'bg-[var(--warning)]/15 text-[var(--warning)]',
  },
  accepted: {
    label: 'Accepted by Kitchen',
    className: 'bg-[var(--primary-soft)] text-[var(--primary)]',
  },
  preparing: {
    label: 'Preparing Now',
    className: 'bg-[var(--accent)]/20 text-[var(--accent)]',
  },
  ready: {
    label: 'Ready for Pickup!',
    className: 'bg-[var(--success)] text-white',
  },
  collected: {
    label: 'Collected',
    className: 'bg-[var(--surface-2)] text-[var(--text-muted)]',
  },
  cancelled: {
    label: 'Cancelled',
    className: 'bg-[var(--surface-2)] text-[var(--text-muted)]',
  },
  rejected: {
    label: 'Rejected',
    className: 'bg-[var(--danger)]/15 text-[var(--danger)]',
  },
}

export function HomeClient({
  user,
  profile,
  categories,
  menuItems: initialMenuItems,
  activeOrder: initialActiveOrder,
  notifications,
}: HomeClientProps) {
  const setUser = useSessionStore((s) => s.setUser)
  const setProfile = useSessionStore((s) => s.setProfile)
  const addItem = useCartStore((s) => s.addItem)
  const cartItems = useCartStore((s) => s.items)

  const [menuItems, setMenuItems] = useState<MenuItem[]>(initialMenuItems)
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null)
  const [plainInput, setPlainInput] = useState('')
  const [plainModalOpen, setPlainModalOpen] = useState(false)
  const [plainAutoParse, setPlainAutoParse] = useState(false)
  const [activeOrder, setActiveOrder] = useState<OrderWithItems | null>(initialActiveOrder)

  useEffect(() => {
    setUser(user)
    setProfile(profile)
  }, [user, profile, setUser, setProfile])

  // Subscribe to live menu_items stock/price updates
  useEffect(() => {
    if (!isSupabaseConfigured()) {
      return
    }

    const supabase = createClient()
    const channel = supabase
      .channel('home-menu-items-live')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'menu_items',
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const inserted = payload.new as MenuItem
            if (inserted.is_active === false) return
            setMenuItems((prev) => {
              if (prev.some((m) => m.id === inserted.id)) return prev
              return [...prev, inserted].sort((a, b) => a.name.localeCompare(b.name))
            })
            return
          }

          if (payload.eventType === 'DELETE') {
            const oldItem = payload.old as Partial<MenuItem>
            if (!oldItem.id) return
            setMenuItems((prev) => prev.filter((m) => m.id !== oldItem.id))
            setSelectedItem((curr) => (curr?.id === oldItem.id ? null : curr))
            return
          }

          if (payload.eventType === 'UPDATE') {
            const updated = payload.new as MenuItem
            setMenuItems((prev) => {
              if (updated.is_active === false) {
                return prev.filter((m) => m.id !== updated.id)
              }
              const exists = prev.some((m) => m.id === updated.id)
              if (!exists) {
                return [...prev, updated].sort((a, b) => a.name.localeCompare(b.name))
              }
              return prev.map((m) => (m.id === updated.id ? updated : m))
            })

            setSelectedItem((curr) => (curr?.id === updated.id ? updated : curr))

            if (!updated.in_stock || updated.is_active === false) {
              const inCart = useCartStore
                .getState()
                .items.some((ci) => ci.menuItemId === updated.id)
              if (inCart) {
                toast.warning(`${updated.name} just went out of stock — check your tray.`)
              }
            }
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  // Subscribe to live status updates for active order
  useEffect(() => {
    if (!activeOrder?.id || !isSupabaseConfigured()) {
      return
    }

    const supabase = createClient()
    const channel = supabase
      .channel(`home-active-order-${activeOrder.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${activeOrder.id}`,
        },
        (payload) => {
          const updated = payload.new as Partial<OrderWithItems>
          setActiveOrder((prev) => (prev ? { ...prev, ...updated } : prev))
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [activeOrder?.id])

  const categoryNameMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const cat of categories) {
      map.set(cat.id, cat.name)
    }
    return map
  }, [categories])

  const cartQtyMap = useMemo(() => {
    const map = new Map<string, number>()
    for (const item of cartItems) {
      map.set(item.menuItemId, item.qty)
    }
    return map
  }, [cartItems])

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const item of menuItems) {
      counts[item.category_id] = (counts[item.category_id] ?? 0) + 1
    }
    return counts
  }, [menuItems])

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return menuItems.filter((item) => {
      const catMatch =
        selectedCategoryId === 'all' || item.category_id === selectedCategoryId
      if (!catMatch) return false
      if (!q) return true
      return (
        item.name.toLowerCase().includes(q) ||
        (item.description ?? '').toLowerCase().includes(q) ||
        item.tags.some((t) => t.toLowerCase().includes(q))
      )
    })
  }, [menuItems, selectedCategoryId, searchQuery])

  const handleQuickAdd = (item: MenuItem, origin: { x: number; y: number }) => {
    addItem(
      {
        menuItemId: item.id,
        name: item.name,
        price_paise: item.price_paise,
        prep_seconds: item.prep_seconds,
        qty: 1,
      },
      origin
    )
    toast.success(`Added ${item.name} to cart`)
  }

  const handleSheetAdd = (
    item: MenuItem,
    qty: number,
    origin: { x: number; y: number }
  ) => {
    addItem(
      {
        menuItemId: item.id,
        name: item.name,
        price_paise: item.price_paise,
        prep_seconds: item.prep_seconds,
        qty,
      },
      origin
    )
    toast.success(`Added ${qty}× ${item.name} to cart`)
  }

  const handlePlainSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setPlainAutoParse(Boolean(plainInput.trim()))
    setPlainModalOpen(true)
  }

  const showActiveOrder =
    activeOrder &&
    ['placed', 'awaiting_cash', 'accepted', 'preparing', 'ready'].includes(
      activeOrder.status
    )

  return (
    <div className="min-h-screen bg-[var(--bg)] pb-28">
      <TopBar
        profile={profile}
        email={user?.email ?? null}
        initialNotifications={notifications}
      />

      <main className="mx-auto max-w-6xl space-y-5 px-4 pt-4 sm:px-6 sm:pt-6">
        {/* Live Active Order Card */}
        {showActiveOrder && activeOrder && (
          <motion.section
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            aria-label="Active order status"
            className={cn(
              'rounded-2xl border p-4 shadow-sm transition-colors',
              activeOrder.status === 'ready'
                ? 'border-[var(--success)]/50 bg-[var(--success)]/10'
                : 'border-[var(--primary)]/25 bg-[var(--surface)]'
            )}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
                    activeOrder.status === 'ready'
                      ? 'bg-[var(--success)] text-white'
                      : 'bg-[var(--primary-soft)] text-[var(--primary)]'
                  )}
                >
                  {activeOrder.status === 'ready' ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : (
                    <ChefHat className="h-5 w-5" />
                  )}
                </div>

                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-base font-bold text-[var(--text)]">
                      #{activeOrder.code}
                    </span>
                    <span
                      className={cn(
                        'rounded-full px-2.5 py-0.5 text-xs font-semibold',
                        STATUS_BADGE[activeOrder.status].className
                      )}
                    >
                      {STATUS_BADGE[activeOrder.status].label}
                    </span>
                  </div>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)]">
                    <span>
                      {activeOrder.order_items?.reduce((s, i) => s + i.qty, 0) ?? 0} items ·{' '}
                      {formatPaise(activeOrder.total_paise)}
                    </span>
                    {activeOrder.pickup_slot && (
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Slot {formatSlotTime(activeOrder.pickup_slot.slot_start)}
                      </span>
                    )}
                  </p>
                </div>
              </div>

              <Link
                href={`/orders/${activeOrder.code}`}
                className="inline-flex h-11 min-h-[44px] shrink-0 items-center justify-center gap-1.5 rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-[var(--primary-hover)]"
              >
                <span>Track live</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </motion.section>
        )}

        {/* Featured Quick-Order Banner (Mobile-first promo card inspo) */}
        <section
          aria-label="Quick order highlight"
          className="relative overflow-hidden rounded-3xl border border-[var(--primary)]/15 bg-[var(--primary-soft)]/70 p-4 shadow-xs dark:bg-[var(--surface-2)] sm:p-5"
        >
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1 space-y-2">
              <h2 className="font-display text-lg font-bold tracking-tight text-[var(--text)] sm:text-xl">
                Fresh from MITE Kitchen
              </h2>
              <p className="max-w-md text-xs leading-relaxed text-[var(--text-muted)] sm:text-sm">
                Type your order in plain words or pick a 10-min slot to skip the counter rush.
              </p>
              <button
                type="button"
                onClick={() => {
                  setPlainAutoParse(Boolean(plainInput.trim()))
                  setPlainModalOpen(true)
                }}
                className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-full bg-[var(--primary)] pl-4 pr-2 text-xs font-bold text-white shadow-xs transition-all hover:bg-[var(--primary-hover)] active:scale-95 sm:text-sm"
              >
                <span>Order in plain words</span>
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/20">
                  <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </button>
            </div>

            <div
              aria-hidden="true"
              className="hidden h-20 w-20 shrink-0 items-center justify-center rounded-full border border-[var(--primary)]/15 bg-[var(--surface)] text-[var(--primary)] shadow-sm xs:flex sm:flex sm:h-24 sm:w-24"
            >
              <div className="relative flex items-center justify-center">
                <Utensils className="h-9 w-9 sm:h-10 sm:w-10" />
                <Sparkles className="absolute -right-2.5 -top-2.5 h-4 w-4 text-[var(--accent)]" />
              </div>
            </div>
          </div>
        </section>

        {/* Sticky Pill Search & Quick NLP Bar */}
        <section
          aria-label="Search and quick order"
          className="sticky top-[106px] z-20 space-y-2.5 rounded-3xl border border-[var(--border)] bg-[var(--surface)]/95 p-2.5 shadow-md backdrop-blur-md md:top-[76px]"
        >
          <form onSubmit={handlePlainSubmit} className="flex items-center gap-2">
            <div className="relative flex flex-1 items-center">
              <span className="pointer-events-none absolute left-1.5 flex h-9 w-9 items-center justify-center rounded-full bg-[var(--primary)] text-white shadow-xs">
                <Search className="h-4 w-4" />
              </span>
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search menu items..."
                aria-label="Search menu items"
                className="h-11 min-h-[44px] w-full rounded-full border border-[var(--border)] bg-[var(--bg)] pl-12 pr-4 text-base sm:text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:border-[var(--primary)] focus:outline-none"
              />
            </div>

            <button
              type="button"
              onClick={() => {
                setPlainAutoParse(Boolean(plainInput.trim()))
                setPlainModalOpen(true)
              }}
              aria-label="Open plain language NLP order"
              className="inline-flex h-11 min-h-[44px] shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-[var(--primary)]/25 bg-[var(--primary-soft)] px-3.5 text-xs font-bold text-[var(--primary)] transition-colors hover:bg-[var(--primary)] hover:text-white sm:px-4"
            >
              <Sparkles className="h-4 w-4" />
              <span className="hidden sm:inline">Quick NLP</span>
            </button>
          </form>

          <CategoryChips
            categories={categories}
            selectedCategoryId={selectedCategoryId}
            onSelect={setSelectedCategoryId}
            itemCounts={categoryCounts}
          />
        </section>

        {/* Menu Grid */}
        <section aria-label="Canteen menu">
          {filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-6 py-14 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--surface-2)] text-[var(--primary)]">
                <Utensils className="h-7 w-7" />
              </div>
              <h2 className="mt-4 text-base font-bold text-[var(--text)]">
                No menu items found
              </h2>
              <p className="mt-1 max-w-sm text-sm text-[var(--text-muted)]">
                {menuItems.length === 0
                  ? 'Menu items will appear here once loaded from the canteen database.'
                  : 'Try choosing another category or clearing your search filter.'}
              </p>
              {(selectedCategoryId !== 'all' || searchQuery) && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCategoryId('all')
                    setSearchQuery('')
                  }}
                  className="mt-4 inline-flex h-11 min-h-[44px] cursor-pointer items-center rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-white hover:bg-[var(--primary-hover)]"
                >
                  Show all items
                </button>
              )}
            </div>
          ) : (
            <LayoutGroup id="menu-grid">
              <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
                {filteredItems.map((item) => (
                  <MenuCard
                    key={item.id}
                    item={item}
                    categoryName={categoryNameMap.get(item.category_id)}
                    cartQty={cartQtyMap.get(item.id) ?? 0}
                    onSelect={setSelectedItem}
                    onAddToCart={handleQuickAdd}
                  />
                ))}
              </div>
            </LayoutGroup>
          )}
        </section>
      </main>

      {/* Modals & Sticky Cart Bar */}
      <ItemSheet
        item={selectedItem}
        categoryName={selectedItem ? categoryNameMap.get(selectedItem.category_id) : undefined}
        onClose={() => setSelectedItem(null)}
        onAddToCart={handleSheetAdd}
      />

      <PlainLanguageModal
        open={plainModalOpen}
        onOpenChange={setPlainModalOpen}
        menuItems={menuItems}
        initialText={plainInput}
        autoParse={plainAutoParse}
      />

      <CartBar liveMenuItems={menuItems} />
    </div>
  )
}
