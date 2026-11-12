import { NextRequest, NextResponse } from 'next/server'
import {
  notifyUserAndSms,
  requireAuthenticatedProfile,
  writeAuditLog,
} from '@/lib/utils/server-auth'
import { PrintStatusActionSchema } from '@/lib/validators/staff'
import type { PrintStatus } from '@/lib/types'

const VALID_FROM: Record<'start_printing' | 'ready' | 'reject', PrintStatus[]> = {
  start_printing: ['paid'],
  ready: ['printing'],
  reject: ['paid', 'printing'],
}

const TARGET_STATUS: Record<'start_printing' | 'ready' | 'reject', PrintStatus> = {
  start_printing: 'printing',
  ready: 'ready',
  reject: 'rejected',
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuthenticatedProfile(['shopkeeper', 'admin'])
  if (!auth.ok) return auth.response

  const { id } = await context.params
  if (!id) {
    return NextResponse.json({ error: 'Print job ID is required' }, { status: 400 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 })
  }

  const parsed = PrintStatusActionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Invalid print action' },
      { status: 400 }
    )
  }

  const { action, reason } = parsed.data
  const { db, user } = auth

  const { data: job, error: fetchError } = await db
    .from('print_jobs')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (fetchError || !job) {
    return NextResponse.json({ error: 'Print job not found' }, { status: 404 })
  }

  const currentStatus = job.status as PrintStatus
  if (!VALID_FROM[action].includes(currentStatus)) {
    return NextResponse.json(
      { error: `Cannot perform "${action}" from status "${currentStatus}"` },
      { status: 400 }
    )
  }

  const nextStatus = TARGET_STATUS[action]
  const updatePayload: Record<string, unknown> = { status: nextStatus }
  if (action === 'reject' && job.payment_status === 'paid') {
    updatePayload.payment_status = 'refunded'
  }

  const { data: updated, error: updateError } = await db
    .from('print_jobs')
    .update(updatePayload)
    .eq('id', id)
    .select('*')
    .single()

  if (updateError || !updated) {
    return NextResponse.json(
      { error: updateError?.message || 'Failed to update print job status' },
      { status: 500 }
    )
  }

  const shortRef = `P-${id.slice(0, 6).toUpperCase()}`
  if (action === 'ready') {
    await notifyUserAndSms(db, {
      userId: job.user_id,
      title: `Print Job ${shortRef} Ready!`,
      body: `"${job.original_name || 'Your document'}" is printed and ready for pickup.`,
      kind: 'success',
      smsBody: `Your print job ${shortRef} (${job.original_name || 'document'}) is ready! Collect at MITE Print Counter.`,
      smsKind: 'print_ready',
    })
  } else if (action === 'reject') {
    const cleanReason = reason?.trim() || 'Could not process document'
    await notifyUserAndSms(db, {
      userId: job.user_id,
      title: `Print Job ${shortRef} Rejected`,
      body: `Reason: ${cleanReason}`,
      kind: 'error',
      smsBody: `Your print job ${shortRef} was rejected: ${cleanReason}`,
      smsKind: 'print_rejected',
    })
  }

  await writeAuditLog(db, {
    actorId: user.id,
    action: `print_job_${action}`,
    tableName: 'print_jobs',
    rowId: id,
    diff: { from: currentStatus, to: nextStatus, ...(reason ? { reason } : {}) },
  })

  return NextResponse.json({ job: updated })
}
