'use client'

import { AdminShell } from '@/components/admin/AdminShell'
import { DataGrid, type TableConfig } from '@/components/admin/DataGrid'

const CATEGORIES_CONFIG: TableConfig = {
  tableName: 'categories',
  searchable: ['name', 'icon'],
  editable: true,
  creatable: true,
  deletable: true,
  columns: [
    { key: 'icon', label: 'Icon', editable: true, defaultValue: '🍽️' },
    { key: 'name', label: 'Category Name', editable: true, required: true },
    {
      key: 'sort_order',
      label: 'Sort Order',
      type: 'number',
      editable: true,
      defaultValue: 0,
    },
    { key: 'created_at', label: 'Created', type: 'datetime', editable: false },
  ],
}

export default function AdminCategoriesPage() {
  return (
    <AdminShell
      title="Menu Categories"
      subtitle="Manage canteen display categories and sort ordering"
    >
      <DataGrid config={CATEGORIES_CONFIG} />
    </AdminShell>
  )
}
