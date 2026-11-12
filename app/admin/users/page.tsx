'use client'

import { useState } from 'react'
import { Loader2, ShieldBan, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { AdminShell } from '@/components/admin/AdminShell'
import { DataGrid, type TableConfig } from '@/components/admin/DataGrid'

const USERS_CONFIG: TableConfig = {
  tableName: 'profiles',
  searchable: ['full_name', 'role', 'phone', 'department'],
  editable: true,
  creatable: false,
  deletable: false,
  columns: [
    { key: 'full_name', label: 'Full Name', editable: true },
    {
      key: 'role',
      label: 'Role',
      type: 'select',
      editable: true,
      options: [
        { label: 'student', value: 'student' },
        { label: 'faculty', value: 'faculty' },
        { label: 'shopkeeper', value: 'shopkeeper' },
        { label: 'admin', value: 'admin' },
      ],
    },
    { key: 'phone', label: 'Phone', editable: true },
    { key: 'phone_verified', label: 'Verified', type: 'boolean', editable: true },
    { key: 'department', label: 'Department', editable: true },
    { key: 'is_blocked', label: 'Blocked', type: 'boolean', editable: true },
    { key: 'created_at', label: 'Joined', type: 'datetime', editable: false },
  ],
}

export default function AdminUsersPage() {
  const [busyId, setBusyId] = useState<string | null>(null)
  const [refreshSignal, setRefreshSignal] = useState(0)

  const handleToggleBlock = async (
    id: string,
    currentlyBlocked: boolean,
    refresh: () => void
  ) => {
    setBusyId(id)
    try {
      const res = await fetch(`/api/admin/profiles/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_blocked: !currentlyBlocked }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Failed to update block status')
        return
      }
      toast.success(
        !currentlyBlocked ? 'User blocked' : 'User unblocked'
      )
      refresh()
      setRefreshSignal((s) => s + 1)
    } catch {
      toast.error('Network error updating user')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <AdminShell
      title="Users & Roles"
      subtitle="Manage student, faculty, and staff profiles or block abusive accounts"
    >
      <DataGrid
        config={USERS_CONFIG}
        refreshSignal={refreshSignal}
        renderRowActions={(row, refresh) => {
          const id = String(row.id ?? '')
          const blocked = Boolean(row.is_blocked)
          const busy = busyId === id
          return (
            <button
              type="button"
              disabled={busy}
              onClick={() => handleToggleBlock(id, blocked, refresh)}
              className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-bold cursor-pointer ${
                blocked
                  ? 'border-[var(--success)]/40 bg-[var(--success)]/12 text-[var(--success)] hover:bg-[var(--success)] hover:text-white'
                  : 'border-[var(--danger)]/40 bg-[var(--danger)]/10 text-[var(--danger)] hover:bg-[var(--danger)] hover:text-white'
              }`}
            >
              {busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : blocked ? (
                <ShieldCheck className="h-3.5 w-3.5" />
              ) : (
                <ShieldBan className="h-3.5 w-3.5" />
              )}
              <span>{blocked ? 'Unblock' : 'Block'}</span>
            </button>
          )
        }}
      />
    </AdminShell>
  )
}
