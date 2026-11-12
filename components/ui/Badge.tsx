import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils/format'
import type { OrderStatus, PrintStatus } from '@/lib/types'

export type AllStatus = OrderStatus | PrintStatus

type BadgeVariant =
  | 'default'
  | 'primary'
  | 'accent'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'muted'

const STATUS_CONFIG: Record<
  AllStatus,
  { label: string; variant: BadgeVariant; pulse?: boolean }
> = {
  placed: { label: 'Placed', variant: 'primary' },
  awaiting_cash: { label: 'Awaiting Cash', variant: 'warning', pulse: true },
  accepted: { label: 'Accepted', variant: 'info' },
  preparing: { label: 'Preparing', variant: 'accent', pulse: true },
  ready: { label: 'Ready', variant: 'success', pulse: true },
  collected: { label: 'Collected', variant: 'muted' },
  cancelled: { label: 'Cancelled', variant: 'muted' },
  rejected: { label: 'Rejected', variant: 'danger' },
  uploaded: { label: 'Uploaded', variant: 'info' },
  paid: { label: 'Paid', variant: 'primary' },
  printing: { label: 'Printing', variant: 'accent', pulse: true },
}

export const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold leading-tight tracking-tight whitespace-nowrap',
  {
    variants: {
      variant: {
        default:
          'border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)]',
        primary:
          'border-[var(--primary)]/25 bg-[var(--primary-soft)] text-[var(--primary)]',
        accent:
          'border-[var(--accent)]/30 bg-[var(--accent)]/12 text-[var(--accent)]',
        success:
          'border-[var(--success)]/30 bg-[var(--success)]/12 text-[var(--success)]',
        warning:
          'border-[var(--warning)]/30 bg-[var(--warning)]/12 text-[var(--warning)]',
        danger:
          'border-[var(--danger)]/30 bg-[var(--danger)]/12 text-[var(--danger)]',
        info:
          'border-[var(--info)]/30 bg-[var(--info)]/12 text-[var(--info)]',
        muted:
          'border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-muted)]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  status?: AllStatus
  dot?: boolean
  pulse?: boolean
}

export function Badge({
  className,
  variant,
  status,
  dot,
  pulse,
  children,
  ...props
}: BadgeProps) {
  const statusInfo = status ? STATUS_CONFIG[status] : undefined
  const resolvedVariant = variant ?? statusInfo?.variant ?? 'default'
  const showDot = dot ?? Boolean(statusInfo)
  const shouldPulse = pulse ?? statusInfo?.pulse ?? false

  return (
    <span
      className={cn(badgeVariants({ variant: resolvedVariant }), className)}
      {...props}
    >
      {showDot && (
        <span
          aria-hidden="true"
          className={cn(
            'h-1.5 w-1.5 rounded-full bg-current',
            shouldPulse && 'animate-pulse'
          )}
        />
      )}
      {children ?? statusInfo?.label}
    </span>
  )
}
