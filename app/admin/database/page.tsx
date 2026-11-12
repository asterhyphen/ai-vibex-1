'use client'

import { useMemo, useState } from 'react'
import { AdminShell } from '@/components/admin/AdminShell'
import { DataGrid, type TableConfig } from '@/components/admin/DataGrid'
import { DangerZonePanel } from '@/components/admin/DangerZonePanel'
import { ADMIN_TABLE_WHITELIST, READ_ONLY_ADMIN_TABLES, type AdminTableName } from '@/lib/validators/admin'

const TABLE_PRESETS: Record<AdminTableName, Omit<TableConfig, 'tableName'>> = {
  orders: {
    searchable: ['code', 'guest_name', 'status', 'source'],
    editable: true,
    creatable: false,
    columns: [
      { key: 'code', label: 'Code', editable: false },
      { key: 'status', label: 'Status', editable: true },
      { key: 'payment_method', label: 'Method', editable: true },
      { key: 'payment_status', label: 'Pay Status', editable: true },
      { key: 'total_paise', label: 'Total', type: 'currency', editable: false },
      { key: 'source', label: 'Source', editable: false },
      { key: 'no_show', label: 'No Show', type: 'boolean', editable: true },
      { key: 'created_at', label: 'Created', type: 'datetime', editable: false },
    ],
  },
  order_items: {
    searchable: ['name_snapshot', 'order_id'],
    editable: true,
    creatable: false,
    columns: [
      { key: 'order_id', label: 'Order ID', editable: false },
      { key: 'name_snapshot', label: 'Item Name', editable: true },
      { key: 'qty', label: 'Qty', type: 'number', editable: true },
      { key: 'unit_price_paise', label: 'Unit Price', type: 'currency', editable: false },
      { key: 'created_at', label: 'Created', type: 'datetime', editable: false },
    ],
  },
  print_jobs: {
    searchable: ['original_name', 'guest_name', 'status'],
    editable: true,
    creatable: false,
    columns: [
      { key: 'original_name', label: 'Filename', editable: false },
      { key: 'pages', label: 'Pages', type: 'number', editable: false },
      { key: 'copies', label: 'Copies', type: 'number', editable: false },
      { key: 'paper', label: 'Paper', editable: false },
      { key: 'cost_paise', label: 'Cost', type: 'currency', editable: false },
      { key: 'status', label: 'Status', editable: true },
      { key: 'created_at', label: 'Created', type: 'datetime', editable: false },
    ],
  },
  menu_items: {
    searchable: ['name', 'description'],
    editable: true,
    columns: [
      { key: 'name', label: 'Name', editable: true, required: true },
      { key: 'category_id', label: 'Category ID', editable: true, required: true },
      { key: 'price_paise', label: 'Price', type: 'currency', editable: true, required: true },
      { key: 'prep_seconds', label: 'Prep (s)', type: 'number', editable: true },
      { key: 'in_stock', label: 'In Stock', type: 'boolean', editable: true },
      { key: 'is_active', label: 'Active', type: 'boolean', editable: true },
    ],
  },
  categories: {
    searchable: ['name', 'icon'],
    editable: true,
    columns: [
      { key: 'icon', label: 'Icon', editable: true },
      { key: 'name', label: 'Name', editable: true, required: true },
      { key: 'sort_order', label: 'Sort', type: 'number', editable: true },
    ],
  },
  pickup_slots: {
    searchable: ['slot_start'],
    editable: true,
    creatable: false,
    columns: [
      { key: 'slot_start', label: 'Start', type: 'datetime', editable: false },
      { key: 'slot_end', label: 'End', type: 'datetime', editable: false },
      { key: 'capacity_units', label: 'Capacity', type: 'number', editable: true },
      { key: 'used_units', label: 'Used', type: 'number', editable: true },
    ],
  },
  profiles: {
    searchable: ['full_name', 'role', 'phone', 'department'],
    editable: true,
    creatable: false,
    deletable: false,
    columns: [
      { key: 'full_name', label: 'Full Name', editable: true },
      { key: 'role', label: 'Role', editable: true },
      { key: 'phone', label: 'Phone', editable: true },
      { key: 'phone_verified', label: 'Verified', type: 'boolean', editable: true },
      { key: 'is_blocked', label: 'Blocked', type: 'boolean', editable: true },
    ],
  },
  staff_accounts: {
    searchable: ['display_name', 'counter'],
    editable: true,
    creatable: false,
    columns: [
      { key: 'display_name', label: 'Display Name', editable: true },
      { key: 'counter', label: 'Counter', editable: true },
      { key: 'active', label: 'Active', type: 'boolean', editable: true },
      { key: 'last_login_at', label: 'Last Login', type: 'datetime', editable: false },
    ],
  },
  settings: {
    searchable: ['key'],
    editable: true,
    columns: [
      { key: 'key', label: 'Key', editable: true, required: true },
      { key: 'value', label: 'Value (JSON)', type: 'json', editable: true, required: true },
      { key: 'updated_at', label: 'Updated', type: 'datetime', editable: false },
    ],
  },
  notifications: {
    searchable: ['title', 'body', 'kind'],
    editable: true,
    creatable: false,
    columns: [
      { key: 'user_id', label: 'User ID', editable: false },
      { key: 'title', label: 'Title', editable: true },
      { key: 'body', label: 'Body', editable: true },
      { key: 'kind', label: 'Kind', editable: false },
      { key: 'read', label: 'Read', type: 'boolean', editable: true },
      { key: 'created_at', label: 'Created', type: 'datetime', editable: false },
    ],
  },
  sms_log: {
    searchable: ['phone', 'body', 'kind'],
    editable: false,
    creatable: false,
    deletable: false,
    columns: [
      { key: 'phone', label: 'Phone', editable: false },
      { key: 'kind', label: 'Kind', editable: false },
      { key: 'body', label: 'Body', editable: false },
      { key: 'created_at', label: 'Sent At', type: 'datetime', editable: false },
    ],
  },
  audit_log: {
    searchable: ['action', 'table_name', 'actor_id'],
    editable: false,
    creatable: false,
    deletable: false,
    columns: [
      { key: 'action', label: 'Action', editable: false },
      { key: 'table_name', label: 'Table', editable: false },
      { key: 'row_id', label: 'Row ID', editable: false },
      { key: 'diff', label: 'Diff', type: 'json', editable: false },
      { key: 'created_at', label: 'Timestamp', type: 'datetime', editable: false },
    ],
  },
  login_attempts: {
    searchable: ['email'],
    editable: true,
    creatable: false,
    columns: [
      { key: 'email', label: 'Email', editable: false },
      { key: 'attempts', label: 'Attempts', type: 'number', editable: true },
      { key: 'locked_until', label: 'Locked Until', type: 'datetime', editable: false },
      { key: 'updated_at', label: 'Updated', type: 'datetime', editable: false },
    ],
  },
}

export default function AdminDatabasePage() {
  const [activeTable, setActiveTable] = useState<AdminTableName>('orders')
  const [refreshSignal, setRefreshSignal] = useState(0)

  const config = useMemo<TableConfig>(
    () => ({
      tableName: activeTable,
      ...TABLE_PRESETS[activeTable],
    }),
    [activeTable]
  )

  return (
    <AdminShell
      title="Database Explorer & Maintenance"
      subtitle="Browse and edit any whitelisted Supabase table or run Danger Zone resets"
    >
      <div className="space-y-6">
        {/* Table selector pills */}
        <div className="flex flex-wrap gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-sm">
          {ADMIN_TABLE_WHITELIST.map((tbl) => {
            const active = tbl === activeTable
            const ro = READ_ONLY_ADMIN_TABLES.has(tbl)
            return (
              <button
                key={tbl}
                type="button"
                onClick={() => setActiveTable(tbl)}
                className={`min-h-[40px] rounded-xl px-3.5 text-xs font-semibold transition-colors cursor-pointer ${
                  active
                    ? 'bg-[var(--primary)] text-white shadow-xs'
                    : 'border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] hover:border-[var(--primary)]'
                }`}
              >
                {tbl}
                {ro ? ' (RO)' : ''}
              </button>
            )
          })}
        </div>

        <DataGrid
          key={activeTable}
          config={config}
          refreshSignal={refreshSignal}
        />

        <DangerZonePanel onComplete={() => setRefreshSignal((s) => s + 1)} />
      </div>
    </AdminShell>
  )
}
