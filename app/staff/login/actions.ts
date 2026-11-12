'use server'

import { authenticatePortalUser, type PortalAuthResult } from '@/lib/auth/portal-login'

export async function loginStaffAction(input: {
  email: string
  password: string
}): Promise<PortalAuthResult> {
  return authenticatePortalUser({
    email: input.email,
    password: input.password,
    expectedRole: 'shopkeeper',
    redirectTo: '/staff',
  })
}
