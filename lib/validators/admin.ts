import { z } from 'zod'

export const ADMIN_TABLE_WHITELIST = [
  'orders',
  'print_jobs',
  'menu_items',
  'categories',
  'pickup_slots',
  'profiles',
  'staff_accounts',
  'settings',
  'sms_log',
  'audit_log',
  'login_attempts',
] as const

export type AdminTableName = (typeof ADMIN_TABLE_WHITELIST)[number]

export const READ_ONLY_ADMIN_TABLES: ReadonlySet<AdminTableName> = new Set([
  'sms_log',
  'audit_log',
])

export function isAllowedAdminTable(value: string): value is AdminTableName {
  return (ADMIN_TABLE_WHITELIST as readonly string[]).includes(value)
}

export const CreateShopkeeperSchema = z.object({
  email: z.string().trim().email('Valid email required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  display_name: z.string().trim().min(2, 'Display name is required').max(80),
  counter: z.enum(['canteen', 'print']),
})

export const ResetShopkeeperPasswordSchema = z.object({
  user_id: z.string().uuid('Invalid user ID'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})
