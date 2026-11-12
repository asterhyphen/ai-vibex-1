import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formats paise into Indian Rupee display string.
 * e.g. 4000 -> "₹40", 4550 -> "₹45.50"
 */
export function formatPaise(paise: number | null | undefined): string {
  const safe = Number.isFinite(paise) ? Number(paise) : 0
  const rupees = safe / 100
  if (Number.isInteger(rupees)) {
    return `₹${rupees}`
  }
  return `₹${rupees.toFixed(2)}`
}

/**
 * Formats preparation seconds into a compact badge string.
 * e.g. 300 -> "~5 min", 90 -> "~2 min"
 */
export function formatPrepTime(seconds: number | null | undefined): string {
  const safe = Number.isFinite(seconds) ? Number(seconds) : 300
  const mins = Math.max(1, Math.round(safe / 60))
  return `~${mins} min`
}

/**
 * Formats an ISO timestamp into HH:MM AM/PM in local/IST time.
 */
export function formatSlotTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '--:--'
  return date.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

/**
 * Formats a short 24h-ish or compact range "08:00 – 08:10"
 */
export function formatSlotRange(startIso: string, endIso: string): string {
  const start = new Date(startIso)
  const end = new Date(endIso)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 'Slot'
  const fmt = (d: Date) =>
    d.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
  return `${fmt(start)} – ${fmt(end)}`
}

/**
 * Derives a deterministic 6-digit manual fallback OTP from an order's token or id/code.
 */
export function deriveOrderOtp(seed: string): string {
  let hash = 2166136261
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  const num = Math.abs(hash) % 900000 + 100000
  return String(num)
}

/**
 * Returns greeting based on current hour.
 */
export function getTimeGreeting(date: Date = new Date()): string {
  const hour = date.getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

/**
 * Extracts "back_at:<time>" from menu_items.tags if staff set a restock ETA.
 */
export function extractBackAtTag(tags: string[] | null | undefined): string | null {
  if (!Array.isArray(tags)) return null
  const found = tags.find((t) => typeof t === 'string' && t.startsWith('back_at:'))
  if (!found) return null
  const value = found.slice('back_at:'.length).trim()
  return value || null
}

/**
 * Returns human-readable tags excluding internal metadata tags like "back_at:*".
 */
export function filterDisplayTags(tags: string[] | null | undefined): string[] {
  if (!Array.isArray(tags)) return []
  return tags.filter((t) => typeof t === 'string' && !t.startsWith('back_at:'))
}
