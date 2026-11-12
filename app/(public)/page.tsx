'use client'

import { useRef } from 'react'
import Link from 'next/link'
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
  type Variants,
} from 'framer-motion'
import {
  ArrowRight,
  ChevronDown,
  Clock,
  Printer,
  Sparkles,
  UtensilsCrossed,
  Zap,
} from 'lucide-react'
import { HeroScene } from '@/components/3d/HeroScene'
import { BrandQMark } from '@/components/ui/BrandQMark'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { LandingFooter } from '@/components/ui/LandingFooter'
import {
  fadeUp,
  maskRevealLine,
  stagger,
} from '@/lib/utils/motion'

const heroContainer: Variants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.1,
    },
  },
}

const featureContainerVariants: Variants = stagger(0.06)
const featureItemVariants: Variants = fadeUp



const STATS = [
  {
    value: '10-min pickup windows',
    detail: 'Scheduled slots across morning & lunch breaks',
    icon: Clock,
  },
  {
    value: 'Live kitchen priority queue',
    detail: 'Walk up, scan QR, pick up hot food',
    icon: UtensilsCrossed,
  },
  {
    value: 'A4 & A3 PDF print counter',
    detail: 'Instant page count, sanitization & cost estimate',
    icon: Printer,
  },
] as const

export default function LandingPage() {
  const prefersReducedMotion = useReducedMotion()
  const footerRevealRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: footerRevealRef,
    offset: ['start end', 'end end'],
  })
  const sheetRadius = useTransform(scrollYProgress, [0, 1], [20, 48])
  const sheetScale = useTransform(scrollYProgress, [0, 1], [1, 0.985])

  return (
    <div className="relative min-h-screen flex flex-col bg-[#240A14] text-[var(--text)] overflow-x-clip">
      {/* Curved top page sheet that reveals the dark footer underneath */}
      <motion.div
        style={
          prefersReducedMotion
            ? undefined
            : {
                borderBottomLeftRadius: sheetRadius,
                borderBottomRightRadius: sheetRadius,
                scale: sheetScale,
                transformOrigin: 'top center',
              }
        }
        className="relative z-10 flex flex-col bg-[var(--bg)] rounded-b-[36px] sm:rounded-b-[48px] shadow-[0_28px_70px_-15px_rgba(0,0,0,0.6)] overflow-x-clip"
      >
        {/* Subtle brand hero gradient wash */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-[780px]"
          style={{
            background:
              'radial-gradient(ellipse 80% 55% at 20% 0%, color-mix(in srgb, var(--primary) 16%, transparent), transparent 70%), radial-gradient(ellipse 65% 50% at 88% 12%, color-mix(in srgb, var(--accent) 18%, transparent), transparent 68%), linear-gradient(180deg, color-mix(in srgb, var(--primary) 5%, var(--bg)) 0%, var(--bg) 100%)',
          }}
        />

      {/* Top Navigation */}
      <header className="relative z-10 mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 pt-5 pb-3 flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex min-h-[44px] items-center gap-3 rounded-xl px-1.5 focus-visible:outline-2 focus-visible:outline-[var(--primary)]"
        >
          <span
            data-brand-q-target="true"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center"
          >
            <BrandQMark size={40} />
          </span>
          <span className="flex flex-col leading-tight">
            <span className="text-base font-bold tracking-tight text-[var(--text)]">
              SkipQ
            </span>
            <span className="text-[11px] font-medium text-[var(--text-muted)]">
              Skip the queue
            </span>
          </span>
        </Link>

        <div className="flex items-center gap-2.5">
          <Link
            href="/login"
            className="hidden sm:inline-flex min-h-[44px] items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-semibold text-[var(--text)] hover:border-[var(--primary)] hover:bg-[var(--surface-2)] transition-colors"
          >
            Sign in
          </Link>
          <ThemeToggle />
        </div>
      </header>

      {/* Main Hero */}
      <main className="relative z-10 flex-1">
        <section className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 pt-6 pb-16 sm:pt-10 sm:pb-20 min-h-[calc(100vh-84px)] flex flex-col justify-center">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-10 items-center">
            {/* Left Half: Line-by-line mask reveal + Magnetic CTA */}
            <motion.div
              variants={heroContainer}
              initial="hidden"
              animate="show"
              className="lg:col-span-6 flex flex-col items-start text-left"
            >
            

              <h1 className="mt-6 text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.08] text-[var(--text)]">
                <span className="block overflow-hidden pb-1">
                  <motion.span variants={maskRevealLine} className="block">
                    Skip the queue.
                  </motion.span>
                </span>
                <span className="block overflow-hidden pb-1">
                  <motion.span
                    variants={maskRevealLine}
                    className="block text-[var(--primary)]"
                  >
                    Not the meal.
                  </motion.span>
                </span>
              </h1>

              <motion.p
                variants={fadeUp}
                className="mt-5 max-w-xl text-base sm:text-lg leading-relaxed text-[var(--text-muted)]"
              >
                Pre-order your canteen meals and printing documents, pick up with a QR scan. Reserve a
                10-minute break slot, track kitchen prep live, and send PDFs to
                the campus print counter in one tap.
              </motion.p>

              <motion.div
                variants={fadeUp}
                className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5 w-full sm:w-auto"
              >
                <Link
                  href="/login"
                  className="inline-flex w-full sm:w-auto min-h-[48px] items-center justify-center gap-2.5 rounded-xl bg-[var(--primary)] px-6 py-3.5 text-base font-semibold text-white shadow-sm transition-colors duration-200 hover:bg-[var(--primary-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
                >
                  <span>Continue with college email</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>

                <a
                  href="#features"
                  className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] px-5 py-3.5 text-sm font-semibold text-[var(--text)] transition-colors duration-200 hover:border-[var(--primary)] hover:bg-[var(--surface-2)]"
                >
                  See how it works
                </a>
              </motion.div>

              
            </motion.div>

            {/* Right Half: Lazy-loaded 3D HeroScene */}
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 18 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
              className="lg:col-span-6"
            >
              <div className="relative mx-auto w-full max-w-xl h-[360px] sm:h-[440px] lg:h-[490px] rounded-3xl border border-[var(--border)] shadow-2xl overflow-hidden">
                <HeroScene className="h-full w-full" />

                {/* Floating compact live pass pill */}
                
              </div>
            </motion.div>
          </div>

          {/* Animated Scroll Indicator */}
          <div className="mt-10 flex justify-center">
            <motion.a
              href="#features"
              aria-label="Scroll to features"
              animate={
                prefersReducedMotion ? undefined : { y: [0, 8, 0] }
              }
              transition={{
                repeat: Infinity,
                duration: 1.6,
                ease: 'easeInOut',
              }}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)]/90 text-[var(--text-muted)] shadow-xs hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors"
            >
              <ChevronDown className="h-5 w-5" />
            </motion.a>
          </div>
        </section>

        {/* Features Section */}
        <section
          id="features"
          className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 pb-16 sm:pb-20"
        >
          <div className="max-w-2xl">
            <p className="text-xs font-semibold text-[var(--accent)]">
              Built for campus breaks
            </p>
            <h2 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text)]">
              Everything you need between lectures
            </h2>
          </div>

          <motion.div
            variants={featureContainerVariants}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.2 }}
            className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-5"
          >
            
              
          </motion.div>
        </section>

        {/* Stats & Testimonial Strip */}
        <section
          aria-label="Campus stats and feedback"
          className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 pb-20 sm:pb-24"
        >
          <motion.div
            variants={stagger(0.06)}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.2 }}
            className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 sm:p-8 shadow-sm"
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {STATS.map((stat) => {
                const Icon = stat.icon
                return (
                  <motion.div
                    key={stat.value}
                    variants={fadeUp}
                    className="flex items-start gap-3.5 rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/60 p-4"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)]">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-lg font-bold tracking-tight text-[var(--text)] tabular-nums">
                        {stat.value}
                      </p>
                      <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                        {stat.detail}
                      </p>
                    </div>
                  </motion.div>
                )
              })}
            </div>

            <motion.div
              variants={fadeUp}
              className="mt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-[var(--border)] pt-5"
            >
              <p className="flex items-center gap-2 text-sm text-[var(--text)]">
                <Sparkles className="h-4 w-4 shrink-0 text-[var(--accent)]" />
                <span>
                  &ldquo;I order two avocado toasts and an espresso and
                  grab them hot in 45 seconds.&rdquo;
                </span>
              </p>
              <span className="shrink-0 text-xs font-semibold text-[var(--text-muted)]">
                — Ahmed, 5th Sem ISE, MITE Moodabidri
              </span>
            </motion.div>
          </motion.div>
        </section>
      </main>

      {/* ── CTA bridge section (white card → dark footer transition) ── */}
      <section className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 pb-16 sm:pb-20">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
          className="relative rounded-3xl border border-[var(--border)] bg-[var(--surface)] px-8 py-12 sm:px-14 sm:py-16 text-center shadow-xl overflow-hidden"
        >
          {/* Subtle radial blush */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'radial-gradient(ellipse 70% 60% at 50% 110%, color-mix(in srgb, var(--primary) 10%, transparent), transparent 70%)',
            }}
          />
          
          <p className="relative mt-3 text-sm sm:text-base text-[var(--text-muted)] max-w-lg mx-auto leading-relaxed">
            Built for MITE campus, order ahead, pay in seconds, and
            pick up with a QR scan.
          </p>
          <div className="relative mt-7 flex flex-col sm:flex-row items-center justify-center gap-3.5">
            <Link
              href="/login"
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-[var(--text)] px-6 py-3.5 text-sm font-semibold text-[var(--bg)] shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:opacity-90 active:scale-[0.97]"
            >
              Order now
            </Link>
            <Link
              href="#features"
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-transparent px-6 py-3.5 text-sm font-semibold text-[var(--text)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--primary)] hover:bg-[var(--surface-2)]"
            >
              Explore features
            </Link>
          </div>
        </motion.div>
      </section>
      </motion.div>

      {/* ── Mobbin-style sticky reveal burgundy footer ────────────────── */}
      <div ref={footerRevealRef} className="relative z-0 -mt-12 pt-12 bg-[#240A14]">
        <div className="sticky bottom-0">
          <LandingFooter />
        </div>
      </div>
    </div>
  )
}
