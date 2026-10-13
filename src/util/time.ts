const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 86_400], ['month', 30 * 86_400], ['week', 7 * 86_400],
  ['day', 86_400], ['hour', 3_600], ['minute', 60],
]

/** "5 minutes ago", "yesterday", "2 years ago"; `now` is injected so tests are deterministic. */
export function relativeTime(iso: string, now: Date): string {
  const seconds = Math.max(0, (now.getTime() - new Date(iso).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const [unit, size] = UNITS.find(([, size]) => seconds >= size)!
  return formatter.format(-Math.floor(seconds / size), unit)
}
