import { describe, expect, it } from 'vitest'
import { dashboardReducer, initialDashboardState, type DashboardState } from './dashboardReducer.ts'

const reduce = (state: DashboardState, ...actions: Parameters<typeof dashboardReducer>[1][]) =>
  actions.reduce(dashboardReducer, state)

const withAllFilters = reduce(initialDashboardState,
  { type: 'toggleHub', value: 'a' }, { type: 'toggleGroup', value: 'a/x' }, { type: 'toggleAccess', value: 'private' })

describe('dashboardReducer', () => {
  it.each([
    ['toggleHub', 'hubId', 'a'],
    ['toggleGroup', 'groupKey', 'a/x'],
    ['toggleAccess', 'access', 'public'],
  ] as const)('%s sets and then clears %s', (type, field, value) => {
    const action = { type, value } as Parameters<typeof dashboardReducer>[1]
    const once = reduce(initialDashboardState, action)
    expect(once.filters[field]).toBe(value)
    expect(reduce(once, action).filters[field]).toBeUndefined()
  })

  it('clearFilters resets filters and the query but keeps the search scope', () => {
    const state = reduce(initialDashboardState,
      { type: 'toggleHub', value: 'a' }, { type: 'toggleGroup', value: 'a/x' }, { type: 'toggleAccess', value: 'private' },
      { type: 'setScope', scope: 'topic' }, { type: 'setQuery', query: 'rice' }, { type: 'clearFilters' })
    expect(state.filters).toEqual({ query: '', scope: 'topic' })
  })

  it.each([
    ['hub', 'hubId', { groupKey: 'a/x', access: 'private' }],
    ['group', 'groupKey', { hubId: 'a', access: 'private' }],
    ['access', 'access', { hubId: 'a', groupKey: 'a/x' }],
  ] as const)('removeFilter(%s) clears only that filter', (kind, field, remaining) => {
    const state = reduce(withAllFilters, { type: 'removeFilter', kind })
    expect(state.filters[field]).toBeUndefined()
    expect(state.filters).toMatchObject(remaining)
  })

  it('removeFilter(query) clears the query', () => {
    const state = reduce(initialDashboardState, { type: 'setQuery', query: 'rice' }, { type: 'removeFilter', kind: 'query' })
    expect(state.filters.query).toBe('')
  })

  it('setSort replaces the sort', () => {
    const sort = { column: 'title', direction: 'ASC' } as const
    expect(reduce(initialDashboardState, { type: 'setSort', sort }).sort).toEqual(sort)
  })
})
