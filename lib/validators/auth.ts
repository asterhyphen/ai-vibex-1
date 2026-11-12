import { z } from 'zod'

export const ALLOWED_EMAIL_DOMAIN = 'mite.ac.in'

const MITE_EMAIL_REGEX = /^[a-z0-9._%+-]+@mite\.ac\.in$/

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase()
}

/**
 * Strictly validates that the normalized email ends with exact `@mite.ac.in`
 * and uses ASCII local-part characters to block lookalike/homoglyph domains.
 */
export function isValidMiteEmail(raw: string): boolean {
  const email = normalizeEmail(raw)
  if (!MITE_EMAIL_REGEX.test(email)) return false
  const parts = email.split('@')
  if (parts.length !== 2) return false
  const [local, domain] = parts
  if (!local || local.startsWith('.') || local.endsWith('.') || local.includes('..')) {
    return false
  }
  return domain === ALLOWED_EMAIL_DOMAIN
}

export function deriveRoleFromEmail(raw: string): 'student' | 'faculty' {
  const email = normalizeEmail(raw)
  const local = email.split('@')[0] ?? ''
  return local.startsWith('4mt') ? 'student' : 'faculty'
}

export const MiteEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('Enter a valid email address')
  .refine(isValidMiteEmail, {
    message: 'Only @mite.ac.in emails allowed',
  })

export const EmailRequestSchema = z.object({
  email: MiteEmailSchema,
})

export const OtpVerifySchema = z.object({
  email: MiteEmailSchema,
  token: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'Enter the 6-digit verification code'),
})

export const IndianPhoneSchema = z
  .string()
  .trim()
  .regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number')

export const PhoneRequestSchema = z.object({
  phone: IndianPhoneSchema,
})

export const PhoneOtpVerifySchema = z.object({
  phone: IndianPhoneSchema,
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'Enter the 6-digit verification code'),
})

export const PortalLoginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})
