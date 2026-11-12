import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'

export async function POST(request: NextRequest) {
  if (isSupabaseConfigured()) {
    const supabase = await createClient()
    await supabase.auth.signOut()
  }

  const loginUrl = new URL('/login', request.url)
  return NextResponse.redirect(loginUrl, { status: 303 })
}
