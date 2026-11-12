import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticatedProfile } from '@/lib/utils/server-auth'
import {
  adminDeleteRows,
  adminInsertRow,
  adminListRows,
  adminUpdateRow,
  validateTableOrError,
} from '@/lib/admin/crud'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ table: string }> }
) {
  const auth = await requireAuthenticatedProfile(['admin'])
  if (!auth.ok) return auth.response

  const { table: rawTable } = await context.params
  const tableCheck = validateTableOrError(rawTable)
  if (!tableCheck.ok) return tableCheck.response

  return adminListRows(auth.db, tableCheck.table, request.nextUrl.searchParams)
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ table: string }> }
) {
  const auth = await requireAuthenticatedProfile(['admin'])
  if (!auth.ok) return auth.response

  const { table: rawTable } = await context.params
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

  return adminInsertRow(
    auth.db,
    auth.user,
    tableCheck.table,
    body as Record<string, unknown>
  )
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ table: string }> }
) {
  const auth = await requireAuthenticatedProfile(['admin'])
  if (!auth.ok) return auth.response

  const { table: rawTable } = await context.params
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

  const record = body as Record<string, unknown>
  const id = typeof record.id === 'string' ? record.id : ''
  return adminUpdateRow(auth.db, auth.user, tableCheck.table, id, record)
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ table: string }> }
) {
  const auth = await requireAuthenticatedProfile(['admin'])
  if (!auth.ok) return auth.response

  const { table: rawTable } = await context.params
  const tableCheck = validateTableOrError(rawTable)
  if (!tableCheck.ok) return tableCheck.response

  let ids: string[] = []
  const queryId = request.nextUrl.searchParams.get('id')
  if (queryId) {
    ids = [queryId]
  } else {
    try {
      const body = (await request.json()) as { id?: string; ids?: string[] }
      if (Array.isArray(body?.ids)) {
        ids = body.ids
      } else if (typeof body?.id === 'string') {
        ids = [body.id]
      }
    } catch {
      // Handled below if ids stays empty
    }
  }

  return adminDeleteRows(auth.db, auth.user, tableCheck.table, ids)
}
