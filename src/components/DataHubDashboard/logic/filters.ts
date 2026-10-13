import type { AccessMode, ArcSummary, DashboardFilters, DetailsMap, SearchScope } from '../../../types/dashboard.ts'

export function visibleArcs(arcs: ArcSummary[], accessMode: AccessMode): ArcSummary[] {
  return accessMode === 'public' ? arcs.filter(arc => arc.access === 'public') : arcs
}

/** `details` (people) takes part in matching once contributors are loaded. */
export function matchesSearch(arc: ArcSummary, query: string, scope: SearchScope, _details?: DetailsMap): boolean {
  const needle = query.trim().toLowerCase()
  if (!needle) return true
  const has = (text: string) => text.toLowerCase().includes(needle)
  switch (scope) {
    case 'title': return has(arc.title)
    case 'description': return has(arc.description)
    case 'group': return has(arc.group.label)
    case 'topic': return arc.topics.some(has)
    case 'person': return false
    case 'all': return has(arc.title) || has(arc.description) || has(arc.group.label) || arc.topics.some(has)
  }
}

/** `ignore` drops the hub or group filter, so its own bar chart still lists the alternatives. */
export function applyFilters(
  arcs: ArcSummary[], filters: DashboardFilters, details?: DetailsMap, options: { ignore?: 'hub' | 'group' } = {},
): ArcSummary[] {
  return arcs.filter(arc =>
    (options.ignore === 'hub' || filters.hubId === undefined || arc.hubId === filters.hubId)
    && (options.ignore === 'group' || filters.groupKey === undefined || arc.group.key === filters.groupKey)
    && (filters.access === undefined || arc.access === filters.access)
    && matchesSearch(arc, filters.query, filters.scope, details))
}
