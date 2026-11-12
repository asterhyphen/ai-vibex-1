'use client'

import { useState } from 'react'
import { KeyRound, Loader2, UserPlus, X } from 'lucide-react'
import { toast } from 'sonner'
import { AdminShell } from '@/components/admin/AdminShell'
import { DataGrid, type TableConfig } from '@/components/admin/DataGrid'

const SHOPKEEPERS_CONFIG: TableConfig = {
  tableName: 'staff_accounts',
  searchable: ['display_name', 'counter', 'user_id'],
  editable: true,
  creatable: true,
  deletable: true,
  columns: [
    { key: 'display_name', label: 'Display Name', editable: true },
    {
      key: 'counter',
      label: 'Counter',
      type: 'select',
      editable: true,
      options: [
        { label: 'canteen', value: 'canteen' },
        { label: 'print', value: 'print' },
      ],
    },
    { key: 'active', label: 'Active', type: 'boolean', editable: true },
    { key: 'last_login_at', label: 'Last Login', type: 'datetime', editable: false },
    { key: 'user_id', label: 'Auth User ID', editable: false },
  ],
}

export default function AdminShopkeepersPage() {
  const [refreshSignal, setRefreshSignal] = useState(0)
  const [createOpen, setCreateOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [counter, setCounter] = useState<'canteen' | 'print'>('canteen')
  const [creating, setCreating] = useState(false)

  const [resetTarget, setResetTarget] = useState<{
    userId: string
    name: string
  } | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [resetting, setResetting] = useState(false)

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    try {
      const res = await fetch('/api/admin/shopkeepers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          display_name: displayName,
          counter,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Could not create shopkeeper')
        return
      }
      toast.success(`Shopkeeper "${displayName}" created!`)
      setCreateOpen(false)
      setEmail('')
      setPassword('')
      setDisplayName('')
      setRefreshSignal((s) => s + 1)
    } catch {
      toast.error('Network error creating shopkeeper')
    } finally {
      setCreating(false)
    }
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!resetTarget) return
    setResetting(true)
    try {
      const res = await fetch('/api/admin/shopkeepers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: resetTarget.userId,
          password: newPassword,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Password reset failed')
        return
      }
      toast.success(`Password updated for ${resetTarget.name}`)
      setResetTarget(null)
      setNewPassword('')
    } catch {
      toast.error('Network error resetting password')
    } finally {
      setResetting(false)
    }
  }

  return (
    <AdminShell
      title="Shopkeepers & Counters"
      subtitle="Create canteen/print staff logins, toggle active counters, or reset passwords"
      actions={
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="inline-flex min-h-[42px] items-center gap-2 rounded-xl bg-[var(--primary)] px-4 text-xs font-extrabold text-white hover:bg-[var(--primary-hover)] cursor-pointer"
        >
          <UserPlus className="h-4 w-4" />
          <span>Create Shopkeeper</span>
        </button>
      }
    >
      <DataGrid
        config={SHOPKEEPERS_CONFIG}
        refreshSignal={refreshSignal}
        onAddClick={() => setCreateOpen(true)}
        renderRowActions={(row) => (
          <button
            type="button"
            onClick={() =>
              setResetTarget({
                userId: String(row.user_id ?? ''),
                name: String(row.display_name ?? 'Staff'),
              })
            }
            className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1.5 text-xs font-bold text-[var(--text)] hover:border-[var(--primary)] cursor-pointer"
          >
            <KeyRound className="h-3.5 w-3.5 text-[var(--accent)]" />
            <span>Reset PW</span>
          </button>
        )}
      />

      {/* Create Shopkeeper Modal */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-extrabold text-[var(--text)]">
                Create Shopkeeper Account
              </h2>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="rounded-xl border border-[var(--border)] p-2 text-[var(--text-muted)] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-3.5">
              <div>
                <label className="mb-1 block text-xs font-bold text-[var(--text-muted)]">
                  Display Name
                </label>
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Main Canteen Counter"
                  className="min-h-[44px] w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3.5 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-[var(--text-muted)]">
                  Staff Email (@mite.ac.in)
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="canteen2@mite.ac.in"
                  className="min-h-[44px] w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3.5 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-[var(--text-muted)]">
                  Initial Password (min 8 chars)
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="min-h-[44px] w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3.5 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-[var(--text-muted)]">
                  Counter Assignment
                </label>
                <select
                  value={counter}
                  onChange={(e) =>
                    setCounter(e.target.value as 'canteen' | 'print')
                  }
                  className="min-h-[44px] w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 text-sm"
                >
                  <option value="canteen">Canteen Kitchen</option>
                  <option value="print">Print Counter</option>
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setCreateOpen(false)}
                  className="min-h-[46px] flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-sm font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex min-h-[46px] flex-1 items-center justify-center rounded-xl bg-[var(--primary)] text-sm font-extrabold text-white cursor-pointer"
                >
                  {creating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Create Account'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resetTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-extrabold text-[var(--text)]">
                Reset Password · {resetTarget.name}
              </h2>
              <button
                type="button"
                onClick={() => setResetTarget(null)}
                className="rounded-xl border border-[var(--border)] p-2 text-[var(--text-muted)] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-bold text-[var(--text-muted)]">
                  New Password (min 8 characters)
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="min-h-[44px] w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3.5 text-sm"
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setResetTarget(null)}
                  className="min-h-[44px] flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-sm font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resetting}
                  className="flex min-h-[44px] flex-1 items-center justify-center rounded-xl bg-[var(--primary)] text-sm font-extrabold text-white cursor-pointer"
                >
                  {resetting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Update Password'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminShell>
  )
}
