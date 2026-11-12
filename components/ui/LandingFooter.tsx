'use client'

import Link from 'next/link'
import { motion, useReducedMotion, useInView } from 'framer-motion'
import { useRef } from 'react'
import { Youtube, Twitter, Linkedin, Instagram } from 'lucide-react'

/* ─── Giant marquee-word config ─────────────────────────────────────── */
const BRAND_WORD = 'MITE'

/* ─── Social links ───────────────────────────────────────────────────── */
const SOCIALS = [
  { href: 'https://youtube.com', label: 'YouTube', Icon: Youtube },
  { href: 'https://twitter.com', label: 'X / Twitter', Icon: Twitter },
  { href: 'https://linkedin.com', label: 'LinkedIn', Icon: Linkedin },
  { href: 'https://instagram.com', label: 'Instagram', Icon: Instagram },
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
          'font-extrabold leading-none tracking-tighter',
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
  const inView = useInView(ref, { once: true, margin: '-80px 0px' })

  const lineVariants = {
    hidden: { opacity: 0, y: 14 },
    show:   { opacity: 1, y: 0,  transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
  }

  const containerVariants = {
    hidden: {},
    show:   { transition: { staggerChildren: 0.07 } },
  }

  return (
    <footer
      ref={ref}
      className={[
        'relative overflow-hidden',
        // Dark slab — in light mode: near-black;  dark mode: even deeper black
        'bg-[#0D0608]',
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
          © MITE {new Date().getFullYear()}
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
            className="font-extrabold leading-none tracking-tighter text-[22vw] text-white opacity-[0.11] -mb-[4vw] select-none pointer-events-none"
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
