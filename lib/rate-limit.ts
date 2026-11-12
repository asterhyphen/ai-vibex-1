import { getSupabasePublishableKey, getSupabaseUrl } from './supabase/config'

// In-memory token-bucket rate limiter (Edge & Node runtime compatible)

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  retryAfter: number
}

interface TokenBucket {
  tokens: number
  lastRefillMs: number
}

interface RateLimitState {
  buckets: Map<string, TokenBucket>
  blockedCount: number
}

const API_MAX_TOKENS = 10
const API_WINDOW_MS = 10_000
const OTP_MAX_TOKENS = 3
const OTP_WINDOW_MS = 60_000
const MAX_BUCKETS = 5_000

const globalForRateLimit = globalThis as typeof globalThis & {
  __miteRateLimitState?: RateLimitState
}

function getState(): RateLimitState {
  if (!globalForRateLimit.__miteRateLimitState) {
    globalForRateLimit.__miteRateLimitState = {
      buckets: new Map<string, TokenBucket>(),
      blockedCount: 0,
    }
  }
  return globalForRateLimit.__miteRateLimitState
}

function pruneStaleBuckets(state: RateLimitState, now: number) {
  if (state.buckets.size <= MAX_BUCKETS) return
  for (const [key, bucket] of state.buckets) {
    if (now - bucket.lastRefillMs > OTP_WINDOW_MS * 2) {
      state.buckets.delete(key)
    }
  }
}

export function consumeRateLimit(params: {
  key: string
  maxTokens: number
  windowMs: number
  now?: number
}): RateLimitResult {
  const now = params.now ?? Date.now()
  const state = getState()
  pruneStaleBuckets(state, now)

  const refillRatePerMs = params.maxTokens / params.windowMs
  const existing = state.buckets.get(params.key)

  let tokens = params.maxTokens
  if (existing) {
    const elapsed = Math.max(0, now - existing.lastRefillMs)
    tokens = Math.min(params.maxTokens, existing.tokens + elapsed * refillRatePerMs)
  }

  if (tokens < 1) {
    state.blockedCount += 1
    state.buckets.set(params.key, {
      tokens,
      lastRefillMs: now,
    })
    const missingTokens = 1 - tokens
    const retryAfter = Math.max(1, Math.ceil(missingTokens / refillRatePerMs / 1000))
    return {
      allowed: false,
      remaining: 0,
      retryAfter,
    }
  }

  const remainingTokens = tokens - 1
  state.buckets.set(params.key, {
    tokens: remainingTokens,
    lastRefillMs: now,
  })

  return {
    allowed: true,
    remaining: Math.floor(remainingTokens),
    retryAfter: 0,
  }
}

/**
 * General API rate limit: 10 requests per 10 seconds per IP or user key.
 */
export function checkApiRateLimit(key: string): RateLimitResult {
  return consumeRateLimit({
    key: `api:${key}`,
    maxTokens: API_MAX_TOKENS,
    windowMs: API_WINDOW_MS,
  })
}

/**
 * OTP request rate limit: 3 requests per 60 seconds per email.
 */
export function checkOtpRateLimit(email: string): RateLimitResult {
  return consumeRateLimit({
    key: `otp:${email.trim().toLowerCase()}`,
    maxTokens: OTP_MAX_TOKENS,
    windowMs: OTP_WINDOW_MS,
  })
}

/**
 * Returns total number of rate-limited (429) requests blocked in this runtime.
 */
export function getBlockedRequestsCount(): number {
  return getState().blockedCount
}

/**
 * Fire-and-forget insert of rate-limit blocks into Supabase `audit_log`
 * so Edge middleware and Node route handlers share blocked-request telemetry.
 */
export function logRateLimitBlocked(params: {
  path: string
  retryAfter: number
  kind: 'api' | 'otp'
}): Promise<void> {
  const url = getSupabaseUrl()
  const apiKey =
    (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim() ||
    getSupabasePublishableKey()

  if (!url || !apiKey) {
    return Promise.resolve()
  }

  const endpoint = `${url}/rest/v1/audit_log`
  return fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: apiKey,
      Authorization: `Bearer ${apiKey}`,
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      action: 'rate_limit_blocked',
      table_name: 'api_rate_limit',
      diff: {
        path: params.path,
        retryAfter: params.retryAfter,
        kind: params.kind,
      },
    }),
  })
    .then(() => undefined)
    .catch(() => undefined)
}

export function extractClientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim()
    if (first) return first
  }
  return headers.get('x-real-ip')?.trim() || '127.0.0.1'
}
