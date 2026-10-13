import type { AccessMode, DashboardFilters, ExtraColumn, SearchScope, SortState } from '../../types/dashboard.ts'

export interface DashboardState {
  accessMode: AccessMode
  filters: DashboardFilters
  sort: SortState
  extraColumns: ExtraColumn[]
}

export const initialDashboardState: DashboardState = {
  accessMode: 'accessible',
  filters: { query: '', scope: 'all' },
  sort: { column: 'lastChange', direction: 'DESC' },
  extraColumns: [],
}

export type DashboardAction =
  | { type: 'toggleHub'; value: string }
  | { type: 'toggleGroup'; value: string }
  | { type: 'toggleAccess'; value: 'public' | 'private' }
  | { type: 'clearFilters' }
  | { type: 'removeFilter'; kind: 'hub' | 'group' | 'access' | 'query' }
  | { type: 'setQuery'; query: string }
  | { type: 'setScope'; scope: SearchScope }
  | { type: 'setAccessMode'; mode: AccessMode }
  | { type: 'setSort'; sort: SortState }
  | { type: 'toggleColumn'; column: ExtraColumn }

/** Clicking an active value again clears it. */
function toggle<T>(current: T | undefined, value: T): T | undefined {
  return current === value ? undefined : value
}

export function dashboardReducer(state: DashboardState, action: DashboardAction): DashboardState {
  const { filters } = state
  switch (action.type) {
    case 'toggleHub': return { ...state, filters: { ...filters, hubId: toggle(filters.hubId, action.value) } }
    case 'toggleGroup': return { ...state, filters: { ...filters, groupKey: toggle(filters.groupKey, action.value) } }
    case 'toggleAccess': return { ...state, filters: { ...filters, access: toggle(filters.access, action.value) } }
    case 'clearFilters': return { ...state, filters: { query: '', scope: filters.scope } }
    case 'removeFilter': return { ...state, filters: {
      ...filters,
      hubId: action.kind === 'hub' ? undefined : filters.hubId,
      groupKey: action.kind === 'group' ? undefined : filters.groupKey,
      access: action.kind === 'access' ? undefined : filters.access,
      query: action.kind === 'query' ? '' : filters.query,
    } }
    case 'setQuery': return { ...state, filters: { ...filters, query: action.query } }
    case 'setScope': return { ...state, filters: { ...filters, scope: action.scope } }
    case 'setAccessMode': return { ...state, accessMode: action.mode }
    case 'setSort': return { ...state, sort: action.sort }
    case 'toggleColumn': return { ...state, extraColumns: state.extraColumns.includes(action.column)
      ? state.extraColumns.filter(column => column !== action.column)
      : [...state.extraColumns, action.column] }
  }
}
