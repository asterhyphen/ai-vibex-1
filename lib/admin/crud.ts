import { NextResponse } from 'next/server'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { writeAuditLog } from '@/lib/utils/server-auth'
import {
  isAllowedAdminTable,
  READ_ONLY_ADMIN_TABLES,
  type AdminTableName,
} from '@/lib/validators/admin'

const ORDER_BY_DEFAULTS: Record<AdminTableName, { col: string; ascending: boolean }> = {
  orders: { col: 'created_at', ascending: false },
  print_jobs: { col: 'created_at', ascending: false },
  menu_items: { col: 'name', ascending: true },
  categories: { col: 'sort_order', ascending: true },
  pickup_slots: { col: 'slot_start', ascending: true },
  profiles: { col: 'created_at', ascending: false },
  staff_accounts: { col: 'created_at', ascending: false },
  settings: { col: 'key', ascending: true },
  sms_log: { col: 'created_at', ascending: false },
  audit_log: { col: 'created_at', ascending: false },
  login_attempts: { col: 'updated_at', ascending: false },
}

const NUMERIC_COLUMNS = new Set([
  'price_paise',
  'prep_seconds',
  'load_weight',
  'sort_order',
  'capacity_units',
  'used_units',
  'total_paise',
  'cash_received_paise',
  'change_given_paise',
  'eta_minutes',
  'priority_score',
  'pages',
  'copies',
  'cost_paise',
  'attempts',
])

const BOOLEAN_COLUMNS = new Set([
  'in_stock',
  'is_active',
  'is_blocked',
  'phone_verified',
  'active',
  'is_faculty',
  'no_show',
  'color',
  'double_sided',
  'sanitised',
])

function sanitizePayload(
  table: AdminTableName,
  raw: Record<string, unknown>
): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(raw)) {
    if (key === 'id' || key === 'created_at' || key === 'updated_at') continue
    if (value === undefined) continue

    if (table === 'settings' && key === 'value' && typeof value === 'string') {
      try {
        cleaned[key] = JSON.parse(value)
      } catch {
        throw new Error('Settings value must be valid JSON')
      }
      continue
    }

    if (table === 'menu_items' && key === 'tags' && typeof value === 'string') {
      cleaned[key] = value
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
      continue
    }

    if (NUMERIC_COLUMNS.has(key) && value !== null && value !== '') {
      const n = Number(value)
      if (!Number.isFinite(n)) {
        throw new Error(`Field "${key}" must be a valid number`)
      }
      cleaned[key] = n
      continue
    }

    if (BOOLEAN_COLUMNS.has(key) && typeof value === 'string') {
      cleaned[key] = value.toLowerCase() === 'true' || value === '1'
      continue
    }

    cleaned[key] = value === '' ? null : value
  }

  return cleaned
}

export function validateTableOrError(rawTable: string): {
  ok: true
  table: AdminTableName
} | {
  ok: false
  response: NextResponse
} {
  if (!isAllowedAdminTable(rawTable)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: `Table "${rawTable}" is not accessible via admin API` },
        { status: 400 }
      ),
    }
  }
  return { ok: true, table: rawTable }
}

export async function adminListRows(
  db: SupabaseClient,
  table: AdminTableName,
  searchParams: URLSearchParams
) {
  const page = Math.max(1, Number.parseInt(searchParams.get('page') || '1', 10) || 1)
  const pageSize = Math.min(
    500,
    Math.max(1, Number.parseInt(searchParams.get('pageSize') || '200', 10) || 200)
  )
  const defaultOrder = ORDER_BY_DEFAULTS[table]
  const sortBy = searchParams.get('sortBy') || defaultOrder.col
  const sortDir = searchParams.get('sortDir')
  const ascending =
    sortDir === 'asc'
      ? true
      : sortDir === 'desc'
        ? false
        : defaultOrder.ascending

  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  const { data, error, count } = await db
    .from(table)
    .select('*', { count: 'exact' })
    .order(sortBy, { ascending })
    .range(from, to)

  if (error) {
    return NextResponse.json(
      { error: error.message || `Failed to load ${table}` },
      { status: 500 }
    )
  }

  return NextResponse.json({
    rows: data ?? [],
    total: count ?? (data?.length ?? 0),
    page,
    pageSize,
  })
}

export async function adminInsertRow(
  db: SupabaseClient,
  actor: User,
  table: AdminTableName,
  rawBody: Record<string, unknown>
) {
  if (READ_ONLY_ADMIN_TABLES.has(table)) {
    return NextResponse.json(
      { error: `Table "${table}" is read-only` },
      { status: 403 }
    )
  }

  let payload: Record<string, unknown>
  try {
    payload = sanitizePayload(table, rawBody)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Invalid payload' },
      { status: 400 }
    )
  }

  const { data: inserted, error } = await db
    .from(table)
    .insert(payload)
    .select('*')
    .single()

  if (error || !inserted) {
    return NextResponse.json(
      { error: error?.message || `Failed to insert into ${table}` },
      { status: 400 }
    )
  }

  await writeAuditLog(db, {
    actorId: actor.id,
    action: 'admin_insert',
    tableName: table,
    rowId: String((inserted as Record<string, unknown>).id ?? ''),
    diff: { after: payload },
  })

  return NextResponse.json({ row: inserted }, { status: 201 })
}

export async function adminUpdateRow(
  db: SupabaseClient,
  actor: User,
  table: AdminTableName,
  id: string,
  rawBody: Record<string, unknown>
) {
  if (READ_ONLY_ADMIN_TABLES.has(table)) {
    return NextResponse.json(
      { error: `Table "${table}" is read-only` },
      { status: 403 }
    )
  }

  if (!id) {
    return NextResponse.json({ error: 'Row ID is required' }, { status: 400 })
  }

  let payload: Record<string, unknown>
  try {
    payload = sanitizePayload(table, rawBody)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Invalid payload' },
      { status: 400 }
    )
  }

  if (Object.keys(payload).length === 0) {
    return NextResponse.json(
      { error: 'No updatable fields provided' },
      { status: 400 }
    )
  }

  const { data: beforeRow } = await db
    .from(table)
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (!beforeRow) {
    return NextResponse.json({ error: 'Record not found' }, { status: 404 })
  }

  const { data: updated, error } = await db
    .from(table)
    .update(payload)
    .eq('id', id)
    .select('*')
    .single()

  if (error || !updated) {
    return NextResponse.json(
      { error: error?.message || `Failed to update ${table}` },
      { status: 400 }
    )
  }

  await writeAuditLog(db, {
    actorId: actor.id,
    action: 'admin_update',
    tableName: table,
    rowId: id,
    diff: {
      before: Object.fromEntries(
        Object.keys(payload).map((k) => [k, (beforeRow as Record<string, unknown>)[k]])
      ),
      after: payload,
    },
  })

  return NextResponse.json({ row: updated })
}

export async function adminDeleteRows(
  db: SupabaseClient,
  actor: User,
  table: AdminTableName,
  ids: string[]
) {
  if (READ_ONLY_ADMIN_TABLES.has(table)) {
    return NextResponse.json(
      { error: `Table "${table}" is read-only` },
      { status: 403 }
    )
  }

  const cleanIds = ids.filter((id) => typeof id === 'string' && id.trim().length > 0)
  if (cleanIds.length === 0) {
    return NextResponse.json({ error: 'No valid IDs provided' }, { status: 400 })
  }

  const { error } = await db.from(table).delete().in('id', cleanIds)
  if (error) {
    return NextResponse.json(
      { error: error.message || `Failed to delete from ${table}` },
      { status: 400 }
    )
  }

  await writeAuditLog(db, {
    actorId: actor.id,
    action: cleanIds.length > 1 ? 'admin_bulk_delete' : 'admin_delete',
    tableName: table,
    rowId: cleanIds.length === 1 ? cleanIds[0] : null,
    diff: { deleted_ids: cleanIds },
  })

  return NextResponse.json({ deletedCount: cleanIds.length })
}
