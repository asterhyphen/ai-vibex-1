import { z } from 'zod'

export const CartItemSchema = z.object({
  menuItemId: z.string().uuid('Invalid menu item ID'),
  name: z.string().min(1).optional(),
  price_paise: z.number().int().positive().optional(),
  qty: z
    .number()
    .int('Quantity must be a whole number')
    .min(1, 'Quantity must be at least 1')
    .max(50, 'Maximum 50 per item'),
  prep_seconds: z.number().int().nonnegative().optional(),
})

export const CheckoutSchema = z.object({
  slot_id: z.string().uuid('Please select a valid pickup slot'),
  eta_minutes: z
    .number()
    .int('ETA must be a whole number')
    .min(1, 'ETA must be at least 1 minute')
    .max(60, 'ETA cannot exceed 60 minutes'),
  payment_method: z.enum(['online', 'cash']),
  note: z.string().trim().max(250, 'Note must be under 250 characters').optional(),
})

export const CreateOrderSchema = z
  .object({
    source: z.enum(['app', 'guest']).default('app'),
    guest_name: z.string().trim().min(1).max(80).optional(),
    slot_id: z.string().uuid('Please select a valid pickup slot').nullable().optional(),
    eta_minutes: z
      .number()
      .int('ETA must be a whole number')
      .min(1, 'ETA must be at least 1 minute')
      .max(60, 'ETA cannot exceed 60 minutes')
      .nullable()
      .optional(),
    payment_method: z.enum(['online', 'cash']),
    note: z.string().trim().max(250, 'Note must be under 250 characters').optional(),
    items: z
      .array(CartItemSchema)
      .min(1, 'Cart cannot be empty')
      .max(30, 'Too many distinct items'),
  })
  .superRefine((data, ctx) => {
    if (data.source === 'app') {
      if (!data.slot_id) {
        ctx.addIssue({
          code: 'custom',
          path: ['slot_id'],
          message: 'Please select a valid pickup slot',
        })
      }
      if (typeof data.eta_minutes !== 'number') {
        ctx.addIssue({
          code: 'custom',
          path: ['eta_minutes'],
          message: 'Please select your arrival ETA',
        })
      }
    }
  })

export const PlainLanguageOrderSchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, 'Please describe what you would like to order')
    .max(500, 'Order description must be 500 characters or fewer'),
})

export type CartItemInput = z.infer<typeof CartItemSchema>
export type CheckoutInput = z.infer<typeof CheckoutSchema>
export type CreateOrderInput = z.infer<typeof CreateOrderSchema>
export type PlainLanguageOrderInput = z.infer<typeof PlainLanguageOrderSchema>
