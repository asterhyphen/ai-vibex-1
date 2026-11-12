'use client'

import { AdminShell } from '@/components/admin/AdminShell'
import { DataGrid, type TableConfig } from '@/components/admin/DataGrid'

const ORDERS_CONFIG: TableConfig = {
  tableName: 'orders',
  searchable: ['code', 'guest_name', 'status', 'payment_method', 'source'],
  editable: true,
  creatable: false,
  deletable: true,
  columns: [
    { key: 'code', label: 'Code', editable: false },
    { key: 'source', label: 'Source', editable: false },
    { key: 'guest_name', label: 'Guest', editable: true },
    {
      key: 'status',
      label: 'Status',
      type: 'select',
      editable: true,
      options: [
        { label: 'placed', value: 'placed' },
        { label: 'awaiting_cash', value: 'awaiting_cash' },
        { label: 'accepted', value: 'accepted' },
        { label: 'preparing', value: 'preparing' },
        { label: 'ready', value: 'ready' },
        { label: 'collected', value: 'collected' },
        { label: 'cancelled', value: 'cancelled' },
        { label: 'rejected', value: 'rejected' },
      ],
    },
    {
      key: 'payment_method',
      label: 'Method',
      type: 'select',
      editable: true,
      options: [
        { label: 'online', value: 'online' },
        { label: 'cash', value: 'cash' },
      ],
    },
    {
      key: 'payment_status',
      label: 'Payment',
      type: 'select',
      editable: true,
      options: [
        { label: 'pending', value: 'pending' },
        { label: 'paid', value: 'paid' },
        { label: 'refunded', value: 'refunded' },
      ],
    },
    { key: 'total_paise', label: 'Total', type: 'currency', editable: false },
    { key: 'is_faculty', label: 'Faculty', type: 'boolean', editable: false },
    { key: 'created_at', label: 'Placed At', type: 'datetime', editable: false },
  ],
}

export default function AdminOrdersPage() {
  return (
    <AdminShell
      title="Orders Management"
      subtitle="Inspect, filter, export, or override order lifecycle statuses"
    >
      <DataGrid config={ORDERS_CONFIG} />
    </AdminShell>
  )
}
