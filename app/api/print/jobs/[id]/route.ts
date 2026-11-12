import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticatedProfile } from '@/lib/utils/server-auth'
import { deriveOrderOtp } from '@/lib/utils/format'

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuthenticatedProfile()
  if (!auth.ok) return auth.response

  const { id } = await context.params
  const { db, user, profile } = auth

  const { data: job, error } = await db
    .from('print_jobs')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error || !job) {
    return NextResponse.json({ error: 'Print job not found' }, { status: 404 })
  }

  const isStaffOrAdmin = profile.role === 'shopkeeper' || profile.role === 'admin'
  if (!isStaffOrAdmin && job.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return NextResponse.json({
    job,
    otp: deriveOrderOtp(job.qr_token ?? job.id),
  })
}
