'use client'

import { motion } from 'framer-motion'
import type { Category } from '@/lib/types'
import { cn } from '@/lib/utils/format'

interface CategoryChipsProps {
  categories: Category[]
  selectedCategoryId: string
  onSelect: (categoryId: string) => void
  itemCounts?: Record<string, number>
}

export function CategoryChips({
  categories,
  selectedCategoryId,
  onSelect,
  itemCounts,
}: CategoryChipsProps) {
  const allCount = itemCounts
    ? Object.values(itemCounts).reduce((sum, count) => sum + count, 0)
    : undefined

  const chips = [
    { id: 'all', name: 'All', icon: '', count: allCount },
    ...categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      icon: cat.icon ?? '',
      count: itemCounts?.[cat.id],
    })),
  ]

  return (
    <div
      role="tablist"
      aria-label="Menu categories"
      className="flex items-center gap-2 overflow-x-auto pb-1.5 pt-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {chips.map((chip) => {
        const isActive = selectedCategoryId === chip.id
        return (
          <button
            key={chip.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onSelect(chip.id)}
            className={cn(
              'relative inline-flex h-11 min-h-[44px] shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]',
              isActive
                ? 'border-transparent text-white'
                : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text)] hover:border-[var(--primary)]/50 hover:bg-[var(--surface-2)]'
            )}
          >
            {isActive && (
              <motion.span
                layoutId="active-category-chip"
                transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                className="absolute inset-0 rounded-full bg-[var(--primary)] shadow-sm"
                aria-hidden="true"
              />
            )}
            <span className="relative z-10 flex items-center gap-1.5">
              {chip.icon ? <span aria-hidden="true">{chip.icon}</span> : null}
              <span>{chip.name}</span>
              {typeof chip.count === 'number' && (
                <span
                  className={cn(
                    'rounded-full px-1.5 py-0.5 text-[11px] font-semibold leading-none tabular-nums',
                    isActive
                      ? 'bg-white/20 text-white'
                      : 'bg-[var(--surface-2)] text-[var(--text-muted)]'
                  )}
                >
                  {chip.count}
                </span>
              )}
            </span>
          </button>
        )
      })}
    </div>
  )
}
