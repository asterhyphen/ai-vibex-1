'use client'

import { useEffect, useRef, useState } from 'react'

interface AnimatedPriceProps {
  paise: number
  className?: string
}

export function AnimatedPrice({ paise, className = '' }: AnimatedPriceProps) {
  const [displayPaise, setDisplayPaise] = useState(paise)
  const prevRef = useRef(paise)

  useEffect(() => {
    const start = prevRef.current
    const end = paise
    if (start === end) return

    const durationMs = 340
    const startTime = performance.now()
    let rafId = 0

    const tick = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(1, elapsed / durationMs)
      const eased = 1 - Math.pow(1 - progress, 3)
      const current = Math.round(start + (end - start) * eased)
      setDisplayPaise(current)

      if (progress < 1) {
        rafId = requestAnimationFrame(tick)
      } else {
        prevRef.current = end
      }
    }

    rafId = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(rafId)
      prevRef.current = end
    }
  }, [paise])

  const rupees = displayPaise / 100
  const formatted = Number.isInteger(rupees)
    ? `₹${rupees}`
    : `₹${rupees.toFixed(2)}`

  return <span className={`tabular-nums ${className}`}>{formatted}</span>
}
