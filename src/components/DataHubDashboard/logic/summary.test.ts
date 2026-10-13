import { describe, expect, it } from 'vitest'
import { arcsPerMonth, countBy, headlineNumbers } from './summary.ts'
import { arcSummary } from '../../../test/helpers.tsx'

const group = (key: string, label: string) => ({ key, label, hubId: 'a', personal: false })

describe('headlineNumbers', () => {
  it('counts totals, access levels and distinct DataHUBs', () => {
    const arcs = [
      arcSummary({ hubId: 'a' }),
      arcSummary({ hubId: 'a', access: 'private' }),
      arcSummary({ hubId: 'b' }),
    ]
    expect(headlineNumbers(arcs)).toEqual({ total: 3, public: 2, private: 1, hubs: 2, people: null })
  })
})

describe('countBy', () => {
  const arcs = [
    arcSummary({ hubId: 'a', group: group('a/x', 'X') }),
    arcSummary({ hubId: 'b', group: group('a/y', 'Y') }),
    arcSummary({ hubId: 'b', group: group('a/z', 'A group') }),
    arcSummary({ hubId: 'b', group: group('a/z', 'A group') }),
  ]

  it('counts by DataHUB, largest first', () => {
    expect(countBy(arcs, 'hub', new Map([['a', 'Alpha'], ['b', 'Beta']]))).toEqual([
      { key: 'b', label: 'Beta', count: 3 },
      { key: 'a', label: 'Alpha', count: 1 },
    ])
  })

  it('breaks ties by label', () => {
    const labels = new Map([['a/x', 'X'], ['a/y', 'Y'], ['a/z', 'A group']])
    expect(countBy(arcs, 'group', labels).map(item => item.label)).toEqual(['A group', 'X', 'Y'])
  })

  it('titles group labels that repeat across DataHUBs with the hub name', () => {
    const labels = new Map([['a/x', 'CEPLAS'], ['b/x', 'CEPLAS']])
    const hubNames = new Map([['a', 'Alpha'], ['b', 'Beta']])
    const items = countBy([
      arcSummary({ hubId: 'a', group: group('a/x', 'CEPLAS') }),
      arcSummary({ hubId: 'b', group: group('b/x', 'CEPLAS') }),
    ], 'group', labels, hubNames)
    expect(items).toEqual([
      { key: 'a/x', label: 'CEPLAS', title: 'CEPLAS on Alpha', count: 1 },
      { key: 'b/x', label: 'CEPLAS', title: 'CEPLAS on Beta', count: 1 },
    ])
  })

  it('leaves labels unique to one DataHUB without a title', () => {
    const items = countBy(arcs, 'group', new Map([['a/x', 'X'], ['a/y', 'Y'], ['a/z', 'A group']]))
    expect(items.every(item => !('title' in item))).toBe(true)
  })
})

describe('arcsPerMonth', () => {
  const now = new Date('2026-10-13T12:00:00Z')

  it('returns 12 zero-filled months ending with the current month', () => {
    const months = arcsPerMonth([arcSummary({ createdAt: '2026-10-02T00:00:00Z' }), arcSummary({ createdAt: '2026-08-31T00:00:00Z' })], now, 12)
    expect(months).toHaveLength(12)
    expect(months[0]).toEqual({ month: '2025-11', count: 0 })
    expect(months[9]).toEqual({ month: '2026-08', count: 1 })
    expect(months[11]).toEqual({ month: '2026-10', count: 1 })
  })

  it('ignores ARCs outside the window', () => {
    const months = arcsPerMonth([
      arcSummary({ createdAt: '2025-10-31T00:00:00Z' }),
      arcSummary({ createdAt: '2026-11-01T00:00:00Z' }),
      arcSummary({ createdAt: '' }),
    ], now, 12)
    expect(months.every(month => month.count === 0)).toBe(true)
  })
})
