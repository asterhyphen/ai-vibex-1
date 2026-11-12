import { z } from 'zod'

export const CreatePrintJobSchema = z.object({
  file_path: z.string().trim().min(1, 'Uploaded file path is required'),
  original_name: z.string().trim().min(1, 'Filename is required').max(120),
  pages: z.number().int().min(1, 'Minimum 1 page').max(100, 'Maximum 100 pages'),
  color: z.boolean(),
  double_sided: z.boolean(),
  copies: z.number().int().min(1, 'Minimum 1 copy').max(50, 'Maximum 50 copies'),
  paper: z.enum(['A4', 'A3']),
  payment_method: z.enum(['online', 'cash']).default('online'),
})

export type CreatePrintJobInput = z.infer<typeof CreatePrintJobSchema>

export interface PrintRateConfig {
  bwRatePaise: number
  colorRatePaise: number
  a3Multiplier: number
}

export const DEFAULT_PRINT_RATES: PrintRateConfig = {
  bwRatePaise: 200,
  colorRatePaise: 1000,
  a3Multiplier: 2,
}

export function calculatePrintCostPaise(
  params: {
    pages: number
    color: boolean
    double_sided: boolean
    copies: number
    paper: 'A4' | 'A3'
  },
  rates: PrintRateConfig = DEFAULT_PRINT_RATES
): {
  effectivePages: number
  unitRatePaise: number
  paperMultiplier: number
  totalPaise: number
} {
  const effectivePages = params.double_sided
    ? Math.ceil(params.pages / 2)
    : params.pages
  const baseRate = params.color ? rates.colorRatePaise : rates.bwRatePaise
  const paperMultiplier = params.paper === 'A3' ? rates.a3Multiplier : 1
  const unitRatePaise = baseRate * paperMultiplier
  const totalPaise = effectivePages * unitRatePaise * params.copies
  return {
    effectivePages,
    unitRatePaise,
    paperMultiplier,
    totalPaise,
  }
}
