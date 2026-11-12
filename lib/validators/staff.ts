import { z } from 'zod'

export const OrderStatusActionSchema = z.object({
  action: z.enum(['accept', 'start_preparing', 'ready', 'reject']),
  reason: z.string().trim().max(300, 'Reason must be under 300 characters').optional(),
})

export const CashCollectSchema = z.object({
  cash_received_paise: z
    .number()
    .int('Cash received must be an integer in paise')
    .nonnegative('Cash received cannot be negative'),
})

export const QrScanSchema = z.union([
  z.object({
    qr_token: z.string().trim().min(1, 'QR token is required'),
    kind: z.enum(['order', 'print']).optional(),
  }),
  z.object({
    code: z.string().trim().min(1, 'Order or Job code is required'),
    otp: z.string().trim().regex(/^\d{6}$/, 'OTP must be 6 digits'),
    kind: z.enum(['order', 'print']).optional(),
  }),
])

export const StockUpdateSchema = z.object({
  in_stock: z.boolean(),
  back_at: z.string().trim().max(40).optional().nullable(),
})

export const PrintStatusActionSchema = z.object({
  action: z.enum(['start_printing', 'ready', 'reject']),
  reason: z.string().trim().max(300).optional(),
})
