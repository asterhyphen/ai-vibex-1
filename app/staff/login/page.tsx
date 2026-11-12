import { Suspense } from 'react'
import { Loader2 } from 'lucide-react'
import { PortalLoginForm } from '@/components/auth/PortalLoginForm'
import { getInitialPortalState } from '@/lib/auth/portal-login'
import { loginStaffAction } from './actions'

async function StaffLoginLoader() {
  const { lastLoginAt } = await getInitialPortalState('shopkeeper')

  return (
    <PortalLoginForm
      portal="staff"
      heading="Canteen & Print Staff Login"
      subtitle="Sign in with your counter credentials to manage orders and print jobs."
      placeholderEmail="canteen@mite.ac.in"
      initialLastLoginAt={lastLoginAt}
      onAuthenticate={loginStaffAction}
    />
  )
}

export default function StaffLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] text-[var(--text-muted)]">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--primary)]" />
        </div>
      }
    >
      <StaffLoginLoader />
    </Suspense>
  )
}
