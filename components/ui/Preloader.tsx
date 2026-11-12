'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, useAnimate, useReducedMotion } from 'framer-motion'

/**
 * Initial-mount preloader choreography:
 * 1. Circular plate draws/scales in at center.
 * 2. Spoon glides into the lower-right rim to form the "Q".
 * 3. Plate + spoon "Q" animates smoothly into [data-brand-q-target="true"]
 *    in the navbar as the overlay fades out.
 * Skipped immediately when prefers-reduced-motion is enabled.
 */
export function Preloader() {
  const prefersReducedMotion = useReducedMotion()
  const [visible, setVisible] = useState(true)
  const [nonBlocking, setNonBlocking] = useState(false)
  const [scope, animate] = useAnimate()
  const markRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (prefersReducedMotion) {
      return
    }

    let cancelled = false
    const safetyTimer = window.setTimeout(() => {
      if (!cancelled) setVisible(false)
    }, 2600)

    const sleep = (ms: number) =>
      new Promise<void>((resolve) => {
        window.setTimeout(resolve, ms)
      })

    async function runSequence() {
      try {
        // Wait one animation frame so initial DOM + navbar target rects settle
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
        if (cancelled || !scope.current) return

        // Stage 1: Circular plate scales & fades in at center
        await animate(
          '[data-preloader-plate]',
          { scale: [0.45, 1], opacity: [0, 1] },
          { duration: 0.42, ease: [0.22, 1, 0.36, 1] }
        )
        if (cancelled) return

        // Stage 2: Spoon glides into lower-right rim forming "Q" + caption appears
        await Promise.all([
          animate(
            '[data-preloader-spoon]',
            { x: [64, 0], y: [-46, 0], rotate: [-24, 0], opacity: [0, 1] },
            { duration: 0.48, ease: [0.22, 1, 0.36, 1] }
          ),
          animate(
            '[data-preloader-caption]',
            { opacity: [0, 1], y: [8, 0] },
            { duration: 0.35, delay: 0.12, ease: 'easeOut' }
          ),
        ])
        if (cancelled) return

        await sleep(160)
        if (cancelled) return

        // Stage 3: Fly smoothly into the navbar [data-brand-q-target="true"] slot
        setNonBlocking(true)

        const targetEl = document.querySelector<HTMLElement>(
          '[data-brand-q-target="true"]'
        )
        const markEl = markRef.current

        if (targetEl && markEl) {
          const targetRect = targetEl.getBoundingClientRect()
          const markRect = markEl.getBoundingClientRect()

          if (targetRect.width > 0 && markRect.width > 0) {
            const dx =
              targetRect.left +
              targetRect.width / 2 -
              (markRect.left + markRect.width / 2)
            const dy =
              targetRect.top +
              targetRect.height / 2 -
              (markRect.top + markRect.height / 2)
            const targetScale = targetRect.width / markRect.width

            await Promise.all([
              animate(
                '[data-preloader-caption]',
                { opacity: 0, y: -4 },
                { duration: 0.2, ease: 'easeOut' }
              ),
              animate(
                '[data-preloader-backdrop]',
                { opacity: 0 },
                { duration: 0.42, delay: 0.08, ease: 'easeOut' }
              ),
              animate(
                '[data-preloader-mark]',
                { x: dx, y: dy, scale: targetScale },
                { duration: 0.56, ease: [0.22, 1, 0.36, 1] }
              ),
            ])
            if (cancelled) return

            await animate(
              '[data-preloader-mark]',
              { opacity: 0 },
              { duration: 0.12, ease: 'easeOut' }
            )
          } else {
            await animate(
              scope.current,
              { opacity: 0 },
              { duration: 0.32, ease: 'easeOut' }
            )
          }
        } else {
          await animate(
            scope.current,
            { opacity: 0 },
            { duration: 0.35, ease: 'easeOut' }
          )
        }
      } catch {
        // Fallback: ensure preloader never traps the screen
      } finally {
        if (!cancelled) {
          setVisible(false)
        }
      }
    }

    void runSequence()

    return () => {
      cancelled = true
      window.clearTimeout(safetyTimer)
    }
  }, [animate, prefersReducedMotion, scope])

  if (prefersReducedMotion || !visible) {
    return null
  }

  return (
    <div
      ref={scope}
      aria-hidden="true"
      className={`fixed inset-0 z-[100] flex items-center justify-center ${
        nonBlocking ? 'pointer-events-none' : 'pointer-events-auto'
      }`}
    >
      {/* Backdrop */}
      <div
        data-preloader-backdrop
        className="absolute inset-0 bg-[var(--bg)]"
      />

      {/* Centered Plate + Spoon "Q" */}
      <div className="relative z-10 flex flex-col items-center">
        <div
          ref={markRef}
          data-preloader-mark
          className="h-[128px] w-[128px] flex items-center justify-center"
        >
          <svg
            width="128"
            height="128"
            viewBox="0 0 64 64"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="h-full w-full overflow-visible"
          >
            {/* Stage 1: Plate */}
            <motion.g
              data-preloader-plate
              initial={{ scale: 0.45, opacity: 0 }}
              style={{ transformOrigin: '45.3% 45.3%', transformBox: 'view-box' }}
            >
              <circle
                cx="29"
                cy="29"
                r="21"
                fill="var(--surface)"
                stroke="var(--primary)"
                strokeWidth="5"
              />
              <circle
                cx="29"
                cy="29"
                r="14"
                fill="var(--bg)"
                stroke="var(--accent-gold, #B8893B)"
                strokeWidth="1.75"
                strokeOpacity="0.85"
              />
              <path
                d="M 15.5 21 A 15 15 0 0 1 28 14"
                stroke="var(--surface)"
                strokeWidth="2"
                strokeLinecap="round"
                opacity="0.7"
              />
            </motion.g>

            {/* Stage 2: Spoon gliding in to complete the Q */}
            <motion.g
              data-preloader-spoon
              initial={{ x: 64, y: -46, rotate: -24, opacity: 0 }}
              style={{ transformOrigin: '56.25% 56.25%', transformBox: 'view-box' }}
            >
              <g transform="translate(36 36) rotate(45)">
                <path
                  d="M -13 0 C -13 -3.8 -8 -5.2 -3 -4.6 C 0.5 -4.1 2 -1.7 4 -1.6 L 20.5 -2.2 C 22.4 -2.2 23.6 -1.2 23.6 0 C 23.6 1.2 22.4 2.2 20.5 2.2 L 4 1.6 C 2 1.7 0.5 4.1 -3 4.6 C -8 5.2 -13 3.8 -13 0 Z"
                  fill="var(--accent-gold, #B8893B)"
                  stroke="var(--primary)"
                  strokeWidth="2.1"
                  strokeLinejoin="round"
                />
                <ellipse
                  cx="-6"
                  cy="-1.2"
                  rx="3.6"
                  ry="1.4"
                  fill="var(--surface)"
                  opacity="0.45"
                />
              </g>
            </motion.g>
          </svg>
        </div>

        <motion.div
          data-preloader-caption
          initial={{ opacity: 0, y: 8 }}
          className="mt-4 flex flex-col items-center text-center"
        >
          <span className="font-display text-lg font-bold tracking-tight text-[var(--text)]">
            SkipQ
          </span>
          <span className="mt-0.5 text-xs font-medium tracking-wide text-[var(--text-muted)]">
            Skip the queue
          </span>
        </motion.div>
      </div>
    </div>
  )
}
