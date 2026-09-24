/** Small formatting helpers shared across the UI. */

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/**
 * "just now", "12m ago", "3h ago", "yesterday", then an actual date.
 *
 * Relative time is friendly for recent edits and useless for old ones -
 * "just now" tells you something, "417 days ago" does not.
 */
export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return ''
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''

  const elapsed = Date.now() - then
  if (elapsed < 0) return 'just now'
  if (elapsed < MINUTE) return 'just now'
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)}m ago`
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)}h ago`
  if (elapsed < 2 * DAY) return 'yesterday'
  if (elapsed < 7 * DAY) return `${Math.floor(elapsed / DAY)}d ago`

  return new Date(then).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year:
      new Date(then).getFullYear() === new Date().getFullYear()
        ? undefined
        : 'numeric',
  })
}

/** Full timestamp, for a tooltip behind the relative one. */
export function absoluteTime(iso: string | null | undefined): string {
  if (!iso) return ''
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString()
}

export function pluralize(count: number, singular: string, plural?: string): string {
  return `${count} ${count === 1 ? singular : (plural ?? `${singular}s`)}`
}

/** Trim to a word boundary, with an ellipsis. */
export function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text
  const cut = text.slice(0, maxChars)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > maxChars * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`
}
