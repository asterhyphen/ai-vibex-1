'use client'

import Link from 'next/link'
import { motion, useReducedMotion, useInView, type Variants } from 'framer-motion'
import { useRef } from 'react'

function YoutubeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17" />
      <path d="m10 15 5-3-5-3v6Z" />
    </svg>
  )
}

function TwitterIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z" />
    </svg>
  )
}

function LinkedinIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect width="4" height="12" x="2" y="9" />
      <circle cx="4" cy="4" r="2" />
    </svg>
  )
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  )
}

/* ─── Giant marquee-word config ─────────────────────────────────────── */
const BRAND_WORD = 'MITE'

/* ─── Social links ───────────────────────────────────────────────────── */
const SOCIALS = [
  { href: 'https://youtube.com', label: 'YouTube', Icon: YoutubeIcon },
  { href: 'https://twitter.com', label: 'X / Twitter', Icon: TwitterIcon },
  { href: 'https://linkedin.com', label: 'LinkedIn', Icon: LinkedinIcon },
  { href: 'https://instagram.com', label: 'Instagram', Icon: InstagramIcon },
] as const

/* ─── Nav links ──────────────────────────────────────────────────────── */
const NAV_LINKS = [
  { label: 'Privacy', href: '#' },
  { label: 'Terms', href: '#' },
  { label: 'About', href: '#' },
] as const

/* ─────────────────────────────────────────────────────────────────────
   Giant animated brand word — scales from 0.92 → 1 on scroll-in
   with a subtle upward drift, identical to the Mobbin watermark text.
───────────────────────────────────────────────────────────────────── */
function GiantBrandWord({ reduced }: { reduced: boolean }) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none select-none w-full overflow-hidden"
    >
      {/* Light mode: very dark text at ~8% opacity  */}
      {/* Dark mode:  subtle lighter text at ~8% opacity */}
      <motion.p
        initial={reduced ? false : { opacity: 0, y: 32, scale: 0.94 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1], delay: 0.08 }}
        className={[
          'font-bold leading-none tracking-tighter',
          'text-[22vw]',               // Giant: fills full width at ~22vw
          // Footer bg is always near-black (#0D0608) → white watermark at ~12% opacity
          'text-white',
          'opacity-[0.11]',
          // Keep it vertically tight — allow slight bleed below
          '-mb-[4vw]',
        ].join(' ')}
        style={{ fontFamily: 'var(--font-fraunces)' }}
      >
        {BRAND_WORD}
      </motion.p>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────
   The main footer component
───────────────────────────────────────────────────────────────────── */
export function LandingFooter() {
  const reduced = useReducedMotion() ?? false
  const ref = useRef<HTMLElement>(null)
  const inView = useInView(ref, { once: true, amount: 0.15 })

  const lineVariants: Variants = {
    hidden: { opacity: 0, y: 14 },
    show:   { opacity: 1, y: 0,  transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
  }

  const containerVariants: Variants = {
    hidden: {},
    show:   { transition: { staggerChildren: 0.07 } },
  }

  return (
    <footer
      ref={ref}
      className={[
        'relative overflow-hidden',
        // Rich deep burgundy slab
        'bg-gradient-to-b from-[#2E0E1A] via-[#240A14] to-[#1A060E]',
      ].join(' ')}
    >
      {/* ── Top meta bar ─────────────────────────────────────────────── */}
      <motion.div
        variants={reduced ? undefined : containerVariants}
        initial="hidden"
        animate={inView ? 'show' : 'hidden'}
        className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 pt-10 pb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5"
      >
        {/* Copyright */}
        <motion.p
          variants={reduced ? undefined : lineVariants}
          className="text-sm font-medium text-white/45 tracking-wide"
        >
          © MITE 2026
        </motion.p>

        {/* Right side — nav + socials */}
        <motion.div
          variants={reduced ? undefined : lineVariants}
          className="flex flex-wrap items-center gap-x-6 gap-y-3"
        >
          {/* Nav links */}
          <nav aria-label="Footer navigation" className="flex items-center gap-5">
            {NAV_LINKS.map(({ label, href }) => (
              <Link
                key={label}
                href={href}
                className="text-sm font-medium text-white/45 transition-colors duration-200 hover:text-white/90"
              >
                {label}
              </Link>
            ))}
          </nav>

          {/* Social icons */}
          <div className="flex items-center gap-3">
            {SOCIALS.map(({ href, label, Icon }) => (
              <motion.a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                whileHover={reduced ? undefined : { scale: 1.18, y: -2 }}
                whileTap={reduced ? undefined : { scale: 0.92 }}
                transition={{ type: 'spring', stiffness: 380, damping: 18 }}
                className={[
                  'flex h-8 w-8 items-center justify-center rounded-lg',
                  'text-white/40 transition-colors duration-200',
                  'hover:text-white/90',
                  'focus-visible:outline-2 focus-visible:outline-white/60',
                ].join(' ')}
              >
                <Icon className="h-4 w-4" aria-hidden />
              </motion.a>
            ))}
          </div>
        </motion.div>
      </motion.div>

      {/* ── Thin divider ─────────────────────────────────────────────── */}
      <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="h-px w-full bg-white/[0.07]" />
      </div>

      {/* ── Giant brand watermark word ────────────────────────────────── */}
      <div className="relative z-10 mt-2 w-full flex items-end justify-start overflow-hidden px-4 sm:px-6 lg:px-8">
        {reduced ? (
          <p
            aria-hidden
            className="font-bold leading-none tracking-tighter text-[22vw] text-white opacity-[0.11] -mb-[4vw] select-none pointer-events-none"
            style={{ fontFamily: 'var(--font-fraunces)' }}
          >
            {BRAND_WORD}
          </p>
        ) : (
          <GiantBrandWord reduced={reduced} />
        )}
      </div>
    </footer>
  )
}
