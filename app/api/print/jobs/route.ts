import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import {
  notifyUserAndSms,
  requireAuthenticatedProfile,
  writeAuditLog,
} from '@/lib/utils/server-auth'
import { generateSignedQrToken } from '@/lib/utils/qr'
import {
  calculatePrintCostPaise,
  CreatePrintJobSchema,
  DEFAULT_PRINT_RATES,
} from '@/lib/validators/print'
import { formatPaise } from '@/lib/utils/format'

export async function GET() {
  const auth = await requireAuthenticatedProfile()
  if (!auth.ok) return auth.response

  const { db, user } = auth
  const { data: jobs, error } = await db
    .from('print_jobs')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ jobs: jobs ?? [] })
}

export async function POST(request: NextRequest) {
  const auth = await requireAuthenticatedProfile()
  if (!auth.ok) return auth.response

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 })
  }

  const parsed = CreatePrintJobSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Invalid print job options' },
      { status: 400 }
    )
  }

  const { db, user, profile } = auth
  const input = parsed.data

  // Verify the uploaded file belongs to this user's storage prefix
  if (!input.file_path.startsWith(`${user.id}/`)) {
    return NextResponse.json(
      { error: 'Invalid file reference for current user' },
      { status: 403 }
    )
  }

  // Load rates from settings (fallback to defaults)
  const { data: settingsRow } = await db
    .from('settings')
    .select('value')
    .eq('key', 'general')
    .maybeSingle()

  const settingsVal = (settingsRow?.value ?? {}) as Record<string, unknown>
  const rates = {
    bwRatePaise:
      typeof settingsVal.bw_rate_paise === 'number'
        ? settingsVal.bw_rate_paise
        : DEFAULT_PRINT_RATES.bwRatePaise,
    colorRatePaise:
      typeof settingsVal.color_rate_paise === 'number'
        ? settingsVal.color_rate_paise
        : DEFAULT_PRINT_RATES.colorRatePaise,
    a3Multiplier:
      typeof settingsVal.a3_multiplier === 'number'
        ? settingsVal.a3_multiplier
        : DEFAULT_PRINT_RATES.a3Multiplier,
  }

  const { totalPaise } = calculatePrintCostPaise(
    {
      pages: input.pages,
      color: input.color,
      double_sided: input.double_sided,
      copies: input.copies,
      paper: input.paper,
    },
    rates
  )

  const jobId = crypto.randomUUID()
  const shortRef = `P-${jobId.slice(0, 6).toUpperCase()}`
  const qrToken = generateSignedQrToken(jobId, shortRef)

  const { data: job, error: insertError } = await db
    .from('print_jobs')
    .insert({
      id: jobId,
      user_id: user.id,
      guest_name: profile.full_name,
      file_path: input.file_path,
      original_name: input.original_name,
      pages: input.pages,
      color: input.color,
      double_sided: input.double_sided,
      copies: input.copies,
      paper: input.paper,
      cost_paise: totalPaise,
      status: 'paid',
      payment_method: input.payment_method,
      payment_status: 'paid',
      qr_token: qrToken,
      sanitised: true,
    })
    .select('*')
    .single()

  if (insertError || !job) {
    return NextResponse.json(
      { error: insertError?.message || 'Failed to create print job' },
      { status: 500 }
    )
  }

  await notifyUserAndSms(db, {
    userId: user.id,
    title: `Print Job ${shortRef} Submitted`,
    body: `"${input.original_name}" (${formatPaise(totalPaise)}) sent to the print counter.`,
    kind: 'info',
    smsBody: `Print job ${shortRef} confirmed (${formatPaise(totalPaise)}). We'll notify you when ready.`,
    smsKind: 'print_confirmed',
  })

  await writeAuditLog(db, {
    actorId: user.id,
    action: 'print_job_created',
    tableName: 'print_jobs',
    rowId: jobId,
    diff: {
      original_name: input.original_name,
      pages: input.pages,
      copies: input.copies,
      color: input.color,
      double_sided: input.double_sided,
      paper: input.paper,
      cost_paise: totalPaise,
    },
  })

  return NextResponse.json({ job }, { status: 201 })
}
