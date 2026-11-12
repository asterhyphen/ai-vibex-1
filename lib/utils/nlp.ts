import Fuse from 'fuse.js'
import type { MenuItem } from '@/lib/types'

export interface ParsedItem {
  menuItem: MenuItem | null
  qty: number
  matched: boolean
  originalText: string
}

const NUMBER_WORDS: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  couple: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  dozen: 12,
}

const FILLER_WORDS = new Set([
  'please',
  'pls',
  'plz',
  'i',
  'id',
  "i'd",
  'want',
  'wanted',
  'like',
  'need',
  'give',
  'get',
  'can',
  'could',
  'order',
  'add',
  'have',
  'bring',
  'me',
  'us',
  'to',
  'for',
  'some',
  'of',
  'the',
  'just',
  'maybe',
  'also',
])

const QTY_MARKER_RE = /^__qty_(\d+)__$/

/**
 * Normalizes multi-word and single-word quantity expressions into lowercase __qty_N__ tokens
 * so clause splitting and token parsing handle natural phrases cleanly.
 */
function normalizeQuantities(raw: string): string {
  let normalized = raw.toLowerCase()

  // Multi-word number phrases first (longest phrases first)
  normalized = normalized
    .replace(/\bhalf\s+a\s+dozen\b(\s+of\b)?/g, ' __qty_6__ ')
    .replace(/\bhalf\s+dozen\b(\s+of\b)?/g, ' __qty_6__ ')
    .replace(/\ba\s+couple\s+of\b/g, ' __qty_2__ ')
    .replace(/\bcouple\s+of\b/g, ' __qty_2__ ')
    .replace(/\ba\s+dozen\b(\s+of\b)?/g, ' __qty_12__ ')
    .replace(/\bdozen\s+of\b/g, ' __qty_12__ ')

  // Prefix / suffix multiplier patterns: "2x", "x2", "3 x"
  normalized = normalized
    .replace(/\b(\d{1,2})\s*x\b/g, (_, n) => ` __qty_${parseInt(n, 10)}__ `)
    .replace(/\bx\s*(\d{1,2})\b/g, (_, n) => ` __qty_${parseInt(n, 10)}__ `)

  // Standalone integer numbers
  normalized = normalized.replace(/\b(\d{1,2})\b/g, (_, n) => {
    const val = parseInt(n, 10)
    return val > 0 ? ` __qty_${val}__ ` : ` ${n} `
  })

  // Single number words ("one".."ten", "a", "an", "couple", "dozen")
  normalized = normalized.replace(
    /\b(dozen|couple|one|two|three|four|five|six|seven|eight|nine|ten|an|a)\b/g,
    (word) => {
      const val = NUMBER_WORDS[word]
      return val ? ` __qty_${val}__ ` : ` ${word} `
    }
  )

  return normalized.replace(/\s+/g, ' ').trim()
}

function parseQtyToken(token: string): number | null {
  const match = token.match(QTY_MARKER_RE)
  if (!match) return null
  const num = parseInt(match[1], 10)
  return Number.isFinite(num) && num > 0 ? Math.min(50, num) : 1
}

function stripFillers(words: string[]): string[] {
  return words.filter((w) => !FILLER_WORDS.has(w))
}

function singularizeToken(word: string): string {
  if (word.length > 4 && (word.endsWith('samosas') || word.endsWith('dosas'))) {
    return word.slice(0, -1)
  }
  if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss')) {
    return word.slice(0, -1)
  }
  return word
}

interface RawSegment {
  qty: number
  queryWords: string[]
  originalText: string
}

function splitIntoSegments(text: string): RawSegment[] {
  const rawClauses = text
    .split(/[,;\n+&/]+|\b(?:and|plus|with|also)\b/i)
    .map((c) => c.trim())
    .filter(Boolean)

  const segments: RawSegment[] = []

  for (const clause of rawClauses) {
    const normalized = normalizeQuantities(clause)
    const tokens = normalized
      .replace(/[^a-z0-9_\s'-]/g, ' ')
      .split(/\s+/)
      .filter(Boolean)

    let currentQty = 1
    let hasExplicitQty = false
    let currentWords: string[] = []

    const flushSegment = () => {
      const meaningful = stripFillers(currentWords)
      if (meaningful.length > 0) {
        const displayQty = hasExplicitQty ? `${currentQty}x ` : ''
        segments.push({
          qty: currentQty,
          queryWords: meaningful,
          originalText: `${displayQty}${meaningful.join(' ')}`.trim(),
        })
      }
      currentQty = 1
      hasExplicitQty = false
      currentWords = []
    }

    for (const token of tokens) {
      const qtyVal = parseQtyToken(token)
      if (qtyVal !== null) {
        if (stripFillers(currentWords).length > 0) {
          flushSegment()
        }
        currentQty = qtyVal
        hasExplicitQty = true
      } else {
        currentWords.push(token)
      }
    }

    if (stripFillers(currentWords).length === 0 && hasExplicitQty && segments.length > 0) {
      segments[segments.length - 1].qty = currentQty
    } else {
      flushSegment()
    }
  }

  return segments
}

/**
 * Parses a natural-language canteen order into matched menu items and unmatched fragments.
 * Uses Fuse.js fuzzy matching with threshold 0.4 against menu item names.
 */
export function parseNaturalOrder(text: string, menuItems: MenuItem[]): ParsedItem[] {
  const trimmed = text.trim()
  if (!trimmed) return []

  const activeItems = menuItems.filter((item) => item.is_active !== false)
  const fuse = new Fuse(activeItems, {
    keys: ['name'],
    threshold: 0.4,
    includeScore: true,
    ignoreLocation: true,
    minMatchCharLength: 2,
  })

  const findBestMatch = (query: string): { item: MenuItem; score: number } | null => {
    const clean = query.trim()
    if (clean.length < 2) return null

    const direct = fuse.search(clean)
    if (direct.length > 0 && (direct[0].score ?? 1) <= 0.4) {
      return { item: direct[0].item, score: direct[0].score ?? 0 }
    }

    const singularized = clean.split(' ').map(singularizeToken).join(' ')
    if (singularized !== clean) {
      const singularHits = fuse.search(singularized)
      if (singularHits.length > 0 && (singularHits[0].score ?? 1) <= 0.4) {
        return { item: singularHits[0].item, score: singularHits[0].score ?? 0 }
      }
    }

    return null
  }

  const segments = splitIntoSegments(trimmed)
  const rawResults: ParsedItem[] = []

  for (const seg of segments) {
    const phrase = seg.queryWords.join(' ')
    const wholeHit = findBestMatch(phrase)

    if (wholeHit) {
      rawResults.push({
        menuItem: wholeHit.item,
        qty: seg.qty,
        matched: true,
        originalText: seg.originalText,
      })
      continue
    }

    if (seg.queryWords.length > 1) {
      const words = seg.queryWords
      let idx = 0
      let matchedAny = false

      while (idx < words.length) {
        let matchedSpan = 0
        let matchedItem: MenuItem | null = null

        for (let len = Math.min(4, words.length - idx); len >= 1; len -= 1) {
          const candidate = words.slice(idx, idx + len).join(' ')
          const hit = findBestMatch(candidate)
          if (hit) {
            matchedSpan = len
            matchedItem = hit.item
            break
          }
        }

        if (matchedItem && matchedSpan > 0) {
          matchedAny = true
          rawResults.push({
            menuItem: matchedItem,
            qty: idx === 0 ? seg.qty : 1,
            matched: true,
            originalText: words.slice(idx, idx + matchedSpan).join(' '),
          })
          idx += matchedSpan
        } else {
          const unmatchedStart = idx
          idx += 1
          while (idx < words.length) {
            let nextHit = false
            for (let len = Math.min(4, words.length - idx); len >= 1; len -= 1) {
              if (findBestMatch(words.slice(idx, idx + len).join(' '))) {
                nextHit = true
                break
              }
            }
            if (nextHit) break
            idx += 1
          }
          const unknownPhrase = words.slice(unmatchedStart, idx).join(' ')
          rawResults.push({
            menuItem: null,
            qty: 1,
            matched: false,
            originalText: unknownPhrase,
          })
        }
      }

      if (matchedAny) continue
    }

    rawResults.push({
      menuItem: null,
      qty: seg.qty,
      matched: false,
      originalText: phrase,
    })
  }

  const merged: ParsedItem[] = []
  const matchedById = new Map<string, ParsedItem>()

  for (const entry of rawResults) {
    if (entry.matched && entry.menuItem) {
      const existing = matchedById.get(entry.menuItem.id)
      if (existing) {
        existing.qty = Math.min(50, existing.qty + entry.qty)
        existing.originalText = `${existing.originalText}, ${entry.originalText}`
      } else {
        const clone = { ...entry }
        matchedById.set(entry.menuItem.id, clone)
        merged.push(clone)
      }
    } else {
      merged.push(entry)
    }
  }

  return merged
}
