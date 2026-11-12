'use client'

import Link from 'next/link'
import { motion, type Variants } from 'framer-motion'
import {
  ArrowRight,
  Clock,
  Printer,
  QrCode,
  ShieldCheck,
  UtensilsCrossed,
  Zap,
} from 'lucide-react'
import { ThemeToggle } from '@/components/auth/ThemeToggle'

const heroContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
}

const fadeUpItem: Variants = {
  hidden: { opacity: 0, y: 18 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
  },
}

const featuresContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
}

const FEATURES = [
  {
    icon: Zap,
    title: 'Order in 30 seconds',
    description:
      'Pick from today’s live canteen menu or type in plain words, choose a 10-minute pickup window, and pay online or at the counter.',
    accent: 'from-[var(--primary)]/12 to-[var(--accent)]/12',
    iconColor: 'text-[var(--primary)]',
  },
  {
    icon: Clock,
    title: 'Live Kitchen View',
    description:
      'Follow your order from Placed to Ready in real time. Faculty orders receive automatic priority so meals stay hot between lectures.',
    accent: 'from-[var(--accent)]/15 to-[var(--primary)]/10',
    iconColor: 'text-[var(--accent)]',
  },
  {
    icon: Printer,
    title: 'Print Shop',
    description:
      'Upload PDFs directly from your phone, get instant page count and cost estimates for A4/A3 B&W or color, and collect with your QR.',
    accent: 'from-[var(--primary)]/10 to-[var(--success)]/12',
    iconColor: 'text-[var(--primary)]',
  },
] as const

export default function LandingPage() {
  return (
    <div className="relative min-h-screen flex flex-col bg-[var(--bg)] text-[var(--text)] overflow-x-clip">
      {/* Subtle brand hero gradient wash */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[760px]"
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
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--primary)] text-white shadow-sm">
            <UtensilsCrossed className="h-5 w-5" />
          </span>
          <span className="flex flex-col leading-tight">
            <span className="text-base font-bold tracking-tight text-[var(--text)]">
              MITE Canteen
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
        <section className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 pt-8 pb-16 sm:pt-14 sm:pb-24 min-h-[calc(100vh-88px)] flex flex-col justify-center">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
            <motion.div
              variants={heroContainer}
              initial="hidden"
              animate="visible"
              className="lg:col-span-7 flex flex-col items-start text-left"
            >
              <motion.div
                variants={fadeUpItem}
                className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3.5 py-1.5 text-xs font-semibold text-[var(--primary)] shadow-xs"
              >
                <ShieldCheck className="h-3.5 w-3.5 text-[var(--accent)]" />
                <span>Exclusive for @mite.ac.in students &amp; faculty</span>
              </motion.div>

              <motion.h1
                variants={fadeUpItem}
                className="mt-6 text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.08] text-[var(--text)]"
              >
                Skip the queue.{' '}
                <span className="text-[var(--primary)]">Not the meal.</span>
              </motion.h1>

              <motion.p
                variants={fadeUpItem}
                className="mt-5 max-w-xl text-base sm:text-lg leading-relaxed text-[var(--text-muted)]"
              >
                Pre-order your canteen meals, pick up with a QR scan. Reserve a
                10-minute break slot, track kitchen prep live, and send PDFs to
                the campus print counter in one tap.
              </motion.p>

              <motion.div
                variants={fadeUpItem}
                className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5 w-full sm:w-auto"
              >
                <Link
                  href="/login"
                  className="inline-flex min-h-[48px] items-center justify-center gap-2.5 rounded-xl bg-[var(--primary)] px-6 py-3.5 text-base font-semibold text-white shadow-md transition-all hover:bg-[var(--primary-hover)] hover:shadow-lg active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
                >
                  <span>Continue with college email</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>

                <a
                  href="#features"
                  className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] px-5 py-3.5 text-sm font-semibold text-[var(--text)] transition-colors hover:border-[var(--primary)] hover:bg-[var(--surface-2)]"
                >
                  See how it works
                </a>
              </motion.div>

              <motion.div
                variants={fadeUpItem}
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

            {/* Right: Authentic pickup pass preview */}
            <motion.div
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
              className="lg:col-span-5"
            >
              <div className="relative mx-auto max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6 shadow-xl">
                <div className="flex items-center justify-between border-b border-[var(--border)] pb-4">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                      Pickup Pass Preview
                    </p>
                    <p className="mt-0.5 text-2xl font-extrabold tracking-tight text-[var(--primary)]">
                      A-0142
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--success)]/12 px-3 py-1 text-xs font-semibold text-[var(--success)]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[var(--success)]" />
                    Ready for Pickup
                  </span>
                </div>

                <div className="mt-4 space-y-2.5 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--text)] font-medium">
                      2 × Masala Dosa
                    </span>
                    <span className="font-semibold text-[var(--text)]">₹80</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--text)] font-medium">
                      1 × Filter Coffee
                    </span>
                    <span className="font-semibold text-[var(--text)]">₹15</span>
                  </div>
                  <div className="border-t border-dashed border-[var(--border)] pt-2.5 flex items-center justify-between font-bold">
                    <span>Paid via UPI</span>
                    <span className="text-[var(--primary)]">₹95</span>
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3.5">
                  <div>
                    <p className="text-xs font-medium text-[var(--text-muted)]">
                      Pickup Window
                    </p>
                    <p className="text-sm font-bold text-[var(--text)]">
                      12:30 PM – 12:40 PM
                    </p>
                    <p className="mt-0.5 text-[11px] font-medium text-[var(--accent)]">
                      Counter 1 · Scan QR to collect
                    </p>
                  </div>
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--primary)]">
                    <QrCode className="h-9 w-9" />
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Features Section */}
        <section
          id="features"
          className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 pb-20 sm:pb-24"
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
            variants={featuresContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-5"
          >
            {FEATURES.map((feature) => {
              const Icon = feature.icon
              return (
                <motion.article
                  key={feature.title}
                  variants={fadeUpItem}
                  className="group relative flex flex-col rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-xs transition-all hover:border-[var(--primary)]/50 hover:shadow-md"
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
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-[var(--border)] bg-[var(--surface)]">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-[var(--text)]">
              MITE Canteen Pre-Order System
            </p>
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">
              Mangalore Institute of Technology &amp; Engineering · Moodabidri
            </p>
          </div>

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
        </div>
      </footer>
    </div>
  )
}
