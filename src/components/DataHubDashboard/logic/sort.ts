import type { ArcSummary, SortState } from '../../../types/dashboard.ts'

function byLastChange(a: ArcSummary, b: ArcSummary) {
  return a.lastActivityAt.localeCompare(b.lastActivityAt)
}

export function sortArcs(arcs: ArcSummary[], sort: SortState, hubNames: Map<string, string>): ArcSummary[] {
  const hubName = (arc: ArcSummary) => hubNames.get(arc.hubId) ?? arc.hubId
  const direction = sort.direction === 'ASC' ? 1 : -1
  const compare = (a: ArcSummary, b: ArcSummary) => {
    switch (sort.column) {
      case 'title': return direction * a.title.localeCompare(b.title, undefined, { sensitivity: 'base' })
      // The tie-break is always newest first, whatever the direction.
      case 'hub': return direction * hubName(a).localeCompare(hubName(b)) || -byLastChange(a, b)
      case 'lastChange': return direction * byLastChange(a, b)
    }
  }
  return [...arcs].sort(compare)
}
