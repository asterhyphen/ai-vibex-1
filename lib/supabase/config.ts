import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export function getSupabaseUrl(): string {
  return (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim().replace(/\/+$/, '')
}

export function getSupabasePublishableKey(): string {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    ''
  ).trim()
}

export function isSupabaseConfigured(): boolean {
  return Boolean(getSupabaseUrl() && getSupabasePublishableKey())
}

/**
 * Returns a service-role Supabase client when SUPABASE_SERVICE_ROLE_KEY is set.
 * Returns null if not configured so callers can fall back gracefully.
 */
export function createServiceRoleClient() {
  const url = getSupabaseUrl()
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim()
  if (!url || !serviceKey) return null

  return createSupabaseClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}
