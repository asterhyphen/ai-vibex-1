import * as React from 'react'
import { cn } from '@/lib/utils/format'

export interface BrandQMarkProps extends React.SVGProps<SVGSVGElement> {
  size?: number
}

/**
 * SkipQ logo mark: a circular ivory & burgundy plate with a
 * burnished gold spoon angled across the lower-right rim to form "Q".
 */
export function BrandQMark({
  size = 40,
  className,
  ...props
}: BrandQMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={cn('shrink-0 select-none', className)}
      {...props}
    >
      {/* Circular plate */}
      <circle
        cx="29"
        cy="29"
        r="21"
        fill="var(--surface)"
        stroke="var(--primary)"
        strokeWidth="5"
      />
      <circle
        cx="29"
        cy="29"
        r="14"
        fill="var(--bg)"
        stroke="var(--accent-gold, #B8893B)"
        strokeWidth="1.75"
        strokeOpacity="0.85"
      />
      <path
        d="M 15.5 21 A 15 15 0 0 1 28 14"
        stroke="var(--surface)"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.7"
      />

      {/* Angled spoon forming the Q tail */}
      <g transform="translate(36 36) rotate(45)">
        <path
          d="M -13 0 C -13 -3.8 -8 -5.2 -3 -4.6 C 0.5 -4.1 2 -1.7 4 -1.6 L 20.5 -2.2 C 22.4 -2.2 23.6 -1.2 23.6 0 C 23.6 1.2 22.4 2.2 20.5 2.2 L 4 1.6 C 2 1.7 0.5 4.1 -3 4.6 C -8 5.2 -13 3.8 -13 0 Z"
          fill="var(--accent-gold, #B8893B)"
          stroke="var(--primary)"
          strokeWidth="2.1"
          strokeLinejoin="round"
        />
        <ellipse
          cx="-6"
          cy="-1.2"
          rx="3.6"
          ry="1.4"
          fill="var(--surface)"
          opacity="0.45"
        />
      </g>
    </svg>
  )
}
