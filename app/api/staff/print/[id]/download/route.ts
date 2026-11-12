import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticatedProfile, writeAuditLog } from '@/lib/utils/server-auth'

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuthenticatedProfile(['shopkeeper', 'admin'])
  if (!auth.ok) return auth.response

  const { id } = await context.params
  if (!id) {
    return NextResponse.json({ error: 'Print job ID is required' }, { status: 400 })
  }

  const { db, user } = auth

  const { data: job, error: fetchError } = await db
    .from('print_jobs')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (fetchError || !job) {
    return NextResponse.json({ error: 'Print job not found' }, { status: 404 })
  }

  if (!job.file_path) {
    return NextResponse.json(
      { error: 'No file attached to this print job' },
      { status: 404 }
    )
  }

  const safeFilename = (job.original_name || 'document.pdf').replace(/["\r\n]/g, '_')
  const { data: signed, error: signedError } = await db.storage
    .from('print-jobs')
    .createSignedUrl(job.file_path, 120, {
      download: safeFilename,
    })

  if (signedError || !signed?.signedUrl) {
    return NextResponse.json(
      { error: signedError?.message || 'Could not generate signed download URL' },
      { status: 500 }
    )
  }

  await writeAuditLog(db, {
    actorId: user.id,
    action: 'print_job_download',
    tableName: 'print_jobs',
    rowId: id,
    diff: { file_path: job.file_path },
  })

  return NextResponse.json({
    url: signed.signedUrl,
    filename: safeFilename,
  })
}
