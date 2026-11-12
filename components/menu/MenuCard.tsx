'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Clock, Coffee, Cookie, Flame, Plus, Soup, Utensils } from 'lucide-react'
import type { MenuItem } from '@/lib/types'
import { cn, formatPaise, formatPrepTime } from '@/lib/utils/format'

interface MenuCardProps {
  item: MenuItem
  categoryName?: string
  cartQty?: number
  onSelect: (item: MenuItem) => void
  onAddToCart: (item: MenuItem, origin: { x: number; y: number }) => void
}

function getCategoryVisual(categoryName?: string) {
  const name = (categoryName ?? '').toLowerCase()
  if (name.includes('breakfast')) {
    return {
      gradient: 'from-[#7A1F3D]/20 via-[#B8893B]/20 to-[#F6E4EA]',
      darkGradient: 'dark:from-[#3D1225] dark:via-[#4A2512]/50 dark:to-[#2A131C]',
      Icon: Flame,
    }
  }
  if (name.includes('meal')) {
    return {
      gradient: 'from-[#5E1530]/20 via-[#B8893B]/15 to-[#F3ECE8]',
      darkGradient: 'dark:from-[#34101D] dark:via-[#2A131C] dark:to-[#1E0E14]',
      Icon: Soup,
    }
  }
  if (name.includes('snack')) {
    return {
      gradient: 'from-[#C98A1B]/20 via-[#7A1F3D]/15 to-[#FAF7F4]',
      darkGradient: 'dark:from-[#3B2312] dark:via-[#2A131C] dark:to-[#1E0E14]',
      Icon: Cookie,
    }
  }
  if (name.includes('beverage')) {
    return {
      gradient: 'from-[#3B5B8C]/15 via-[#B8893B]/15 to-[#F3ECE8]',
      darkGradient: 'dark:from-[#1B2438] dark:via-[#2A131C] dark:to-[#1E0E14]',
      Icon: Coffee,
    }
  }
  return {
    gradient: 'from-[#B8893B]/25 via-[#F6E4EA] to-[#FAF7F4]',
    darkGradient: 'dark:from-[#422816] dark:via-[#3D1225] dark:to-[#1E0E14]',
    Icon: Utensils,
  }
}

export function MenuCard({
  item,
  categoryName,
  cartQty = 0,
  onSelect,
  onAddToCart,
}: MenuCardProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [tilt, setTilt] = useState({ rotateX: 0, rotateY: 0, active: false })
  const [spot, setSpot] = useState({ x: 50, y: 50 })
  const [imgError, setImgError] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(mq.matches)
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (reducedMotion || !item.in_stock || !cardRef.current) return
    const rect = cardRef.current.getBoundingClientRect()
    const px = (e.clientX - rect.left) / rect.width
    const py = (e.clientY - rect.top) / rect.height
    const nx = (px - 0.5) * 2
    const ny = (py - 0.5) * 2

    setTilt({
      rotateX: Number((-ny * 8).toFixed(2)),
      rotateY: Number((nx * 8).toFixed(2)),
      active: true,
    })
    setSpot({
      x: Math.round(px * 100),
      y: Math.round(py * 100),
    })
  }

  const handleMouseLeave = () => {
    setTilt({ rotateX: 0, rotateY: 0, active: false })
  }

  const handleAddClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    if (!item.in_stock) return
    const rect = e.currentTarget.getBoundingClientRect()
    onAddToCart(item, {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    })
  }

  const visual = getCategoryVisual(categoryName)
  const CategoryIcon = visual.Icon
  const subtitle =
    item.description?.trim() ||
    (item.tags?.length > 0 ? item.tags.slice(0, 2).join(' · ') : categoryName || 'Freshly prepared')

  return (
    <div style={{ perspective: '1000px' }} className="h-full">
      <motion.div
        ref={cardRef}
        role="button"
        tabIndex={0}
        onClick={() => onSelect(item)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onSelect(item)
          }
        }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{
          transform: `rotateX(${tilt.rotateX}deg) rotateY(${tilt.rotateY}deg) scale(${tilt.active ? 1.015 : 1})`,
          transition: tilt.active
            ? 'transform 90ms ease-out, box-shadow 200ms ease'
            : 'transform 320ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 250ms ease',
          transformStyle: 'preserve-3d',
        }}
        className={cn(
          'group relative flex h-full cursor-pointer flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm transition-shadow hover:border-[var(--primary)]/40 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]',
          !item.in_stock && 'opacity-80'
        )}
      >
        {/* Specular highlight following pointer */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-20 transition-opacity duration-200"
          style={{
            opacity: tilt.active ? 1 : 0,
            background: `radial-gradient(circle 180px at ${spot.x}% ${spot.y}%, rgba(255, 255, 255, 0.24), transparent 72%)`,
          }}
        />

        {/* Image / Fallback gradient header */}
        <motion.div
          layoutId={`menu-image-${item.id}`}
          className={cn(
            'relative aspect-[4/3] w-full overflow-hidden bg-gradient-to-br',
            visual.gradient,
            visual.darkGradient
          )}
        >
          {item.image_url && !imgError ? (
            <img
              src={item.image_url}
              alt={item.name}
              loading="lazy"
              onError={() => setImgError(true)}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="relative flex h-full w-full items-center justify-center">
              <div
                aria-hidden="true"
                className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-[var(--primary)]/10 blur-xl"
              />
              <div
                aria-hidden="true"
                className="absolute -bottom-6 -left-6 h-24 w-24 rounded-full bg-[var(--accent)]/15 blur-xl"
              />
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--border)]/60 bg-[var(--surface)]/75 text-[var(--primary)] shadow-sm backdrop-blur-sm">
                <CategoryIcon className="h-7 w-7" />
              </div>
            </div>
          )}

          {/* Prep time badge */}
          <span className="absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-full border border-[var(--border)]/70 bg-[var(--surface)]/90 px-2.5 py-1 text-[11px] font-medium text-[var(--text)] shadow-xs backdrop-blur-sm">
            <Clock className="h-3 w-3 text-[var(--accent)]" />
            {formatPrepTime(item.prep_seconds)}
          </span>

          {/* Out-of-stock overlay */}
          {!item.in_stock && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/35 backdrop-blur-[1.5px]">
              <span className="rounded-full border border-white/25 bg-[var(--danger)] px-3 py-1 text-xs font-semibold tracking-wide text-white shadow-sm">
                Out of stock
              </span>
            </div>
          )}
        </motion.div>

        {/* Body */}
        <div className="flex flex-1 flex-col justify-between gap-3 p-3 sm:p-4">
          <div className="space-y-1">
            <div className="flex items-start justify-between gap-2">
              <h3 className="line-clamp-1 text-sm font-semibold text-[var(--text)] sm:text-base">
                {item.name}
              </h3>
            </div>
            <p className="line-clamp-1 text-xs text-[var(--text-muted)]">{subtitle}</p>
            <div className="pt-1">
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
                  item.in_stock
                    ? 'bg-[var(--success)]/12 text-[var(--success)]'
                    : 'bg-[var(--danger)]/12 text-[var(--danger)]'
                )}
              >
                <span
                  className={cn(
                    'h-1.5 w-1.5 rounded-full',
                    item.in_stock ? 'bg-[var(--success)]' : 'bg-[var(--danger)]'
                  )}
                />
                {item.in_stock ? 'In stock' : 'Out of stock'}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 pt-1">
            <span className="text-base font-bold tracking-tight text-[var(--text)] sm:text-lg">
              {formatPaise(item.price_paise)}
            </span>

            <button
              type="button"
              disabled={!item.in_stock}
              onClick={handleAddClick}
              aria-label={`Add ${item.name} to cart`}
              className={cn(
                'relative z-30 inline-flex h-11 min-h-[44px] items-center justify-center gap-1.5 rounded-xl px-3 text-xs font-semibold shadow-xs transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] sm:px-3.5 sm:text-sm',
                item.in_stock
                  ? 'cursor-pointer bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] active:scale-95'
                  : 'cursor-not-allowed border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-muted)]'
              )}
            >
              <Plus className="h-4 w-4" />
              <span>{cartQty > 0 ? `Add (${cartQty})` : 'Add to cart'}</span>
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
