import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticatedProfile, notifyUserAndSms, writeAuditLog } from '@/lib/utils/server-auth'
import { QrScanSchema } from '@/lib/validators/staff'
import { parseScannedQrPayload, verifySignedQrToken } from '@/lib/utils/qr'
import { deriveOrderOtp } from '@/lib/utils/format'

export async function POST(request: NextRequest) {
  const auth = await requireAuthenticatedProfile(['shopkeeper', 'admin'])
  if (!auth.ok) return auth.response

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 })
  }

  const parsed = QrScanSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { status: 'invalid', error: parsed.error.issues[0]?.message || 'Invalid scan payload' },
      { status: 400 }
    )
  }

  const { db, user } = auth
  const data = parsed.data
  const preferredKind = data.kind

  // ── Manual Fallback: Order/Job Code + 6-digit OTP ────────────────────
  if ('code' in data) {
    const cleanCode = data.code.trim().toUpperCase()
    const cleanOtp = data.otp.trim()

    // Try canteen order first unless explicitly print
    if (preferredKind !== 'print') {
      const { data: order } = await db
        .from('orders')
        .select('*, order_items(*)')
        .ilike('code', cleanCode)
        .maybeSingle()

      if (order) {
        const validOtps = new Set<string>([
          deriveOrderOtp(order.id),
          deriveOrderOtp(order.code),
        ])
        if (order.qr_token) {
          validOtps.add(deriveOrderOtp(order.qr_token))
        }

        if (!validOtps.has(cleanOtp)) {
          return NextResponse.json(
            { status: 'invalid', error: 'Incorrect OTP for this order code' },
            { status: 400 }
          )
        }

        if (order.status === 'collected') {
          return NextResponse.json(
            {
              status: 'already_collected',
              kind: 'order',
              error: 'Order has already been collected',
              order,
            },
            { status: 409 }
          )
        }

        if (order.status !== 'ready') {
          return NextResponse.json(
            {
              status: 'not_ready',
              kind: 'order',
              error: `Order ${order.code} is "${order.status}" and not ready for pickup`,
              order,
            },
            { status: 400 }
          )
        }

        const collectedAt = new Date().toISOString()
        const { data: updated, error: updateErr } = await db
          .from('orders')
          .update({ status: 'collected', collected_at: collectedAt })
          .eq('id', order.id)
          .select('*, order_items(*)')
          .single()

        if (updateErr || !updated) {
          return NextResponse.json(
            { status: 'invalid', error: updateErr?.message || 'Failed to collect order' },
            { status: 500 }
          )
        }

        await notifyUserAndSms(db, {
          userId: order.user_id,
          title: `Order ${order.code} Collected`,
          body: 'Enjoy your meal. Thanks for using SkipQ.',
          kind: 'success',
        })

        await writeAuditLog(db, {
          actorId: user.id,
          action: 'order_collected_manual',
          tableName: 'orders',
          rowId: order.id,
          diff: { code: order.code, collected_at: collectedAt },
        })

        return NextResponse.json({
          status: 'collected',
          kind: 'order',
          order: updated,
        })
      }
    }

    // Check print_jobs (matches full UUID or P-XXXXXX / short prefix)
    const normalizedJobPrefix = cleanCode.replace(/^P-/, '').toLowerCase()
    const { data: printJobs } = await db
      .from('print_jobs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)

    const matchedJob = (printJobs ?? []).find((job) => {
      const idStr = String(job.id).toLowerCase()
      return (
        idStr === cleanCode.toLowerCase() ||
        idStr.startsWith(normalizedJobPrefix)
      )
    })

    if (!matchedJob) {
      return NextResponse.json(
        { status: 'invalid', error: 'No matching order or print job found' },
        { status: 404 }
      )
    }

    const validJobOtps = new Set<string>([deriveOrderOtp(matchedJob.id)])
    if (matchedJob.qr_token) {
      validJobOtps.add(deriveOrderOtp(matchedJob.qr_token))
    }
    if (!validJobOtps.has(cleanOtp)) {
      return NextResponse.json(
        { status: 'invalid', error: 'Incorrect OTP for this print job' },
        { status: 400 }
      )
    }

    if (matchedJob.status === 'collected') {
      return NextResponse.json(
        {
          status: 'already_collected',
          kind: 'print',
          error: 'Print job has already been collected',
          printJob: matchedJob,
        },
        { status: 409 }
      )
    }

    if (matchedJob.status !== 'ready') {
      return NextResponse.json(
        {
          status: 'not_ready',
          kind: 'print',
          error: `Print job is "${matchedJob.status}" and not ready yet`,
          printJob: matchedJob,
        },
        { status: 400 }
      )
    }

    const { data: updatedJob, error: jobErr } = await db
      .from('print_jobs')
      .update({ status: 'collected' })
      .eq('id', matchedJob.id)
      .select('*')
      .single()

    if (jobErr || !updatedJob) {
      return NextResponse.json(
        { status: 'invalid', error: jobErr?.message || 'Failed to collect print job' },
        { status: 500 }
      )
    }

    await notifyUserAndSms(db, {
      userId: matchedJob.user_id,
      title: 'Print Job Collected',
      body: `${matchedJob.original_name || 'Your document'} has been collected.`,
      kind: 'success',
    })

    await writeAuditLog(db, {
      actorId: user.id,
      action: 'print_job_collected_manual',
      tableName: 'print_jobs',
      rowId: matchedJob.id,
      diff: { original_name: matchedJob.original_name },
    })

    return NextResponse.json({
      status: 'collected',
      kind: 'print',
      printJob: updatedJob,
    })
  }

  // ── QR Token Scan ────────────────────────────────────────────────────
  const { qrToken, code: parsedCode } = parseScannedQrPayload(data.qr_token)

  if (!qrToken && !parsedCode) {
    return NextResponse.json(
      { status: 'invalid', error: 'Invalid QR code payload' },
      { status: 400 }
    )
  }

  if (qrToken) {
    const sigCheck = verifySignedQrToken(qrToken)
    if (sigCheck.isSignedFormat && !sigCheck.valid) {
      return NextResponse.json(
        { status: 'invalid', error: 'Invalid or tampered QR signature' },
        { status: 400 }
      )
    }
  }

  // Try orders first unless explicitly print
  if (preferredKind !== 'print') {
    const orderQuery = db.from('orders').select('*, order_items(*)')
    const { data: order } = qrToken
      ? await orderQuery.eq('qr_token', qrToken).maybeSingle()
      : await orderQuery.ilike('code', parsedCode!).maybeSingle()

    if (order) {
      if (order.status === 'collected') {
        return NextResponse.json(
          {
            status: 'already_collected',
            kind: 'order',
            error: 'Already Collected',
            order,
          },
          { status: 409 }
        )
      }

      if (order.status !== 'ready') {
        return NextResponse.json(
          {
            status: 'not_ready',
            kind: 'order',
            error: `Order ${order.code} is "${order.status}" — must be Ready to collect`,
            order,
          },
          { status: 400 }
        )
      }

      const collectedAt = new Date().toISOString()
      const { data: updatedOrder, error: updateError } = await db
        .from('orders')
        .update({ status: 'collected', collected_at: collectedAt })
        .eq('id', order.id)
        .select('*, order_items(*)')
        .single()

      if (updateError || !updatedOrder) {
        return NextResponse.json(
          { status: 'invalid', error: updateError?.message || 'Failed to mark collected' },
          { status: 500 }
        )
      }

      await notifyUserAndSms(db, {
        userId: order.user_id,
        title: `Order ${order.code} Collected`,
        body: 'Your meal has been picked up.',
        kind: 'success',
      })

      await writeAuditLog(db, {
        actorId: user.id,
        action: 'order_collected_qr',
        tableName: 'orders',
        rowId: order.id,
        diff: { code: order.code, collected_at: collectedAt },
      })

      return NextResponse.json({
        status: 'collected',
        kind: 'order',
        order: updatedOrder,
      })
    }
  }

  // Check print_jobs by qr_token
  if (qrToken) {
    const { data: job } = await db
      .from('print_jobs')
      .select('*')
      .eq('qr_token', qrToken)
      .maybeSingle()

    if (job) {
      if (job.status === 'collected') {
        return NextResponse.json(
          {
            status: 'already_collected',
            kind: 'print',
            error: 'Already Collected',
            printJob: job,
          },
          { status: 409 }
        )
      }

      if (job.status !== 'ready') {
        return NextResponse.json(
          {
            status: 'not_ready',
            kind: 'print',
            error: `Print job is "${job.status}" — must be Ready to collect`,
            printJob: job,
          },
          { status: 400 }
        )
      }

      const { data: updatedJob, error: jobErr } = await db
        .from('print_jobs')
        .update({ status: 'collected' })
        .eq('id', job.id)
        .select('*')
        .single()

      if (jobErr || !updatedJob) {
        return NextResponse.json(
          { status: 'invalid', error: jobErr?.message || 'Failed to mark print job collected' },
          { status: 500 }
        )
      }

      await notifyUserAndSms(db, {
        userId: job.user_id,
        title: 'Print Job Collected',
        body: `${job.original_name || 'Your document'} has been collected.`,
        kind: 'success',
      })

      await writeAuditLog(db, {
        actorId: user.id,
        action: 'print_job_collected_qr',
        tableName: 'print_jobs',
        rowId: job.id,
        diff: { original_name: job.original_name },
      })

      return NextResponse.json({
        status: 'collected',
        kind: 'print',
        printJob: updatedJob,
      })
    }
  }

  return NextResponse.json(
    { status: 'invalid', error: 'Invalid or expired QR token' },
    { status: 404 }
  )
}
