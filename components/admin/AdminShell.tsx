'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  ChefHat,
  Clock,
  Database,
  FileText,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Printer,
  Settings,
  ShieldAlert,
  ShoppingBag,
  UserCog,
  Users,
  UtensilsCrossed,
  X,
} from 'lucide-react'
import { ThemeToggle } from '@/components/auth/ThemeToggle'

const NAV_ITEMS = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/orders', label: 'Orders', icon: ShoppingBag },
  { href: '/admin/print-jobs', label: 'Print Jobs', icon: Printer },
  { href: '/admin/menu', label: 'Menu', icon: UtensilsCrossed },
  { href: '/admin/categories', label: 'Categories', icon: FolderKanban },
  { href: '/admin/slots', label: 'Slots', icon: Clock },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/shopkeepers', label: 'Shopkeepers', icon: UserCog },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
  { href: '/admin/sms-log', label: 'SMS Log', icon: MessageSquare },
  { href: '/admin/audit', label: 'Audit Log', icon: ShieldAlert },
  { href: '/admin/database', label: 'Database', icon: Database },
] as const

interface AdminShellProps {
  title: string
  subtitle?: string
  actions?: React.ReactNode
  children: React.ReactNode
}

export function AdminShell({
  title,
  subtitle,
  actions,
  children,
}: AdminShellProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  const handleSignOut = async () => {
    setSigningOut(true)
    try {
      await fetch('/api/auth/signout', { method: 'POST' })
    } catch {
      // Ignore error
    } finally {
      router.push('/admin/login')
      router.refresh()
    }
  }

  const sidebarContent = (
    <div className="flex h-full flex-col justify-between">
      <div>
        <div className="flex items-center justify-between px-4 py-5 border-b border-[var(--border)]">
          <Link href="/admin" className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--primary)] text-white shadow-sm">
              <FileText className="h-5 w-5" />
            </span>
            <div>
              <div className="text-sm font-black tracking-tight text-[var(--text)]">
                MITE Admin
              </div>
              <div className="text-[11px] font-semibold text-[var(--text-muted)]">
                Control Center
              </div>
            </div>
          </Link>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="lg:hidden rounded-lg p-1.5 text-[var(--text-muted)]"
            aria-label="Close navigation"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="space-y-1 p-3" aria-label="Admin navigation">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            const active =
              item.href === '/admin'
                ? pathname === '/admin'
                : pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`flex min-h-[42px] items-center gap-3 rounded-xl px-3.5 text-sm font-bold transition-colors ${
                  active
                    ? 'bg-[var(--primary)] text-white shadow-sm'
                    : 'text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>
      </div>

      <div className="space-y-2 border-t border-[var(--border)] p-3">
        <Link
          href="/staff"
          className="flex min-h-[42px] items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3.5 text-xs font-bold text-[var(--text)] hover:border-[var(--primary)]"
        >
          <ChefHat className="h-4 w-4 text-[var(--primary)]" />
          <span>Open Kitchen Board</span>
        </Link>
        <button
          type="button"
          disabled={signingOut}
          onClick={handleSignOut}
          className="flex min-h-[42px] w-full items-center gap-3 rounded-xl px-3.5 text-xs font-bold text-[var(--danger)] hover:bg-[var(--danger)]/10 cursor-pointer"
        >
          <LogOut className="h-4 w-4" />
          <span>{signingOut ? 'Signing out...' : 'Sign Out'}</span>
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex min-h-screen bg-[var(--bg)] text-[var(--text)]">
      {/* Desktop Sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-[var(--border)] bg-[var(--surface)] lg:block sticky top-0 h-screen overflow-y-auto">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative z-10 h-full w-68 border-r border-[var(--border)] bg-[var(--surface)] overflow-y-auto">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--surface)]/95 px-4 py-3.5 backdrop-blur-md sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                aria-label="Open menu"
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-2)] lg:hidden"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div>
                <h1 className="text-xl font-black tracking-tight text-[var(--text)] sm:text-2xl">
                  {title}
                </h1>
                {subtitle && (
                  <p className="text-xs font-medium text-[var(--text-muted)]">
                    {subtitle}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              {actions}
              <ThemeToggle />
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  )
}
