import type { ArcSummary } from '../../../types/dashboard.ts'

export interface HeadlineNumbers {
  total: number
  public: number
  private: number
  hubs: number
  /** Filled in once contributor details are loaded. */
  people: number | null
}

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

export interface CountItem { key: string; label: string; count: number }

/** `labels` maps a hub id or group key to its display name. */
export function countBy(arcs: ArcSummary[], by: 'hub' | 'group', labels: Map<string, string>): CountItem[] {
  const counts = new Map<string, number>()
  for (const arc of arcs) {
    const key = by === 'hub' ? arc.hubId : arc.group.key
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return [...counts]
    .map(([key, count]) => ({ key, label: labels.get(key) ?? key, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
}

export interface MonthCount { month: string; count: number }

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
