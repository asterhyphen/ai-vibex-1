'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ImagePlus, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import type { Category } from '@/lib/types'
import { AdminShell } from '@/components/admin/AdminShell'
import { DataGrid, type TableConfig } from '@/components/admin/DataGrid'

export default function AdminMenuPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [refreshSignal, setRefreshSignal] = useState(0)
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const [uploadingDraft, setUploadingDraft] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const targetRowIdRef = useRef<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/categories?pageSize=100')
      .then((r) => r.json())
      .then((d) => setCategories(d.rows ?? []))
      .catch(() => {})
  }, [])

  const menuConfig = useMemo<TableConfig>(
    () => ({
      tableName: 'menu_items',
      searchable: ['name', 'description', 'tags'],
      editable: true,
      creatable: true,
      deletable: true,
      columns: [
        { key: 'image_url', label: 'Image', type: 'image', editable: true },
        { key: 'name', label: 'Name', editable: true, required: true },
        {
          key: 'category_id',
          label: 'Category',
          type: 'select',
          editable: true,
          required: true,
          options: categories.map((c) => ({
            label: `${c.icon ? `${c.icon} ` : ''}${c.name}`,
            value: c.id,
          })),
          render: (val) => {
            const cat = categories.find((c) => c.id === val)
            return cat ? `${cat.icon ? `${cat.icon} ` : ''}${cat.name}` : String(val ?? '—')
          },
        },
        {
          key: 'price_paise',
          label: 'Price (paise)',
          type: 'currency',
          editable: true,
          required: true,
          defaultValue: 3000,
        },
        {
          key: 'prep_seconds',
          label: 'Prep (s)',
          type: 'number',
          editable: true,
          defaultValue: 300,
        },
        {
          key: 'in_stock',
          label: 'In Stock',
          type: 'boolean',
          editable: true,
          defaultValue: true,
        },
        {
          key: 'is_active',
          label: 'Active',
          type: 'boolean',
          editable: true,
          defaultValue: true,
        },
        { key: 'description', label: 'Description', editable: true },
      ],
    }),
    [categories]
  )

  const handleRowImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    const rowId = targetRowIdRef.current
    e.target.value = ''
    if (!file || !rowId) return

    setUploadingId(rowId)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const upRes = await fetch('/api/admin/menu/upload', {
        method: 'POST',
        body: formData,
      })
      const upData = await upRes.json()
      if (!upRes.ok || !upData.image_url) {
        toast.error(upData.error || 'Image upload failed')
        return
      }

      const patchRes = await fetch(`/api/admin/menu_items/${rowId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_url: upData.image_url }),
      })
      if (!patchRes.ok) {
        toast.error('Failed to attach uploaded image URL')
        return
      }
      toast.success('Menu item image updated')
      setRefreshSignal((s) => s + 1)
    } catch {
      toast.error('Network error uploading image')
    } finally {
      setUploadingId(null)
      targetRowIdRef.current = null
    }
  }

  return (
    <AdminShell
      title="Menu Catalogue"
      subtitle="Edit prices (paise), toggle availability, add dishes, and upload item photos"
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleRowImageFile}
      />

      <DataGrid
        config={menuConfig}
        refreshSignal={refreshSignal}
        renderRowActions={(row) => {
          const id = String(row.id ?? '')
          const busy = uploadingId === id
          return (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                targetRowIdRef.current = id
                fileInputRef.current?.click()
              }}
              title="Upload image"
              aria-label="Upload menu item image"
              className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1.5 text-xs font-bold text-[var(--text)] hover:border-[var(--primary)] cursor-pointer"
            >
              {busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ImagePlus className="h-3.5 w-3.5 text-[var(--primary)]" />
              )}
              <span className="hidden xl:inline">Photo</span>
            </button>
          )
        }}
        extraCreateFields={(_draft, setDraft) => (
          <div>
            <label className="mb-1 block text-xs font-bold text-[var(--text-muted)]">
              Upload Item Photo (optional)
            </label>
            <input
              type="file"
              accept="image/*"
              disabled={uploadingDraft}
              onChange={async (e) => {
                const f = e.target.files?.[0]
                if (!f) return
                setUploadingDraft(true)
                try {
                  const fd = new FormData()
                  fd.append('file', f)
                  const r = await fetch('/api/admin/menu/upload', {
                    method: 'POST',
                    body: fd,
                  })
                  const d = await r.json()
                  if (r.ok && d.image_url) {
                    setDraft((prev) => ({ ...prev, image_url: d.image_url }))
                    toast.success('Photo uploaded to Storage')
                  } else {
                    toast.error(d.error || 'Upload failed')
                  }
                } finally {
                  setUploadingDraft(false)
                }
              }}
              className="block w-full text-xs text-[var(--text-muted)] file:mr-3 file:rounded-xl file:border-0 file:bg-[var(--primary-soft)] file:px-3 file:py-2 file:text-xs file:font-bold file:text-[var(--primary)]"
            />
          </div>
        )}
      />
    </AdminShell>
  )
}
