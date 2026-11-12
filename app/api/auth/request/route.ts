import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { EmailRequestSchema, isValidMiteEmail, normalizeEmail } from '@/lib/validators/auth'

const IP_WINDOW_MS = 10_000
const IP_MAX_REQUESTS = 10
const EMAIL_WINDOW_MS = 60_000
const EMAIL_MAX_REQUESTS = 3

const ipRequestsMap = new Map<string, number[]>()
const emailRequestsMap = new Map<string, number[]>()

function pruneAndCount(
  store: Map<string, number[]>,
  key: string,
  windowMs: number,
  now: number
): number[] {
  const existing = store.get(key) ?? []
  const valid = existing.filter((ts) => now - ts < windowMs)
  if (valid.length === 0) {
    store.delete(key)
  } else {
    store.set(key, valid)
  }
  return valid
}

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim()
    if (first) return first
  }
  return request.headers.get('x-real-ip')?.trim() || '127.0.0.1'
}

export async function POST(request: NextRequest) {
  const now = Date.now()
  const ip = getClientIp(request)

  // Check IP rate limit (10 req / 10s)
  const recentIpHits = pruneAndCount(ipRequestsMap, ip, IP_WINDOW_MS, now)
  if (recentIpHits.length >= IP_MAX_REQUESTS) {
    const oldest = recentIpHits[0] ?? now
    const retryAfter = Math.max(1, Math.ceil((oldest + IP_WINDOW_MS - now) / 1000))
    return NextResponse.json(
      { error: 'Too many requests', retryAfter },
      { status: 429 }
    )
  }
  ipRequestsMap.set(ip, [...recentIpHits, now])

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

  // Check per-email rate limit (3 OTP / min)
  const recentEmailHits = pruneAndCount(emailRequestsMap, email, EMAIL_WINDOW_MS, now)
  if (recentEmailHits.length >= EMAIL_MAX_REQUESTS) {
    const oldest = recentEmailHits[0] ?? now
    const retryAfter = Math.max(1, Math.ceil((oldest + EMAIL_WINDOW_MS - now) / 1000))
    return NextResponse.json(
      { error: 'Too many requests', retryAfter },
      { status: 429 }
    )
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: 'Supabase authentication is not configured yet' },
      { status: 503 }
    )
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
    },
  })

  if (error) {
    return NextResponse.json(
      { error: error.message || 'Unable to send OTP right now' },
      { status: error.status && error.status >= 400 ? error.status : 400 }
    )
  }

  emailRequestsMap.set(email, [...recentEmailHits, now])
  return NextResponse.json({ message: 'OTP sent' }, { status: 200 })
}
