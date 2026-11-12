'use client'

import { UtensilsCrossed } from 'lucide-react'
import { cn } from '@/lib/utils/format'

interface HeroFallbackProps {
  className?: string
  label?: string
}

/**
 * Static burgundy-and-gold radial gradient fallback rendered when
 * WebGL is unavailable, loading, or prefers-reduced-motion is active.
 */
export function HeroFallback({
  className,
  label = 'SkipQ — Pre-order meals and campus prints',
}: HeroFallbackProps) {
  return (
    <div
      role="img"
      aria-label={label}
      style={{
        background:
          'radial-gradient(ellipse at 60% 40%, #7A1F3D 0%, #2B1117 50%, #14080C 100%)',
      }}
      className={cn(
        'relative w-full h-full flex flex-col items-center justify-center overflow-hidden rounded-3xl select-none',
        className
      )}
    >
      {/* Subtle gold ambient glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-12 -right-12 h-56 w-56 rounded-full opacity-25 blur-3xl"
        style={{ background: '#B8893B' }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-14 -left-10 h-56 w-56 rounded-full opacity-25 blur-3xl"
        style={{ background: '#7A1F3D' }}
      />
      <UtensilsCrossed
        className="h-14 w-14 text-white/30"
        aria-hidden="true"
      />
    </div>
  )
}
