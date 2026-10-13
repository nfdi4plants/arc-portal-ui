import { describe, expect, it } from 'vitest'
import { applyFilters, matchesSearch } from './filters.ts'
import type { DashboardFilters } from '../../../types/dashboard.ts'
import { arcSummary } from '../../../test/helpers.tsx'

const group = (key: string, label: string) => ({ key, label, hubId: 'a', personal: false })
const catalogue = [
  arcSummary({ title: 'Rice drought', hubId: 'a', group: group('a/x', 'Crop Lab'), access: 'public', description: 'Water stress', topics: ['transcriptomics'] }),
  arcSummary({ title: 'Wheat yield', hubId: 'a', group: group('a/y', 'Wheat Lab'), access: 'private', description: 'Field trial of rice-like traits', topics: [] }),
  arcSummary({ title: 'Maize', hubId: 'b', group: group('b/x', 'Crop Lab'), access: 'public', description: '', topics: ['proteomics'] }),
]
const filters = (overrides: Partial<DashboardFilters> = {}): DashboardFilters => ({ query: '', recent: false, ...overrides })
const titles = (items: typeof catalogue) => items.map(arc => arc.title)

describe('applyFilters', () => {
  it('combines hub, group and access with AND', () => {
    expect(titles(applyFilters(catalogue, filters({ hubId: 'a' })))).toEqual(['Rice drought', 'Wheat yield'])
    expect(titles(applyFilters(catalogue, filters({ hubId: 'a', access: 'public' })))).toEqual(['Rice drought'])
    expect(titles(applyFilters(catalogue, filters({ groupKey: 'b/x', hubId: 'a' })))).toEqual([])
  })

  it('can ignore the hub or group filter while keeping the rest', () => {
    const active = filters({ hubId: 'a', groupKey: 'a/x', access: 'public' })
    expect(titles(applyFilters(catalogue, active, undefined, { ignore: 'hub' }))).toEqual(['Rice drought'])
    expect(titles(applyFilters(catalogue, filters({ hubId: 'b', access: 'private' }), undefined, { ignore: 'hub' }))).toEqual(['Wheat yield'])
    expect(titles(applyFilters(catalogue, filters({ groupKey: 'a/y', hubId: 'b' }), undefined, { ignore: 'group' }))).toEqual(['Maize'])
  })

  it('applies the search query', () => {
    expect(titles(applyFilters(catalogue, filters({ query: 'wheat' })))).toEqual(['Wheat yield'])
  })

  it('keeps only ARCs changed within the last 30 days when recent is set', () => {
    const now = new Date('2026-10-13T12:00:00Z')
    const changed = [
      arcSummary({ title: 'Fresh', lastActivityAt: '2026-09-14T12:00:00Z' }),
      arcSummary({ title: 'Stale', lastActivityAt: '2026-09-12T12:00:00Z' }),
      arcSummary({ title: 'Barely', lastActivityAt: '2026-10-13T11:59:59Z' }),
    ]
    expect(titles(applyFilters(changed, filters({ recent: true }), undefined, { now }))).toEqual(['Fresh', 'Barely'])
  })

  it('keeps every ARC when recent is off', () => {
    const now = new Date('2026-10-13T12:00:00Z')
    const changed = [
      arcSummary({ title: 'Fresh', lastActivityAt: '2026-09-14T12:00:00Z' }),
      arcSummary({ title: 'Stale', lastActivityAt: '2026-09-12T12:00:00Z' }),
    ]
    expect(titles(applyFilters(changed, filters(), undefined, { now }))).toEqual(['Fresh', 'Stale'])
  })
})

describe('matchesSearch', () => {
  const [rice, wheat] = catalogue

  it('is case-insensitive and trims the input', () => {
    expect(matchesSearch(rice, '  RICE ')).toBe(true)
  })

  it('matches everything for an empty query', () => {
    expect(matchesSearch(rice, '   ')).toBe(true)
  })

  it('searches title, description, group label and topics', () => {
    expect(matchesSearch(rice, 'rice')).toBe(true)
    expect(matchesSearch(rice, 'water')).toBe(true)
    expect(matchesSearch(rice, 'crop lab')).toBe(true)
    expect(matchesSearch(rice, 'transcriptomics')).toBe(true)
    expect(matchesSearch(wheat, 'rice')).toBe(true)
    expect(matchesSearch(rice, 'nothing')).toBe(false)
  })
})