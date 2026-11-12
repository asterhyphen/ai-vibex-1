'use client'

import Link from 'next/link'
import { motion, useReducedMotion, type Variants } from 'framer-motion'
import {
  ArrowRight,
  ChevronDown,
  Clock,
  MapPin,
  Printer,
  QrCode,
  ShieldCheck,
  Sparkles,
  UtensilsCrossed,
  Zap,
} from 'lucide-react'
import { HeroScene } from '@/components/3d/HeroScene'
import { BrandQMark } from '@/components/ui/BrandQMark'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
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

const FEATURES = [
  {
    icon: Zap,
    title: '⚡ Order in 30 seconds',
    description:
      'Browse today’s live canteen menu or type in plain words, pick a 10-minute pickup window, and pay online or at the counter.',
    accent: 'from-[var(--primary)]/14 to-[var(--accent)]/12',
    iconColor: 'text-[var(--primary)]',
  },
  {
    icon: Clock,
    title: '🎯 Live Kitchen View',
    description:
      'Follow your order from Placed to Ready in real time. Faculty orders receive automatic priority so meals stay hot between lectures.',
    accent: 'from-[var(--accent)]/16 to-[var(--primary)]/10',
    iconColor: 'text-[var(--accent)]',
  },
  {
    icon: Printer,
    title: '📄 Print Shop',
    description:
      'Upload PDFs straight from your phone, get instant page counts and cost estimates for A4/A3 B&W or color, and collect with a QR.',
    accent: 'from-[var(--primary)]/10 to-[var(--success)]/14',
    iconColor: 'text-[var(--primary)]',
  },
] as const

const STATS = [
  {
    value: '2000+ orders served',
    detail: 'Across morning rush & lunch breaks',
    icon: UtensilsCrossed,
  },
  {
    value: '< 2 min avg wait',
    detail: 'Walk up, scan QR, pick up hot food',
    icon: Clock,
  },
  {
    value: '5 campus locations',
    detail: 'Main Canteen, Espresso Bar, Print Hub & more',
    icon: MapPin,
  },
] as const

export default function LandingPage() {
  const prefersReducedMotion = useReducedMotion()

  return (
    <div className="relative min-h-screen flex flex-col bg-[var(--bg)] text-[var(--text)] overflow-x-clip">
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
              Pre-Order &amp; Print
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
              <motion.div
                variants={fadeUp}
                className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3.5 py-1.5 text-xs font-semibold text-[var(--primary)] shadow-xs"
              >
                <ShieldCheck className="h-3.5 w-3.5 text-[var(--accent)]" />
                <span>Exclusive for @mite.ac.in students &amp; faculty</span>
              </motion.div>

              <h1 className="mt-6 text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.08] text-[var(--text)]">
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
                Pre-order your canteen meals, pick up with a QR scan. Reserve a
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

              <motion.div
                variants={fadeUp}
                className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs sm:text-sm text-[var(--text-muted)]"
              >
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-[var(--success)]" />
                  Open 08:00 AM – 08:00 PM
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-[var(--accent)]" />
                  10-min pickup slots
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-[var(--primary)]" />
                  Contactless QR counter
                </span>
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
                <div className="pointer-events-none absolute bottom-4 left-4 right-4 sm:right-auto sm:w-72 rounded-2xl border border-white/15 bg-[#14080C]/80 backdrop-blur-md p-3.5 text-white shadow-xl">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-white/65">
                        Live Pickup Pass
                      </p>
                      <p className="text-base font-extrabold tracking-tight text-[#D4A855]">
                        A-0142 · Ready
                      </p>
                      <p className="text-[11px] text-white/75">
                        2× Masala Dosa, Filter Coffee
                      </p>
                    </div>
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-[#D4A855]">
                      <QrCode className="h-5 w-5" />
                    </div>
                  </div>
                </div>
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
            <p className="text-xs font-bold uppercase tracking-widest text-[var(--accent)]">
              Built for campus breaks
            </p>
            <h2 className="mt-2 text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--text)]">
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
            {FEATURES.map((feature) => {
              const Icon = feature.icon
              return (
                <motion.article
                  key={feature.title}
                  variants={featureItemVariants}
                  className="group relative flex flex-col rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-xs transition-all duration-200 ease-out motion-safe:hover:-translate-y-1 hover:border-[var(--primary)]/50 hover:shadow-[0_16px_36px_-10px_rgba(122,31,61,0.24)]"
                >
                  <div
                    className={`inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${feature.accent} border border-[var(--border)]`}
                  >
                    <Icon className={`h-6 w-6 ${feature.iconColor}`} />
                  </div>
                  <h3 className="mt-5 text-lg font-bold text-[var(--text)]">
                    {feature.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">
                    {feature.description}
                  </p>
                </motion.article>
              )
            })}
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
                      <p className="text-lg font-extrabold tracking-tight text-[var(--text)]">
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
                  &ldquo;I order two masala dosas before walking out of the lab and
                  grab them hot in 45 seconds.&rdquo;
                </span>
              </p>
              <span className="shrink-0 text-xs font-semibold text-[var(--text-muted)]">
                — 6th Sem CSE, MITE Moodabidri
              </span>
            </motion.div>
          </motion.div>
        </section>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-[var(--border)] bg-[var(--surface)]">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-[var(--text)]">
              SkipQ Pre-Order System
            </p>
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">
              Mangalore Institute of Technology &amp; Engineering · Moodabidri
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <nav
              aria-label="Portal links"
              className="flex flex-wrap items-center gap-2 text-xs font-medium text-[var(--text-muted)]"
            >
              <Link
                href="/login"
                className="inline-flex min-h-[44px] items-center rounded-lg px-3 hover:bg-[var(--surface-2)] hover:text-[var(--text)] transition-colors"
              >
                Student &amp; Faculty
              </Link>
              <Link
                href="/staff/login"
                className="inline-flex min-h-[44px] items-center rounded-lg px-3 hover:bg-[var(--surface-2)] hover:text-[var(--text)] transition-colors"
              >
                Kitchen &amp; Print Staff
              </Link>
              <Link
                href="/admin/login"
                className="inline-flex min-h-[44px] items-center rounded-lg px-3 hover:bg-[var(--surface-2)] hover:text-[var(--text)] transition-colors"
              >
                Admin
              </Link>
            </nav>
            <ThemeToggle />
          </div>
        </div>
      </footer>
    </div>
  )
}
