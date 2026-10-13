import type { ArcSummary, DashboardFilters, DetailsMap } from '../../../types/dashboard.ts'

const RECENT_WINDOW_DAYS = 30

/** `details` (people) takes part in matching once contributors are loaded. */
export function matchesSearch(arc: ArcSummary, query: string, _details?: DetailsMap): boolean {
  const needle = query.trim().toLowerCase()
  if (!needle) return true
  const has = (text: string) => text.toLowerCase().includes(needle)
  return has(arc.title) || has(arc.description) || has(arc.group.label) || arc.topics.some(has)
}

/** `ignore` drops the hub or group filter, so its own bar chart still lists the alternatives. */
export function applyFilters(
  arcs: ArcSummary[], filters: DashboardFilters, details?: DetailsMap, options: { now?: Date; ignore?: 'hub' | 'group' } = {},
): ArcSummary[] {
  const cutoff = options.now
    ? options.now.getTime() - RECENT_WINDOW_DAYS * 24 * 60 * 60 * 1000
    : Number.NEGATIVE_INFINITY
  return arcs.filter(arc =>
    (options.ignore === 'hub' || filters.hubId === undefined || arc.hubId === filters.hubId)
    && (options.ignore === 'group' || filters.groupKey === undefined || arc.group.key === filters.groupKey)
    && (filters.access === undefined || arc.access === filters.access)
    && (!filters.recent || new Date(arc.lastActivityAt).getTime() >= cutoff)
    && matchesSearch(arc, filters.query, details))
}