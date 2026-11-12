'use client'

import { AdminShell } from '@/components/admin/AdminShell'
import { DataGrid, type TableConfig } from '@/components/admin/DataGrid'

const SMS_LOG_CONFIG: TableConfig = {
  tableName: 'sms_log',
  searchable: ['phone', 'body', 'kind'],
  editable: false,
  creatable: false,
  deletable: false,
  columns: [
    { key: 'phone', label: 'Recipient Phone', editable: false },
    { key: 'kind', label: 'Type', editable: false },
    { key: 'body', label: 'Message Body', editable: false },
    { key: 'created_at', label: 'Sent At', type: 'datetime', editable: false },
  ],
}

export default function AdminSmsLogPage() {
  return (
    <AdminShell
      title="Outbound SMS Log"
      subtitle="Read-only audit trail of simulated customer SMS alerts"
    >
      <DataGrid config={SMS_LOG_CONFIG} />
    </AdminShell>
  )
}
