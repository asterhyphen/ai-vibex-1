'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  History,
  Loader2,
  LogOut,
  Mail,
  Pencil,
  Phone,
  Printer,
  ShieldCheck,
  User,
} from 'lucide-react'
import { toast } from 'sonner'
import { ThemeToggle } from '@/components/auth/ThemeToggle'
import type { UserRole } from '@/lib/types'
import { updateProfileAction } from './actions'

interface ProfileClientProps {
  email: string
  fullName: string | null
  role: UserRole
  phone: string | null
  phoneVerified: boolean
  department: string | null
  createdAt: string | null
}

export function ProfileClient({
  email,
  fullName: initialFullName,
  role,
  phone,
  phoneVerified,
  department: initialDepartment,
}: ProfileClientProps) {
  const [fullName, setFullName] = useState(initialFullName ?? '')
  const [department, setDepartment] = useState(initialDepartment ?? '')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  const displayName = fullName.trim() || email.split('@')[0] || 'MITE Member'
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')

  const isFaculty = role === 'faculty'

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault()
    if (saving) return

    setSaving(true)
    try {
      const result = await updateProfileAction({
        full_name: fullName,
        department,
      })
      if (!result.success) {
        toast.error(result.error || 'Could not update profile')
        return
      }

      setFullName(result.full_name ?? fullName)
      setDepartment(result.department ?? '')
      setEditing(false)
      toast.success('Profile updated')
    } catch {
      toast.error('Unexpected error updating profile')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg)] text-[var(--text)]">
      {/* Top Bar */}
      <header className="border-b border-[var(--border)] bg-[var(--surface)]/85 backdrop-blur-md">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <Link
            href="/home"
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl px-3 text-sm font-semibold text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)] transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Menu</span>
          </Link>

          <div className="flex items-center gap-2">
            <Link
              href="/history"
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-xs font-semibold text-[var(--text)] hover:border-[var(--primary)] hover:bg-[var(--surface-2)] transition-colors"
            >
              <History className="h-3.5 w-3.5 text-[var(--primary)]" />
              <span className="hidden sm:inline">Orders</span>
            </Link>
            <Link
              href="/print"
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-xs font-semibold text-[var(--text)] hover:border-[var(--primary)] hover:bg-[var(--surface-2)] transition-colors"
            >
              <Printer className="h-3.5 w-3.5 text-[var(--accent)]" />
              <span className="hidden sm:inline">Print</span>
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-3xl px-4 sm:px-6 py-8 sm:py-10">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="space-y-6"
        >
          {/* Identity Hero Card */}
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 sm:p-8 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[var(--primary)] text-xl font-bold text-white shadow-sm">
                  {initials || <User className="h-7 w-7" />}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text)] truncate">
                      {displayName}
                    </h1>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-3 py-0.5 text-xs font-bold ${
                        isFaculty
                          ? 'bg-[var(--accent)]/15 text-[var(--accent)] border border-[var(--accent)]/30'
                          : 'bg-[var(--primary-soft)] text-[var(--primary)]'
                      }`}
                    >
                      {isFaculty ? 'Faculty · Priority' : 'Student'}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-[var(--text-muted)] truncate">
                    {email}
                  </p>
                </div>
              </div>

              {!editing && (
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 text-xs font-semibold text-[var(--text)] hover:border-[var(--primary)] transition-colors cursor-pointer"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  <span>Edit Details</span>
                </button>
              )}
            </div>

            {/* Edit Form or Details Grid */}
            {editing ? (
              <form onSubmit={handleSave} className="mt-6 border-t border-[var(--border)] pt-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="profile-full-name"
                      className="block text-xs font-semibold text-[var(--text-muted)]"
                    >
                      Full Name
                    </label>
                    <input
                      id="profile-full-name"
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Your full name"
                      className="mt-1.5 h-12 min-h-[44px] w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3.5 text-sm text-[var(--text)] outline-none focus:border-[var(--primary)] focus:ring-3 focus:ring-[var(--primary)]/15"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="profile-department"
                      className="block text-xs font-semibold text-[var(--text-muted)]"
                    >
                      Department
                    </label>
                    <input
                      id="profile-department"
                      type="text"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      placeholder="e.g. Computer Science & Engg."
                      className="mt-1.5 h-12 min-h-[44px] w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3.5 text-sm text-[var(--text)] outline-none focus:border-[var(--primary)] focus:ring-3 focus:ring-[var(--primary)]/15"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setFullName(initialFullName ?? '')
                      setDepartment(initialDepartment ?? '')
                      setEditing(false)
                    }}
                    className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-[var(--border)] px-4 text-sm font-semibold text-[var(--text-muted)] hover:text-[var(--text)] transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-5 text-sm font-semibold text-white hover:bg-[var(--primary-hover)] disabled:opacity-60 transition-colors cursor-pointer"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Saving…</span>
                      </>
                    ) : (
                      <span>Save Changes</span>
                    )}
                  </button>
                </div>
              </form>
            ) : (
              <dl className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-[var(--border)] pt-6">
                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/60 p-4">
                  <dt className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-muted)]">
                    <User className="h-3.5 w-3.5 text-[var(--primary)]" />
                    <span>Full Name</span>
                  </dt>
                  <dd className="mt-1.5 text-sm font-bold text-[var(--text)]">
                    {displayName}
                  </dd>
                </div>

                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/60 p-4">
                  <dt className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-muted)]">
                    <Mail className="h-3.5 w-3.5 text-[var(--primary)]" />
                    <span>College Email</span>
                  </dt>
                  <dd className="mt-1.5 text-sm font-bold text-[var(--text)] truncate">
                    {email}
                  </dd>
                </div>

                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/60 p-4">
                  <dt className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-muted)]">
                    <Phone className="h-3.5 w-3.5 text-[var(--primary)]" />
                    <span>Verified Phone</span>
                  </dt>
                  <dd className="mt-1.5 flex items-center justify-between gap-2">
                    <span className="text-sm font-bold tabular-nums text-[var(--text)]">
                      {phone ? `+91 ${phone}` : 'Not linked'}
                    </span>
                    {phoneVerified && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--success)]/15 px-2.5 py-0.5 text-[11px] font-bold text-[var(--success)]">
                        <CheckCircle2 className="h-3 w-3" />
                        Verified
                      </span>
                    )}
                  </dd>
                </div>

                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/60 p-4">
                  <dt className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-muted)]">
                    <Building2 className="h-3.5 w-3.5 text-[var(--primary)]" />
                    <span>Department</span>
                  </dt>
                  <dd className="mt-1.5 text-sm font-bold text-[var(--text)]">
                    {department.trim() || 'Not specified'}
                  </dd>
                </div>
              </dl>
            )}
          </section>

          {/* Role & Account Actions Card */}
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)]">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-[var(--text)]">
                  {isFaculty
                    ? 'Faculty Priority Queue Active'
                    : 'Student Account Verified'}
                </p>
                <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                  Role is derived automatically from your @mite.ac.in email address.
                </p>
              </div>
            </div>

            <form action="/api/auth/signout" method="POST">
              <button
                type="submit"
                className="inline-flex h-11 min-h-[44px] w-full sm:w-auto items-center justify-center gap-2 rounded-xl border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-5 text-sm font-semibold text-[var(--danger)] hover:bg-[var(--danger)] hover:text-white transition-colors cursor-pointer"
              >
                <LogOut className="h-4 w-4" />
                <span>Sign out</span>
              </button>
            </form>
          </section>
        </motion.div>
      </main>
    </div>
  )
}
