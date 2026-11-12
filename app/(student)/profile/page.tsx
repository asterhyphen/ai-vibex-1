import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { connection } from 'next/server'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import type { UserRole } from '@/lib/types'
import { ProfileClient } from './ProfileClient'

async function ProfileLoader() {
  await connection()
  if (!isSupabaseConfigured()) {
    return (
      <ProfileClient
        email="student@mite.ac.in"
        fullName="MITE Student"
        role="student"
        phone={null}
        phoneVerified={false}
        department={null}
        createdAt={null}
      />
    )
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/profile')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role, phone, phone_verified, department, is_blocked, created_at')
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

  if (!profile?.phone_verified) {
    redirect('/onboarding')
  }

  const role: UserRole =
    profile.role === 'faculty' ? 'faculty' : 'student'

  return (
    <ProfileClient
      email={user.email ?? ''}
      fullName={profile.full_name}
      role={role}
      phone={profile.phone}
      phoneVerified={profile.phone_verified}
      department={profile.department}
      createdAt={profile.created_at}
    />
  )
}

export default function ProfilePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] text-[var(--text-muted)]">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--primary)]" />
        </div>
      }
    >
      <ProfileLoader />
    </Suspense>
  )
}
