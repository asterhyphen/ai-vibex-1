import { Suspense } from 'react'
import { Loader2 } from 'lucide-react'
import { PortalLoginForm } from '@/components/auth/PortalLoginForm'
import { getInitialPortalState } from '@/lib/auth/portal-login'
import { loginAdminAction } from './actions'

async function AdminLoginLoader() {
  const { lastLoginAt } = await getInitialPortalState('admin')

  return (
    <PortalLoginForm
      portal="admin"
      heading="SkipQ Administration"
      subtitle="Authorized administrators only. All dashboard edits are audited."
      placeholderEmail="admin@mite.ac.in"
      initialLastLoginAt={lastLoginAt}
      onAuthenticate={loginAdminAction}
    />
  )
}

export default function AdminLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] text-[var(--text-muted)]">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--primary)]" />
        </div>
      }
    >
      <AdminLoginLoader />
    </Suspense>
  )
}
