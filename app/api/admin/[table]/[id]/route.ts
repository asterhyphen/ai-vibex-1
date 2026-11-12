import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticatedProfile } from '@/lib/utils/server-auth'
import {
  adminDeleteRows,
  adminUpdateRow,
  validateTableOrError,
} from '@/lib/admin/crud'

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ table: string; id: string }> }
) {
  const auth = await requireAuthenticatedProfile(['admin'])
  if (!auth.ok) return auth.response

  const { table: rawTable, id } = await context.params
  const tableCheck = validateTableOrError(rawTable)
  if (!tableCheck.ok) return tableCheck.response

  const { data, error } = await auth.db
    .from(tableCheck.table)
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json({ row: data })
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ table: string; id: string }> }
) {
  const auth = await requireAuthenticatedProfile(['admin'])
  if (!auth.ok) return auth.response

  const { table: rawTable, id } = await context.params
  const tableCheck = validateTableOrError(rawTable)
  if (!tableCheck.ok) return tableCheck.response

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 })
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Expected JSON object' }, { status: 400 })
  }

  return adminUpdateRow(
    auth.db,
    auth.user,
    tableCheck.table,
    id,
    body as Record<string, unknown>
  )
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ table: string; id: string }> }
) {
  const auth = await requireAuthenticatedProfile(['admin'])
  if (!auth.ok) return auth.response

  const { table: rawTable, id } = await context.params
  const tableCheck = validateTableOrError(rawTable)
  if (!tableCheck.ok) return tableCheck.response

  return adminDeleteRows(auth.db, auth.user, tableCheck.table, [id])
}
