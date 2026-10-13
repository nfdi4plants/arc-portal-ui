import type { ArcSummary, CountItem, HeadlineNumbers, MonthCount } from '../../../types/dashboard.ts'

export type { CountItem, HeadlineNumbers, MonthCount } from '../../../types/dashboard.ts'

export function headlineNumbers(arcs: ArcSummary[]): HeadlineNumbers {
  const publicCount = arcs.filter(arc => arc.access === 'public').length
  return {
    total: arcs.length,
    public: publicCount,
    private: arcs.length - publicCount,
    hubs: new Set(arcs.map(arc => arc.hubId)).size,
    people: null,
  }
}

/** `hubNames` disambiguates group labels that repeat across DataHUBs via `title`. */
export function countBy(arcs: ArcSummary[], by: 'hub' | 'group', labels: Map<string, string>, hubNames?: Map<string, string>): CountItem[] {
  const counts = new Map<string, number>()
  for (const arc of arcs) {
    const key = by === 'hub' ? arc.hubId : arc.group.key
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const items = [...counts].map(([key, count]) => ({ key, label: labels.get(key) ?? key, count }))
  const labelKeys = new Map<string, Set<string>>()
  for (const item of items) {
    if (!labelKeys.has(item.label)) labelKeys.set(item.label, new Set())
    labelKeys.get(item.label)!.add(item.key)
  }
  const repeatedLabels = new Set([...labelKeys].filter(([, keys]) => keys.size > 1).map(([label]) => label))
  return items
    .map(item => {
      if (by === 'group' && repeatedLabels.has(item.label) && hubNames) {
        const hubName = hubNames.get(item.key.split('/')[0])
        if (hubName) return { ...item, title: `${item.label} on ${hubName}` }
      }
      return item
    })
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
}

function monthKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

/** `months` entries ending with `now`'s month, zero-filled, by creation date. */
export function arcsPerMonth(arcs: ArcSummary[], now: Date, months: number): MonthCount[] {
  const counts = new Map<string, number>()
  for (let offset = months - 1; offset >= 0; offset--) {
    counts.set(monthKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1))), 0)
  }
  for (const arc of arcs) {
    const date = new Date(arc.createdAt)
    if (Number.isNaN(date.getTime())) continue
    const key = monthKey(date)
    if (counts.has(key)) counts.set(key, counts.get(key)! + 1)
  }
  return [...counts].map(([month, count]) => ({ month, count }))
}
