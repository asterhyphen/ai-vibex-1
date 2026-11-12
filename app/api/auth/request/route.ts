import { NextRequest, NextResponse } from 'next/server'
import {
  checkApiRateLimit,
  checkOtpRateLimit,
  extractClientIp,
  logRateLimitBlocked,
} from '@/lib/rate-limit'
import {
  EmailRequestSchema,
  isValidMiteEmail,
  normalizeEmail,
} from '@/lib/validators/auth'

export async function POST(request: NextRequest) {
  // Enforce IP bucket here if not already consumed in middleware
  if (request.headers.get('x-ratelimit-ip-checked') !== '1') {
    const ip = extractClientIp(request.headers)
    const ipLimit = checkApiRateLimit(ip)
    if (!ipLimit.allowed) {
      void logRateLimitBlocked({
        path: '/api/auth/request',
        retryAfter: ipLimit.retryAfter,
        kind: 'api',
      })
      return NextResponse.json(
        { error: 'Too many requests', retryAfter: ipLimit.retryAfter },
        {
          status: 429,
          headers: { 'Retry-After': String(ipLimit.retryAfter) },
        }
      )
    }
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 })
  }

  const rawEmail =
    typeof body === 'object' && body !== null && 'email' in body
      ? String((body as { email?: unknown }).email ?? '')
      : ''

  const normalized = normalizeEmail(rawEmail)
  if (!isValidMiteEmail(normalized)) {
    return NextResponse.json(
      { error: 'Only @mite.ac.in emails allowed' },
      { status: 400 }
    )
  }

  const parsed = EmailRequestSchema.safeParse({ email: normalized })
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Only @mite.ac.in emails allowed' },
      { status: 400 }
    )
  }

  const email = parsed.data.email

  // Per-email OTP rate limit (3 req / min)
  const otpLimit = checkOtpRateLimit(email)
  if (!otpLimit.allowed) {
    void logRateLimitBlocked({
      path: '/api/auth/request',
      retryAfter: otpLimit.retryAfter,
      kind: 'otp',
    })
    return NextResponse.json(
      { error: 'Too many requests', retryAfter: otpLimit.retryAfter },
      {
        status: 429,
        headers: { 'Retry-After': String(otpLimit.retryAfter) },
      }
    )
  }

  return NextResponse.json(
    {
      message: 'Verification code ready (Demo OTP: 1234)',
      demoOtp: '1234',
    },
    { status: 200 }
  )
}
