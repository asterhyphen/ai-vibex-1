import { NextResponse } from 'next/server'
import { requireAuthenticatedProfile } from '@/lib/utils/server-auth'

export async function GET() {
  const auth = await requireAuthenticatedProfile(['shopkeeper', 'admin'])
  if (!auth.ok) return auth.response

  const { db } = auth

  const { data: jobs, error } = await db
    .from('print_jobs')
    .select('*')
    .in('status', ['paid', 'printing', 'ready', 'collected', 'rejected'])
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json(
      { error: error.message || 'Failed to load print queue' },
      { status: 500 }
    )
  }

  // Enrich with student/faculty display name where user_id exists
  const userIds = Array.from(
    new Set((jobs ?? []).map((j) => j.user_id).filter(Boolean) as string[])
  )

  let profileMap: Record<string, { full_name: string | null; role: string }> = {}
  if (userIds.length > 0) {
    const { data: profiles } = await db
      .from('profiles')
      .select('user_id, full_name, role')
      .in('user_id', userIds)

    if (profiles) {
      profileMap = Object.fromEntries(
        profiles.map((p) => [p.user_id, { full_name: p.full_name, role: p.role }])
      )
    }
  }

  const enriched = (jobs ?? []).map((job) => ({
    ...job,
    customer_name:
      (job.user_id && profileMap[job.user_id]?.full_name) ||
      job.guest_name ||
      'Student',
    customer_role: (job.user_id && profileMap[job.user_id]?.role) || 'student',
  }))

  return NextResponse.json({ jobs: enriched })
}
