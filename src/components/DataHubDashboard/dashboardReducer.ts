import type { DashboardFilters, ExtraColumn, FilterKind, SortState } from '../../types/dashboard.ts'

export interface DashboardState {
  filters: DashboardFilters
  sort: SortState
  extraColumns: ExtraColumn[]
}

export const initialDashboardState: DashboardState = {
  filters: { query: '', recent: false },
  sort: { column: 'lastChange', direction: 'DESC' },
  extraColumns: [],
}

export type DashboardAction =
  | { type: 'toggleHub'; value: string }
  | { type: 'toggleGroup'; value: string }
  | { type: 'clearFilters' }
  | { type: 'removeFilter'; kind: FilterKind }
  | { type: 'setQuery'; query: string }
  | { type: 'toggleRecent' }
  | { type: 'setSort'; sort: SortState }
  | { type: 'toggleColumn'; column: ExtraColumn }

/** Clicking an active value again clears it. */
function toggle<T>(current: T | undefined, value: T): T | undefined {
  return current === value ? undefined : value
}

export function dashboardReducer(state: DashboardState, action: DashboardAction): DashboardState {
  const { filters } = state
  switch (action.type) {
    case 'toggleHub': {
      const hubId = toggle(filters.hubId, action.value)
      return { ...state, filters: {
        ...filters, hubId,
        // A group from another DataHUB is no longer selectable after switching hubs.
        groupKey: hubId !== undefined && !filters.groupKey?.startsWith(`${hubId}/`) ? undefined : filters.groupKey,
      } }
    }
    case 'toggleGroup': return { ...state, filters: { ...filters, groupKey: toggle(filters.groupKey, action.value) } }
    case 'clearFilters': return { ...state, filters: { query: '', recent: false } }
    case 'removeFilter': return { ...state, filters: {
      ...filters,
      hubId: action.kind === 'hub' ? undefined : filters.hubId,
      groupKey: action.kind === 'group' ? undefined : filters.groupKey,
      query: action.kind === 'query' ? '' : filters.query,
      recent: action.kind === 'recent' ? false : filters.recent,
    } }
    case 'setQuery': return { ...state, filters: { ...filters, query: action.query } }
    case 'toggleRecent': return { ...state, filters: { ...filters, recent: !filters.recent } }
    case 'setSort': return { ...state, sort: action.sort }
    case 'toggleColumn': return { ...state, extraColumns: state.extraColumns.includes(action.column)
      ? state.extraColumns.filter(column => column !== action.column)
      : [...state.extraColumns, action.column] }
  }
}
