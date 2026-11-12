'use client'

import { AdminShell } from '@/components/admin/AdminShell'
import { DataGrid, type TableConfig } from '@/components/admin/DataGrid'

const AUDIT_LOG_CONFIG: TableConfig = {
  tableName: 'audit_log',
  searchable: ['action', 'table_name', 'actor_id', 'row_id'],
  editable: false,
  creatable: false,
  deletable: false,
  columns: [
    { key: 'action', label: 'Action', editable: false },
    { key: 'table_name', label: 'Table', editable: false },
    { key: 'row_id', label: 'Row ID', editable: false },
    { key: 'actor_id', label: 'Actor ID', editable: false },
    { key: 'diff', label: 'Diff / Details', type: 'json', editable: false },
    { key: 'created_at', label: 'Timestamp', type: 'datetime', editable: false },
  ],
}

export default function AdminAuditLogPage() {
  return (
    <AdminShell
      title="Immutable Audit Log"
      subtitle="Every staff status transition and admin write recorded chronologically"
    >
      <DataGrid config={AUDIT_LOG_CONFIG} />
    </AdminShell>
  )
}
