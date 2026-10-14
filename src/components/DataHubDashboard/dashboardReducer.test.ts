import { describe, expect, it } from 'vitest'
import { dashboardReducer, initialDashboardState, type DashboardState } from './dashboardReducer.ts'

const reduce = (state: DashboardState, ...actions: Parameters<typeof dashboardReducer>[1][]) =>
  actions.reduce(dashboardReducer, state)

const withAllFilters = reduce(initialDashboardState,
  { type: 'toggleHub', value: 'a' }, { type: 'toggleGroup', value: 'a/x' })

describe('dashboardReducer', () => {
  it.each([
    ['toggleHub', 'hubId', 'a'],
    ['toggleGroup', 'groupKey', 'a/x'],
  ] as const)('%s sets and then clears %s', (type, field, value) => {
    const action = { type, value } as Parameters<typeof dashboardReducer>[1]
    const once = reduce(initialDashboardState, action)
    expect(once.filters[field]).toBe(value)
    expect(reduce(once, action).filters[field]).toBeUndefined()
  })

  it('toggleRecent sets and clears recent', () => {
    expect(initialDashboardState.filters.recent).toBe(false)
    const on = reduce(initialDashboardState, { type: 'toggleRecent' })
    expect(on.filters.recent).toBe(true)
    expect(reduce(on, { type: 'toggleRecent' }).filters.recent).toBe(false)
  })

  it('clearFilters resets filters, the query and recent', () => {
    const state = reduce(initialDashboardState,
      { type: 'toggleHub', value: 'a' }, { type: 'toggleGroup', value: 'a/x' },
      { type: 'setQuery', query: 'rice' }, { type: 'toggleRecent' }, { type: 'clearFilters' })
    expect(state.filters).toEqual({ query: '', recent: false })
  })

  it.each([
    ['hub', 'hubId', { groupKey: 'a/x' }],
    ['group', 'groupKey', { hubId: 'a' }],
  ] as const)('removeFilter(%s) clears only that filter', (kind, field, remaining) => {
    const state = reduce(withAllFilters, { type: 'removeFilter', kind })
    expect(state.filters[field]).toBeUndefined()
    expect(state.filters).toMatchObject(remaining)
  })

  it('removeFilter(query) clears the query', () => {
    const state = reduce(initialDashboardState, { type: 'setQuery', query: 'rice' }, { type: 'removeFilter', kind: 'query' })
    expect(state.filters.query).toBe('')
  })

  it('removeFilter(recent) clears recent', () => {
    const state = reduce(initialDashboardState, { type: 'toggleRecent' }, { type: 'removeFilter', kind: 'recent' })
    expect(state.filters.recent).toBe(false)
  })

  it('setSort replaces the sort', () => {
    const sort = { column: 'title', direction: 'ASC' } as const
    expect(reduce(initialDashboardState, { type: 'setSort', sort }).sort).toEqual(sort)
  })
})