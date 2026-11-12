import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { connection } from 'next/server'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { OnboardingClient } from './OnboardingClient'

async function OnboardingLoader() {
  await connection()
  const configured = isSupabaseConfigured()

  if (!configured) {
    return (
      <OnboardingClient
        initialRole="student"
        fullName={null}
        userEmail={null}
        isAuthenticated={false}
        supabaseConfigured={false}
      />
    )
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/onboarding')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, phone_verified, is_blocked')
    .eq('user_id', user.id)
    .maybeSingle()

  if (profile?.is_blocked) {
    redirect('/403?reason=blocked')
  }

  if (profile?.role === 'shopkeeper') {
    redirect('/staff')
  }

  if (profile?.role === 'admin') {
    redirect('/admin')
  }

  if (profile?.phone_verified) {
    redirect('/home')
  }

  const initialRole = profile?.role === 'faculty' ? 'faculty' : 'student'

  return (
    <OnboardingClient
      initialRole={initialRole}
      fullName={profile?.full_name ?? null}
      userEmail={user.email ?? null}
      isAuthenticated={true}
      supabaseConfigured={true}
    />
  )
}

export default function OnboardingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] text-[var(--text-muted)]">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--primary)]" />
        </div>
      }
    >
      <OnboardingLoader />
    </Suspense>
  )
}
