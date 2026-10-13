import { describe, expect, it } from 'vitest'
import { applyFilters, matchesSearch, visibleArcs } from './filters.ts'
import type { DashboardFilters } from '../../../types/dashboard.ts'
import { arcSummary } from '../../../test/helpers.tsx'

const arcs = [arcSummary({ title: 'open' }), arcSummary({ title: 'closed', access: 'private' })]

describe('visibleArcs', () => {
  it('drops private ARCs in public mode', () => {
    expect(visibleArcs(arcs, 'public').map(arc => arc.title)).toEqual(['open'])
  })

  it('keeps every ARC in accessible mode', () => {
    expect(visibleArcs(arcs, 'accessible')).toEqual(arcs)
  })
})

const group = (key: string, label: string) => ({ key, label, hubId: 'a', personal: false })
const catalogue = [
  arcSummary({ title: 'Rice drought', hubId: 'a', group: group('a/x', 'Crop Lab'), access: 'public', description: 'Water stress', topics: ['transcriptomics'] }),
  arcSummary({ title: 'Wheat yield', hubId: 'a', group: group('a/y', 'Wheat Lab'), access: 'private', description: 'Field trial of rice-like traits', topics: [] }),
  arcSummary({ title: 'Maize', hubId: 'b', group: group('b/x', 'Crop Lab'), access: 'public', description: '', topics: ['proteomics'] }),
]
const filters = (overrides: Partial<DashboardFilters> = {}): DashboardFilters => ({ query: '', scope: 'all', ...overrides })
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
    expect(titles(applyFilters(catalogue, filters({ query: 'wheat', scope: 'title' })))).toEqual(['Wheat yield'])
  })
})

describe('matchesSearch', () => {
  const [rice, wheat] = catalogue

  it('is case-insensitive and trims the input', () => {
    expect(matchesSearch(rice, '  RICE ', 'title')).toBe(true)
  })

  it('matches everything for an empty query', () => {
    expect(matchesSearch(rice, '   ', 'title')).toBe(true)
  })

  it('limits a title search to the title', () => {
    expect(matchesSearch(wheat, 'rice', 'title')).toBe(false)
    expect(matchesSearch(wheat, 'rice', 'description')).toBe(true)
  })

  it('searches the working group label', () => {
    expect(matchesSearch(rice, 'crop', 'group')).toBe(true)
    expect(matchesSearch(rice, 'wheat', 'group')).toBe(false)
  })

  it('searches any topic', () => {
    expect(matchesSearch(rice, 'transcript', 'topic')).toBe(true)
    expect(matchesSearch(rice, 'proteomics', 'topic')).toBe(false)
  })

  it('searches title, description, group and topics under Everything', () => {
    expect(matchesSearch(rice, 'rice', 'all')).toBe(true)
    expect(matchesSearch(rice, 'water', 'all')).toBe(true)
    expect(matchesSearch(rice, 'crop lab', 'all')).toBe(true)
    expect(matchesSearch(rice, 'transcriptomics', 'all')).toBe(true)
    expect(matchesSearch(rice, 'nothing', 'all')).toBe(false)
  })
})
