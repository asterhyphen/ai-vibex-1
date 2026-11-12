'use client'

export default function ForbiddenPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-[var(--bg)] text-[var(--text)]">
      <div className="relative">
        {/* Lock icon SVG */}
        <svg
          className="w-24 h-24 text-[var(--danger)] animate-bounce"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
          />
        </svg>
      </div>
      <div className="text-center space-y-2">
        <h1 className="text-6xl font-black text-[var(--danger)]">403</h1>
        <p className="text-xl font-semibold">Access Denied</p>
        <p className="text-[var(--text-muted)]">
          You don&apos;t have permission to view this page.
        </p>
      </div>
      <a
        href="/"
        className="px-6 py-2 rounded-lg bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] transition-colors"
      >
        Back to Home
      </a>
    </div>
  )
}
