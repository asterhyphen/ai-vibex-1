'use client'

import { AdminShell } from '@/components/admin/AdminShell'
import { DataGrid, type TableConfig } from '@/components/admin/DataGrid'

const PRINT_JOBS_CONFIG: TableConfig = {
  tableName: 'print_jobs',
  searchable: ['original_name', 'guest_name', 'status', 'paper'],
  editable: true,
  creatable: false,
  deletable: true,
  columns: [
    { key: 'original_name', label: 'Filename', editable: false },
    { key: 'guest_name', label: 'Customer', editable: false },
    { key: 'pages', label: 'Pages', type: 'number', editable: false },
    { key: 'color', label: 'Colour', type: 'boolean', editable: false },
    { key: 'double_sided', label: '2-Sided', type: 'boolean', editable: false },
    { key: 'copies', label: 'Copies', type: 'number', editable: false },
    { key: 'paper', label: 'Paper', editable: false },
    { key: 'cost_paise', label: 'Cost', type: 'currency', editable: false },
    {
      key: 'status',
      label: 'Status',
      type: 'select',
      editable: true,
      options: [
        { label: 'uploaded', value: 'uploaded' },
        { label: 'paid', value: 'paid' },
        { label: 'printing', value: 'printing' },
        { label: 'ready', value: 'ready' },
        { label: 'collected', value: 'collected' },
        { label: 'rejected', value: 'rejected' },
      ],
    },
    { key: 'sanitised', label: 'Cleaned', type: 'boolean', editable: false },
    { key: 'created_at', label: 'Submitted', type: 'datetime', editable: false },
  ],
}

export default function AdminPrintJobsPage() {
  return (
    <AdminShell
      title="Print Jobs"
      subtitle="Monitor sanitised PDF uploads, pricing, and counter fulfilment"
    >
      <DataGrid config={PRINT_JOBS_CONFIG} />
    </AdminShell>
  )
}
