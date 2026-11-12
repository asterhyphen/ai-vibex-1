'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  flexRender,
  type RowSelectionState,
  type SortingState,
} from '@tanstack/react-table'
import {
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useLegacyTable,
  type LegacyColumnDef,
} from '@tanstack/react-table/legacy'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { formatPaise } from '@/lib/utils/format'

export interface GridColumnOption {
  label: string
  value: string
}

export interface GridColumnDef {
  key: string
  label: string
  type?:
    | 'text'
    | 'number'
    | 'boolean'
    | 'select'
    | 'currency'
    | 'datetime'
    | 'json'
    | 'image'
  editable?: boolean
  creatable?: boolean
  required?: boolean
  defaultValue?: unknown
  options?: GridColumnOption[]
  render?: (value: unknown, row: Record<string, unknown>) => React.ReactNode
}

export interface TableConfig {
  tableName: string
  columns: GridColumnDef[]
  searchable: string[]
  editable: boolean
  creatable?: boolean
  deletable?: boolean
}

interface DataGridProps {
  config: TableConfig
  refreshSignal?: number
  onAddClick?: () => void
  renderRowActions?: (
    row: Record<string, unknown>,
    refresh: () => void
  ) => React.ReactNode
  extraCreateFields?: (
    draft: Record<string, unknown>,
    setDraft: React.Dispatch<React.SetStateAction<Record<string, unknown>>>
  ) => React.ReactNode
}

function escapeCsvCell(val: unknown): string {
  const str =
    val === null || val === undefined
      ? ''
      : typeof val === 'object'
        ? JSON.stringify(val)
        : String(val)
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function formatCellDisplay(col: GridColumnDef, val: unknown): React.ReactNode {
  if (val === null || val === undefined || val === '') {
    return <span className="text-[var(--text-muted)]">—</span>
  }
  if (col.type === 'boolean') {
    return val ? (
      <span className="inline-flex rounded-full bg-[var(--success)]/15 px-2.5 py-0.5 text-xs font-bold text-[var(--success)]">
        Yes
      </span>
    ) : (
      <span className="inline-flex rounded-full bg-[var(--surface-2)] px-2.5 py-0.5 text-xs font-bold text-[var(--text-muted)]">
        No
      </span>
    )
  }
  if (col.type === 'currency') {
    return (
      <span className="font-bold tabular-nums">{formatPaise(Number(val))}</span>
    )
  }
  if (col.type === 'datetime') {
    const d = new Date(String(val))
    return Number.isNaN(d.getTime()) ? (
      String(val)
    ) : (
      <span className="whitespace-nowrap text-xs tabular-nums">
        {d.toLocaleString('en-IN', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })}
      </span>
    )
  }
  if (col.type === 'json') {
    const str = typeof val === 'string' ? val : JSON.stringify(val)
    return (
      <code className="block max-w-[260px] truncate rounded bg-[var(--surface-2)] px-2 py-0.5 text-xs">
        {str}
      </code>
    )
  }
  if (col.type === 'image') {
    return (
      <img
        src={String(val)}
        alt=""
        className="h-9 w-9 rounded-lg border border-[var(--border)] object-cover"
      />
    )
  }
  if (Array.isArray(val)) {
    return val.join(', ')
  }
  return <span className="block max-w-[240px] truncate">{String(val)}</span>
}

export function DataGrid({
  config,
  refreshSignal = 0,
  onAddClick,
  renderRowActions,
  extraCreateFields,
}: DataGridProps) {
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [sorting, setSorting] = useState<SortingState>([])
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [pageSize, setPageSize] = useState(10)
  const [pageIndex, setPageIndex] = useState(0)

  // Inline editing state
  const [editingCell, setEditingCell] = useState<{
    rowId: string
    key: string
  } | null>(null)
  const [editValue, setEditValue] = useState<string>('')
  const [savingCell, setSavingCell] = useState(false)

  // Add Modal state
  const [addOpen, setAddOpen] = useState(false)
  const [addDraft, setAddDraft] = useState<Record<string, unknown>>({})
  const [creating, setCreating] = useState(false)

  // Confirm Delete Dialog state
  const [confirmDeleteIds, setConfirmDeleteIds] = useState<string[] | null>(null)
  const [deleting, setDeleting] = useState(false)

  const canCreate = config.creatable ?? config.editable
  const canDelete = config.deletable ?? config.editable

  const fetchRows = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/${config.tableName}?pageSize=300`, {
        cache: 'no-store',
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || `Failed to load ${config.tableName}`)
        return
      }
      setRows(data.rows ?? [])
      setRowSelection({})
    } catch {
      toast.error(`Network error loading ${config.tableName}`)
    } finally {
      setLoading(false)
    }
  }, [config.tableName])

  useEffect(() => {
    let cancelled = false
    fetch(`/api/admin/${config.tableName}?pageSize=300`, { cache: 'no-store' })
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (cancelled) return
        if (!ok) {
          toast.error(data.error || `Failed to load ${config.tableName}`)
          return
        }
        setRows(data.rows ?? [])
        setRowSelection({})
      })
      .catch(() => {
        if (!cancelled) toast.error(`Network error loading ${config.tableName}`)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [config.tableName, refreshSignal])

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return rows
    const keys =
      config.searchable.length > 0
        ? config.searchable
        : config.columns.map((c) => c.key)
    return rows.filter((row) =>
      keys.some((k) => {
        const val = row[k]
        if (val === null || val === undefined) return false
        const str = typeof val === 'object' ? JSON.stringify(val) : String(val)
        return str.toLowerCase().includes(q)
      })
    )
  }, [rows, searchQuery, config.searchable, config.columns])

  const startInlineEdit = useCallback(
    (rowId: string, col: GridColumnDef, currentVal: unknown) => {
      if (!config.editable || col.editable === false) return
      setEditingCell({ rowId, key: col.key })
      if (col.type === 'json' && typeof currentVal === 'object' && currentVal !== null) {
        setEditValue(JSON.stringify(currentVal))
      } else if (Array.isArray(currentVal)) {
        setEditValue(currentVal.join(', '))
      } else if (currentVal === null || currentVal === undefined) {
        setEditValue('')
      } else {
        setEditValue(String(currentVal))
      }
    },
    [config.editable]
  )

  const saveInlineEdit = useCallback(
    async (overrideValue?: string | boolean) => {
      if (!editingCell) return
      setSavingCell(true)
      const { rowId, key } = editingCell
      const valToSend = overrideValue !== undefined ? overrideValue : editValue

      try {
        const res = await fetch(`/api/admin/${config.tableName}/${rowId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [key]: valToSend }),
        })
        const data = await res.json()
        if (!res.ok) {
          toast.error(data.error || 'Failed to save edit')
          return
        }
        setRows((prev) =>
          prev.map((r) => (String(r.id) === rowId ? data.row : r))
        )
        setEditingCell(null)
        toast.success('Updated')
      } catch {
        toast.error('Network error saving cell')
      } finally {
        setSavingCell(false)
      }
    },
    [config.tableName, editValue, editingCell]
  )

  const handleOpenAddModal = () => {
    if (onAddClick) {
      onAddClick()
      return
    }
    const initial: Record<string, unknown> = {}
    for (const col of config.columns) {
      if (col.defaultValue !== undefined) {
        initial[col.key] = col.defaultValue
      } else if (col.type === 'boolean') {
        initial[col.key] = true
      } else {
        initial[col.key] = ''
      }
    }
    setAddDraft(initial)
    setAddOpen(true)
  }

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    try {
      const res = await fetch(`/api/admin/${config.tableName}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addDraft),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Failed to add row')
        return
      }
      setRows((prev) => [data.row, ...prev])
      setAddOpen(false)
      toast.success('Record added')
    } catch {
      toast.error('Network error adding record')
    } finally {
      setCreating(false)
    }
  }

  const handleConfirmDelete = async () => {
    if (!confirmDeleteIds || confirmDeleteIds.length === 0) return
    setDeleting(true)
    try {
      const url =
        confirmDeleteIds.length === 1
          ? `/api/admin/${config.tableName}/${confirmDeleteIds[0]}`
          : `/api/admin/${config.tableName}`
      const res = await fetch(url, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body:
          confirmDeleteIds.length === 1
            ? undefined
            : JSON.stringify({ ids: confirmDeleteIds }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Delete failed')
        return
      }
      const deletedSet = new Set(confirmDeleteIds)
      setRows((prev) => prev.filter((r) => !deletedSet.has(String(r.id))))
      setRowSelection({})
      setConfirmDeleteIds(null)
      toast.success(`Deleted ${confirmDeleteIds.length} record(s)`)
    } catch {
      toast.error('Network error deleting record(s)')
    } finally {
      setDeleting(false)
    }
  }

  const handleExportCsv = () => {
    const headers = config.columns.map((c) => escapeCsvCell(c.label)).join(',')
    const lines = filteredRows.map((row) =>
      config.columns.map((c) => escapeCsvCell(row[c.key])).join(',')
    )
    const csv = [headers, ...lines].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${config.tableName}-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    toast.success(`Exported ${filteredRows.length} rows to CSV`)
  }

  const columns = useMemo<Array<LegacyColumnDef<Record<string, unknown>, unknown>>>(() => {
    const defs: Array<LegacyColumnDef<Record<string, unknown>, unknown>> = []

    if (canDelete) {
      defs.push({
        id: '_select',
        header: ({ table }) => (
          <input
            type="checkbox"
            aria-label="Select all rows"
            checked={table.getIsAllPageRowsSelected()}
            onChange={table.getToggleAllPageRowsSelectedHandler()}
            className="h-4 w-4 rounded accent-[var(--primary)] cursor-pointer"
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            aria-label="Select row"
            checked={row.getIsSelected()}
            onChange={row.getToggleSelectedHandler()}
            className="h-4 w-4 rounded accent-[var(--primary)] cursor-pointer"
          />
        ),
      })
    }

    for (const col of config.columns) {
      defs.push({
        accessorKey: col.key,
        id: col.key,
        header: col.label,
        cell: ({ row }) => {
          const record = row.original as Record<string, unknown>
          const rowId = String(record.id ?? '')
          const value = record[col.key]
          const isEditing =
            editingCell?.rowId === rowId && editingCell?.key === col.key

          if (isEditing) {
            if (col.type === 'select' && col.options) {
              return (
                <div className="flex items-center gap-1">
                  <select
                    autoFocus
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="min-h-[34px] rounded-lg border border-[var(--primary)] bg-[var(--bg)] px-2 text-xs font-semibold text-[var(--text)] outline-none"
                  >
                    {col.options.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={savingCell}
                    onClick={() => saveInlineEdit()}
                    className="rounded-lg bg-[var(--success)] p-1.5 text-white cursor-pointer"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingCell(null)}
                    className="rounded-lg border border-[var(--border)] p-1.5 text-[var(--text-muted)] cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )
            }

            if (col.type === 'boolean') {
              return (
                <div className="flex items-center gap-1">
                  <select
                    autoFocus
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="min-h-[34px] rounded-lg border border-[var(--primary)] bg-[var(--bg)] px-2 text-xs font-semibold text-[var(--text)] outline-none"
                  >
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                  <button
                    type="button"
                    disabled={savingCell}
                    onClick={() => saveInlineEdit(editValue === 'true')}
                    className="rounded-lg bg-[var(--success)] p-1.5 text-white cursor-pointer"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingCell(null)}
                    className="rounded-lg border border-[var(--border)] p-1.5 text-[var(--text-muted)] cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )
            }

            return (
              <div className="flex items-center gap-1">
                <input
                  autoFocus
                  type={
                    col.type === 'number' || col.type === 'currency'
                      ? 'number'
                      : 'text'
                  }
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveInlineEdit()
                    if (e.key === 'Escape') setEditingCell(null)
                  }}
                  className="min-h-[34px] w-40 rounded-lg border border-[var(--primary)] bg-[var(--bg)] px-2 text-xs font-semibold text-[var(--text)] outline-none"
                />
                <button
                  type="button"
                  disabled={savingCell}
                  onClick={() => saveInlineEdit()}
                  className="rounded-lg bg-[var(--success)] p-1.5 text-white cursor-pointer"
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setEditingCell(null)}
                  className="rounded-lg border border-[var(--border)] p-1.5 text-[var(--text-muted)] cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )
          }

          const cellEditable = config.editable && col.editable !== false
          return (
            <div
              onClick={() => cellEditable && startInlineEdit(rowId, col, value)}
              title={cellEditable ? 'Click to edit' : undefined}
              className={`group flex items-center gap-1.5 ${
                cellEditable
                  ? 'cursor-pointer rounded-lg px-1.5 py-1 hover:bg-[var(--surface-2)]'
                  : ''
              }`}
            >
              {col.render ? col.render(value, record) : formatCellDisplay(col, value)}
              {cellEditable && (
                <Pencil className="h-3 w-3 shrink-0 text-[var(--text-muted)] opacity-0 transition-opacity group-hover:opacity-100" />
              )}
            </div>
          )
        },
      })
    }

    if (canDelete || renderRowActions) {
      defs.push({
        id: '_actions',
        header: 'Actions',
        cell: ({ row }) => {
          const record = row.original as Record<string, unknown>
          const rowId = String(record.id ?? '')
          return (
            <div className="flex items-center gap-1.5">
              {renderRowActions?.(record, fetchRows)}
              {canDelete && (
                <button
                  type="button"
                  onClick={() => setConfirmDeleteIds([rowId])}
                  title="Delete row"
                  aria-label="Delete row"
                  className="rounded-lg border border-[var(--danger)]/30 bg-[var(--danger)]/10 p-1.5 text-[var(--danger)] hover:bg-[var(--danger)] hover:text-white cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )
        },
      })
    }

    return defs
  }, [
    config.columns,
    config.editable,
    canDelete,
    editingCell,
    editValue,
    savingCell,
    renderRowActions,
    fetchRows,
    saveInlineEdit,
    startInlineEdit,
  ])

  const table = useLegacyTable<Record<string, unknown>>({
    data: filteredRows,
    columns,
    getRowId: (row, idx) => String(row.id ?? idx),
    state: {
      sorting,
      rowSelection,
      pagination: { pageIndex, pageSize },
    },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    onPaginationChange: (updater) => {
      const next =
        typeof updater === 'function'
          ? updater({ pageIndex, pageSize })
          : updater
      setPageIndex(next.pageIndex)
      setPageSize(next.pageSize)
    },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  })

  const selectedIds = Object.keys(rowSelection).filter((k) => rowSelection[k])
  const creatableCols = config.columns.filter(
    (c) => c.creatable !== false && (c.editable !== false || c.creatable === true)
  )

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
        <div className="relative min-w-[220px] flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              setPageIndex(0)
            }}
            placeholder={`Search ${config.tableName}...`}
            className="min-h-[44px] w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] pl-10 pr-4 text-sm text-[var(--text)] outline-none focus:border-[var(--primary)]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canDelete && selectedIds.length > 0 && (
            <button
              type="button"
              onClick={() => setConfirmDeleteIds(selectedIds)}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[var(--danger)] px-3.5 text-xs font-semibold text-white cursor-pointer"
            >
              <Trash2 className="h-4 w-4" />
              <span>Delete Selected ({selectedIds.length})</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3.5 text-xs font-bold text-[var(--text)] hover:border-[var(--primary)] cursor-pointer"
          >
            <Download className="h-4 w-4 text-[var(--primary)]" />
            <span>Export CSV</span>
          </button>

          {canCreate && (
            <button
              type="button"
              onClick={handleOpenAddModal}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[var(--primary)] px-4 text-xs font-semibold text-white hover:bg-[var(--primary-hover)] cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Add Row</span>
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr
                  key={headerGroup.id}
                  className="border-b border-[var(--border)] bg-[var(--surface-2)]"
                >
                  {headerGroup.headers.map((header) => {
                    const canSort =
                      header.column.id !== '_select' &&
                      header.column.id !== '_actions'
                    const sorted = header.column.getIsSorted()
                    return (
                      <th
                        key={header.id}
                        onClick={
                          canSort
                            ? header.column.getToggleSortingHandler()
                            : undefined
                        }
                        className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] ${
                          canSort ? 'cursor-pointer select-none hover:text-[var(--text)]' : ''
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                          {canSort && (
                            <span className="text-[var(--text-muted)]">
                              {sorted === 'asc' ? (
                                <ArrowUp className="h-3.5 w-3.5 text-[var(--primary)]" />
                              ) : sorted === 'desc' ? (
                                <ArrowDown className="h-3.5 w-3.5 text-[var(--primary)]" />
                              ) : (
                                <ArrowUpDown className="h-3 w-3 opacity-45" />
                              )}
                            </span>
                          )}
                        </div>
                      </th>
                    )
                  })}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {loading ? (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="py-16 text-center text-[var(--text-muted)]"
                  >
                    <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin text-[var(--primary)]" />
                    <span className="text-xs font-semibold">Loading rows...</span>
                  </td>
                </tr>
              ) : table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="py-14 text-center text-sm font-medium text-[var(--text-muted)]"
                  >
                    No matching records found
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className="transition-colors hover:bg-[var(--surface-2)]/50"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-3 text-[var(--text)]">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] bg-[var(--surface-2)]/50 px-4 py-3 text-xs font-semibold text-[var(--text-muted)]">
          <div className="flex items-center gap-2">
            <span>Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value))
                setPageIndex(0)
              }}
              className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs font-bold text-[var(--text)]"
            >
              {[10, 25, 50].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
            <span>· {filteredRows.length} total</span>
          </div>

          <div className="flex items-center gap-2">
            <span>
              Page {pageIndex + 1} of {Math.max(1, table.getPageCount())}
            </span>
            <button
              type="button"
              disabled={!table.getCanPreviousPage()}
              onClick={() => table.previousPage()}
              aria-label="Previous page"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)] disabled:opacity-40 cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              disabled={!table.getCanNextPage()}
              onClick={() => table.nextPage()}
              aria-label="Next page"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)] disabled:opacity-40 cursor-pointer"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Add Row Modal */}
      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[var(--text)]">
                Add New {config.tableName} Row
              </h2>
              <button
                type="button"
                onClick={() => setAddOpen(false)}
                className="rounded-xl border border-[var(--border)] p-2 text-[var(--text-muted)] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-3.5">
              {creatableCols.map((col) => (
                <div key={col.key}>
                  <label className="mb-1 block text-xs font-bold text-[var(--text-muted)]">
                    {col.label}
                    {col.required ? ' *' : ''}
                  </label>

                  {col.type === 'boolean' ? (
                    <select
                      value={String(Boolean(addDraft[col.key]))}
                      onChange={(e) =>
                        setAddDraft((prev) => ({
                          ...prev,
                          [col.key]: e.target.value === 'true',
                        }))
                      }
                      className="min-h-[44px] w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 text-sm text-[var(--text)]"
                    >
                      <option value="true">Yes</option>
                      <option value="false">No</option>
                    </select>
                  ) : col.type === 'select' && col.options ? (
                    <select
                      required={col.required}
                      value={String(addDraft[col.key] ?? '')}
                      onChange={(e) =>
                        setAddDraft((prev) => ({ ...prev, [col.key]: e.target.value }))
                      }
                      className="min-h-[44px] w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 text-sm text-[var(--text)]"
                    >
                      <option value="">Select...</option>
                      {col.options.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  ) : col.type === 'json' ? (
                    <textarea
                      rows={3}
                      required={col.required}
                      value={String(addDraft[col.key] ?? '{}')}
                      onChange={(e) =>
                        setAddDraft((prev) => ({ ...prev, [col.key]: e.target.value }))
                      }
                      className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3 font-mono text-xs text-[var(--text)]"
                    />
                  ) : (
                    <input
                      type={
                        col.type === 'number' || col.type === 'currency'
                          ? 'number'
                          : 'text'
                      }
                      required={col.required}
                      value={String(addDraft[col.key] ?? '')}
                      onChange={(e) =>
                        setAddDraft((prev) => ({ ...prev, [col.key]: e.target.value }))
                      }
                      className="min-h-[44px] w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3.5 text-sm text-[var(--text)]"
                    />
                  )}
                </div>
              ))}

              {extraCreateFields?.(addDraft, setAddDraft)}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setAddOpen(false)}
                  className="min-h-[46px] flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-sm font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex min-h-[46px] flex-1 items-center justify-center rounded-xl bg-[var(--primary)] text-sm font-semibold text-white cursor-pointer"
                >
                  {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Row'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm Dialog */}
      {confirmDeleteIds && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-[var(--text)]">
              Confirm Delete
            </h3>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              Are you sure you want to delete {confirmDeleteIds.length} record
              {confirmDeleteIds.length === 1 ? '' : 's'} from{' '}
              <span className="font-bold text-[var(--text)]">{config.tableName}</span>?
              This action is recorded in the audit log.
            </p>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmDeleteIds(null)}
                className="min-h-[44px] flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-sm font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleConfirmDelete}
                className="flex min-h-[44px] flex-1 items-center justify-center rounded-xl bg-[var(--danger)] text-sm font-semibold text-white cursor-pointer"
              >
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
