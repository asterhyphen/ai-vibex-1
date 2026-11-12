import Link from 'next/link'

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-[var(--bg)] text-[var(--text)] px-4">
      <span className="font-mono text-8xl font-black text-[var(--primary)]">
        404
      </span>
      <p className="text-xl text-[var(--text-muted)]">Page not found</p>
      <Link
        href="/"
        className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-xl bg-[var(--primary)] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[var(--primary-hover)] transition-colors"
      >
        Go home
      </Link>
    </div>
  )
}
