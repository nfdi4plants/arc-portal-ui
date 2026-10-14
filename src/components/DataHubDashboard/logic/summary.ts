import type { ArcSummary, CountItem } from '../../../types/dashboard.ts'

/** `hubNames` disambiguates group labels that repeat across DataHUBs via `title`. */
export function countByGroup(arcs: ArcSummary[], labels: Map<string, string>, hubNames?: Map<string, string>): CountItem[] {
  const counts = new Map<string, number>()
  for (const arc of arcs) {
    const key = arc.group.key
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
      if (repeatedLabels.has(item.label) && hubNames) {
        const hubName = hubNames.get(item.key.split('/')[0])
        if (hubName) return { ...item, title: `${item.label} on ${hubName}` }
      }
      return item
    })
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
}
