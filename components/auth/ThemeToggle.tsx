'use client'

import { useSyncExternalStore } from 'react'
import { useTheme } from 'next-themes'
import { AnimatePresence, motion } from 'framer-motion'
import { Moon, Sun } from 'lucide-react'

interface ThemeToggleProps {
  className?: string
}

const emptySubscribe = () => () => {}

const VIEW_TRANSITION_STYLE_ID = 'mite-theme-view-transition-style'

function ensureViewTransitionStyles() {
  if (typeof document === 'undefined') return
  if (document.getElementById(VIEW_TRANSITION_STYLE_ID)) return
  const style = document.createElement('style')
  style.id = VIEW_TRANSITION_STYLE_ID
  style.textContent = `
    ::view-transition-old(root),
    ::view-transition-new(root) {
      animation: none;
      mix-blend-mode: normal;
    }
    ::view-transition-old(root) {
      z-index: 1;
    }
    ::view-transition-new(root) {
      z-index: 9999;
    }
  `
  document.head.appendChild(style)
}

export function ThemeToggle({ className = '' }: ThemeToggleProps) {
  const { resolvedTheme, setTheme } = useTheme()
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  )

  const isDark = mounted && resolvedTheme === 'dark'

  const handleToggle = (event: React.MouseEvent<HTMLButtonElement>) => {
    const nextTheme = isDark ? 'light' : 'dark'
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const doc = document as Document & {
      startViewTransition?: (callback: () => void) => {
        ready: Promise<void>
      }
    }

    if (!doc.startViewTransition || prefersReducedMotion) {
      setTheme(nextTheme)
      return
    }

    ensureViewTransitionStyles()

    const rect = event.currentTarget.getBoundingClientRect()
    const x = event.clientX || rect.left + rect.width / 2
    const y = event.clientY || rect.top + rect.height / 2
    const endRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    )

    const transition = doc.startViewTransition(() => {
      setTheme(nextTheme)
    })

    transition.ready
      .then(() => {
        document.documentElement.animate(
          {
            clipPath: [
              `circle(0px at ${x}px ${y}px)`,
              `circle(${endRadius}px at ${x}px ${y}px)`,
            ],
          },
          {
            duration: 480,
            easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
            pseudoElement: '::view-transition-new(root)',
          }
        )
      })
      .catch(() => {
        // Ignore cancelled view transitions
      })
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={isDark ? 'Switch to Ivory & Burgundy' : 'Switch to Burgundy Night'}
      className={`relative inline-flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] shadow-sm transition-colors hover:border-[var(--primary)] hover:bg-[var(--surface-2)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] cursor-pointer ${className}`}
    >
      <AnimatePresence mode="wait" initial={false}>
        {mounted ? (
          isDark ? (
            <motion.span
              key="sun"
              initial={{ rotate: -90, scale: 0.6, opacity: 0 }}
              animate={{ rotate: 0, scale: 1, opacity: 1 }}
              exit={{ rotate: 90, scale: 0.6, opacity: 0 }}
              transition={{ duration: 0.22 }}
              className="flex items-center justify-center text-[var(--accent)]"
            >
              <Sun className="h-5 w-5" />
            </motion.span>
          ) : (
            <motion.span
              key="moon"
              initial={{ rotate: 90, scale: 0.6, opacity: 0 }}
              animate={{ rotate: 0, scale: 1, opacity: 1 }}
              exit={{ rotate: -90, scale: 0.6, opacity: 0 }}
              transition={{ duration: 0.22 }}
              className="flex items-center justify-center text-[var(--primary)]"
            >
              <Moon className="h-5 w-5" />
            </motion.span>
          )
        ) : (
          <span className="h-5 w-5" aria-hidden="true" />
        )}
      </AnimatePresence>
    </button>
  )
}
