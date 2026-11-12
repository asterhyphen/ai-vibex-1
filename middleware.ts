import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/middleware'

const STAFF_PATHS  = /^\/staff(\/|$)/
const ADMIN_PATHS  = /^\/admin(\/|$)/
const STUDENT_PATHS = /^\/(home|checkout|orders|history|print|profile)(\/|$)/

// Routes that never need auth
const PUBLIC_PATHS = ['/login', '/onboarding', '/403', '/_next', '/favicon']

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some(p => pathname.startsWith(p))
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const response = NextResponse.next({ request })

  // Always allow public paths
  if (isPublic(pathname)) return response

  const supabase = createClient(request, response)
  const { data: { user } } = await supabase.auth.getUser()

  // Unauthenticated → redirect to login
  if (!user) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Look up role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_blocked')
    .eq('user_id', user.id)
    .single()

  const role = profile?.role ?? null
  const blocked = profile?.is_blocked ?? false

  // Blocked users always get 403
  if (blocked) {
    return NextResponse.redirect(new URL('/403', request.url))
  }

  // /staff/* (except /staff/login)
  if (STAFF_PATHS.test(pathname) && pathname !== '/staff/login') {
    if (role !== 'shopkeeper') {
      if (role === 'student' || role === 'faculty') {
        return NextResponse.redirect(new URL('/403', request.url))
      }
      return NextResponse.redirect(new URL('/staff/login', request.url))
    }
  }

  // /admin/* (except /admin/login)
  if (ADMIN_PATHS.test(pathname) && pathname !== '/admin/login') {
    if (role !== 'admin') {
      if (role === 'student' || role === 'faculty') {
        return NextResponse.redirect(new URL('/403', request.url))
      }
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }
  }

  // Student/faculty-only paths
  if (STUDENT_PATHS.test(pathname)) {
    if (role !== 'student' && role !== 'faculty') {
      return NextResponse.redirect(new URL('/403', request.url))
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
