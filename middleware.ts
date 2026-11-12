import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/middleware'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { checkApiRateLimit, extractClientIp } from '@/lib/rate-limit'

const STAFF_PATHS = /^\/staff(\/|$)/
const ADMIN_PATHS = /^\/admin(\/|$)/
const STUDENT_PATHS = /^\/(home|checkout|orders|history|print|profile)(\/|$)/

const PUBLIC_PREFIXES = [
  '/login',
  '/onboarding',
  '/staff/login',
  '/admin/login',
  '/api/auth',
  '/403',
  '/_next',
  '/favicon',
]

function isPublicPath(pathname: string): boolean {
  if (pathname === '/') return true
  return PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )
}

function isApiPath(pathname: string): boolean {
  return pathname === '/api' || pathname.startsWith('/api/')
}

function isAuthApiPath(pathname: string): boolean {
  return pathname === '/api/auth' || pathname.startsWith('/api/auth/')
}

function buildCspHeader(): string {
  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https://fonts.gstatic.com",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://raw.githack.com https://raw.githubusercontent.com https://dl.polyhaven.org ws://localhost:* http://localhost:*",
    "worker-src 'self' blob:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ')
}

function withSecurityHeaders(
  response: NextResponse,
  pathname: string
): NextResponse {
  const allowCamera = STAFF_PATHS.test(pathname) && pathname !== '/staff/login'

  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set(
    'Permissions-Policy',
    allowCamera
      ? 'camera=(self), microphone=(), geolocation=()'
      : 'camera=(), microphone=(), geolocation=()'
  )
  response.headers.set('Content-Security-Policy', buildCspHeader())
  return response
}

function redirectTo(pathname: string, request: NextRequest, search?: Record<string, string>) {
  const url = request.nextUrl.clone()
  url.pathname = pathname
  url.search = ''
  if (search) {
    for (const [k, v] of Object.entries(search)) {
      url.searchParams.set(k, v)
    }
  }
  return withSecurityHeaders(NextResponse.redirect(url), request.nextUrl.pathname)
}

function getAuthenticatedHomePath(
  role: string | null,
  phoneVerified: boolean
): string {
  if (role === 'shopkeeper') return '/staff'
  if (role === 'admin') return '/admin'
  if ((role === 'student' || role === 'faculty') && phoneVerified) return '/home'
  return '/onboarding'
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const requestHeaders = new Headers(request.headers)

  // 1. Rate-limit all /api/* traffic (10 req / 10s per IP)
  if (isApiPath(pathname)) {
    const clientIp = extractClientIp(request.headers)
    const rateResult = checkApiRateLimit(clientIp)
    if (!rateResult.allowed) {
      return withSecurityHeaders(
        NextResponse.json(
          { error: 'Too many requests', retryAfter: rateResult.retryAfter },
          {
            status: 429,
            headers: { 'Retry-After': String(rateResult.retryAfter) },
          }
        ),
        pathname
      )
    }
    requestHeaders.set('x-ratelimit-ip-checked', '1')
  }

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })

  const publicPath = isPublicPath(pathname)
  const checkEntryRedirect = pathname === '/' || pathname === '/login'

  // Fast-path public static/auth/error routes that don't redirect logged-in users
  if (publicPath && !checkEntryRedirect) {
    return withSecurityHeaders(response, pathname)
  }

  // Graceful behavior when Supabase env vars are not yet configured
  if (!isSupabaseConfigured()) {
    if (publicPath) {
      return withSecurityHeaders(response, pathname)
    }
    if (isApiPath(pathname)) {
      return withSecurityHeaders(
        NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
        pathname
      )
    }
    if (STAFF_PATHS.test(pathname)) {
      return redirectTo('/staff/login', request)
    }
    if (ADMIN_PATHS.test(pathname)) {
      return redirectTo('/admin/login', request)
    }
    return redirectTo('/login', request, { next: pathname })
  }

  const supabase = createClient(request, response)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Unauthenticated handling
  if (!user) {
    if (publicPath) {
      return withSecurityHeaders(response, pathname)
    }
    if (isApiPath(pathname) && !isAuthApiPath(pathname)) {
      return withSecurityHeaders(
        NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
        pathname
      )
    }
    if (STAFF_PATHS.test(pathname)) {
      return redirectTo('/staff/login', request)
    }
    if (ADMIN_PATHS.test(pathname)) {
      return redirectTo('/admin/login', request)
    }
    return redirectTo('/login', request, { next: pathname })
  }

  // Authenticated: look up profile role & verification status
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, phone_verified, is_blocked')
    .eq('user_id', user.id)
    .maybeSingle()

  const role = profile?.role ?? null
  const phoneVerified = profile?.phone_verified ?? false
  const blocked = profile?.is_blocked ?? false

  // Blocked users always get 403
  if (blocked) {
    if (isApiPath(pathname)) {
      return withSecurityHeaders(
        NextResponse.json({ error: 'Account blocked' }, { status: 403 }),
        pathname
      )
    }
    return redirectTo('/403', request, { reason: 'blocked' })
  }

  // Redirect already-authenticated users visiting / or /login to their home
  if (checkEntryRedirect) {
    return redirectTo(getAuthenticatedHomePath(role, phoneVerified), request)
  }

  // /staff/* (except /staff/login)
  if (STAFF_PATHS.test(pathname) && pathname !== '/staff/login') {
    if (role !== 'shopkeeper') {
      if (role === 'student' || role === 'faculty' || role === 'admin') {
        return redirectTo('/403', request, { reason: 'staff' })
      }
      return redirectTo('/staff/login', request)
    }
  }

  // /admin/* (except /admin/login)
  if (ADMIN_PATHS.test(pathname) && pathname !== '/admin/login') {
    if (role !== 'admin') {
      if (role === 'student' || role === 'faculty' || role === 'shopkeeper') {
        return redirectTo('/403', request, { reason: 'admin' })
      }
      return redirectTo('/admin/login', request)
    }
  }

  // Student/faculty-only paths enforce role AND phone verification
  if (STUDENT_PATHS.test(pathname)) {
    if (role !== 'student' && role !== 'faculty') {
      return redirectTo('/403', request, { reason: 'student' })
    }
    if (!phoneVerified) {
      return redirectTo('/onboarding', request)
    }
  }

  return withSecurityHeaders(response, pathname)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
