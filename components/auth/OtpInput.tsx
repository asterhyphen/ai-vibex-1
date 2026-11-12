'use client'

import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'

interface OtpInputProps {
  value: string
  onChange: (value: string) => void
  onComplete?: (value: string) => void
  disabled?: boolean
  error?: boolean
  autoFocus?: boolean
  length?: number
  idPrefix?: string
}

export function OtpInput({
  value,
  onChange,
  onComplete,
  disabled = false,
  error = false,
  autoFocus = true,
  length = 4,
  idPrefix = 'otp-box',
}: OtpInputProps) {
  const inputRefs = useRef<Array<HTMLInputElement | null>>([])

  const digits = Array.from({ length }, (_, index) => value[index] ?? '')

  useEffect(() => {
    if (autoFocus && !disabled) {
      inputRefs.current[0]?.focus()
    }
  }, [autoFocus, disabled])

  const emitChange = (nextDigits: string[]) => {
    const joined = nextDigits.join('').slice(0, length)
    onChange(joined)
    if (joined.length === length && !joined.includes('') && /^\d+$/.test(joined)) {
      onComplete?.(joined)
    }
  }

  const handleInputChange = (index: number, raw: string) => {
    if (disabled) return
    const cleaned = raw.replace(/\D/g, '')

    // Handle multi-digit input (e.g., OS SMS autofill or fast paste into input)
    if (cleaned.length > 1) {
      const next = [...digits]
      for (let i = 0; i < length - index && i < cleaned.length; i++) {
        next[index + i] = cleaned[i]
      }
      emitChange(next)
      const nextFocus = Math.min(index + cleaned.length, length - 1)
      inputRefs.current[nextFocus]?.focus()
      return
    }

    const digit = cleaned.slice(-1)
    const next = [...digits]
    next[index] = digit
    emitChange(next)

    if (digit && index < length - 1) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handleKeyDown = (index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return

    if (event.key === 'Backspace') {
      event.preventDefault()
      const next = [...digits]
      if (next[index]) {
        next[index] = ''
        emitChange(next)
      } else if (index > 0) {
        next[index - 1] = ''
        emitChange(next)
        inputRefs.current[index - 1]?.focus()
      }
      return
    }

    if (event.key === 'ArrowLeft' && index > 0) {
      event.preventDefault()
      inputRefs.current[index - 1]?.focus()
      return
    }

    if (event.key === 'ArrowRight' && index < length - 1) {
      event.preventDefault()
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handlePaste = (index: number, event: React.ClipboardEvent<HTMLInputElement>) => {
    if (disabled) return
    event.preventDefault()
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '')
    if (!pasted) return

    const next = [...digits]
    const startIndex = pasted.length >= length ? 0 : index
    for (let i = 0; i < pasted.length && startIndex + i < length; i++) {
      next[startIndex + i] = pasted[i]
    }
    emitChange(next)

    const targetIndex = Math.min(startIndex + pasted.length, length - 1)
    inputRefs.current[targetIndex]?.focus()
  }

  return (
    <motion.div
      animate={error ? { x: [0, -8, 8, -6, 6, -3, 3, 0] } : { x: 0 }}
      transition={{ duration: 0.38 }}
      className="flex items-center justify-center gap-2 sm:gap-3"
      role="group"
      aria-label={`${length}-digit verification code`}
    >
      {digits.map((digit, index) => {
        const isFilled = digit !== ''
        return (
          <input
            key={`${idPrefix}-${index}`}
            ref={(el) => {
              inputRefs.current[index] = el
            }}
            id={`${idPrefix}-${index}`}
            type="text"
            inputMode="numeric"
            autoComplete={index === 0 ? 'one-time-code' : 'off'}
            pattern="[0-9]*"
            maxLength={length}
            value={digit}
            disabled={disabled}
            aria-label={`Digit ${index + 1} of ${length}`}
            onChange={(e) => handleInputChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onPaste={(e) => handlePaste(index, e)}
            onFocus={(e) => e.currentTarget.select()}
            className={`h-13 w-11 min-h-[44px] min-w-[44px] sm:h-14 sm:w-12 rounded-xl border-2 text-center text-xl font-bold tracking-tight transition-all outline-none select-all ${
              error
                ? 'border-[var(--danger)] bg-[var(--danger)]/10 text-[var(--danger)]'
                : isFilled
                ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--text)]'
                : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text)]'
            } focus:border-[var(--primary)] focus:ring-3 focus:ring-[var(--primary)]/20 disabled:opacity-50 disabled:cursor-not-allowed`}
          />
        )
      })}
    </motion.div>
  )
}
