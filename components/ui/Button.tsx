'use client'

import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils/format'

export const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl font-semibold',
    'transition-all duration-200 ease-out cursor-pointer select-none',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]',
    'disabled:pointer-events-none disabled:opacity-50',
    'motion-safe:enabled:hover:-translate-y-1 motion-safe:enabled:active:scale-[0.97]',
  ].join(' '),
  {
    variants: {
      variant: {
        primary: [
          'bg-[var(--primary)] text-white shadow-sm',
          'hover:bg-[var(--primary-hover)] hover:shadow-[0_12px_28px_-6px_rgba(122,31,61,0.45)]',
        ].join(' '),
        secondary: [
          'bg-[var(--surface-2)] text-[var(--text)] border border-[var(--border)] shadow-xs',
          'hover:border-[var(--primary)]/40 hover:shadow-[0_10px_24px_-8px_rgba(43,17,23,0.18)]',
        ].join(' '),
        ghost: [
          'bg-transparent text-[var(--text)]',
          'hover:bg-[var(--surface-2)] hover:shadow-[0_8px_18px_-8px_rgba(43,17,23,0.12)]',
        ].join(' '),
        destructive: [
          'bg-[var(--danger)] text-white shadow-sm',
          'hover:brightness-110 hover:shadow-[0_12px_28px_-6px_rgba(179,38,30,0.45)]',
        ].join(' '),
        outline: [
          'border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] shadow-xs',
          'hover:border-[var(--primary)] hover:bg-[var(--primary-soft)]/40 hover:shadow-[0_10px_24px_-8px_rgba(122,31,61,0.22)]',
        ].join(' '),
      },
      size: {
        sm: 'h-9 min-h-[36px] px-3.5 text-xs',
        md: 'h-11 min-h-[44px] px-5 text-sm',
        lg: 'h-12 min-h-[48px] px-6 text-base',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      loading = false,
      disabled,
      children,
      type = 'button',
      ...props
    },
    ref
  ) => {
    if (asChild) {
      return (
        <Slot
          ref={ref}
          className={cn(buttonVariants({ variant, size }), className)}
          aria-busy={loading || undefined}
          {...props}
        >
          {children}
        </Slot>
      )
    }

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      >
        {loading && (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
        )}
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'
