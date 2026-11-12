'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils/format'

interface LoadingBarProps {
  used: number
  capacity: number
  label?: string
  showFraction?: boolean
  size?: 'sm' | 'md'
  className?: string
}

function getFillColor(pct: number): string {
  if (pct < 50) return 'var(--success)'
  if (pct <= 80) return 'var(--warning)'
  return 'var(--danger)'
}

/**
 * Animated slot capacity bar with green -> amber -> red color transitions
 * based on fill percentage.
 */
export function LoadingBar({
  used,
  capacity,
  label,
  showFraction = true,
  size = 'md',
  className,
}: LoadingBarProps) {
  const safeCap = capacity > 0 ? capacity : 1
  const safeUsed = Math.max(0, used)
  const pct = Math.min(100, Math.round((safeUsed / safeCap) * 100))
  const barColor = getFillColor(pct)

  return (
    <div className={cn('w-full space-y-1.5', className)}>
      {(label || showFraction) && (
        <div className="flex items-center justify-between gap-2 text-xs">
          {label ? (
            <span className="font-medium text-[var(--text)]">{label}</span>
          ) : (
            <span className="text-[var(--text-muted)]">Capacity</span>
          )}
          {showFraction && (
            <span className="font-mono font-semibold text-[var(--text-muted)]">
              {safeUsed}/{capacity} ({pct}%)
            </span>
          )}
        </div>
      )}

      <div
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? 'Slot capacity'}
        className={cn(
          'w-full overflow-hidden rounded-full bg-[var(--surface-2)] border border-[var(--border)]',
          size === 'sm' ? 'h-2' : 'h-3'
        )}
      >
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          style={{ backgroundColor: barColor }}
          className="h-full rounded-full transition-colors duration-300"
        />
      </div>
    </div>
  )
}
