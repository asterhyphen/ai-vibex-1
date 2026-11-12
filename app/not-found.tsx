export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-[var(--bg)] text-[var(--text)]">
      <span className="text-8xl font-black text-[var(--primary)]">404</span>
      <p className="text-xl text-[var(--text-muted)]">Page not found</p>
      <a href="/" className="mt-4 px-6 py-2 rounded-lg bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] transition-colors">
        Go home
      </a>
    </div>
  )
}
