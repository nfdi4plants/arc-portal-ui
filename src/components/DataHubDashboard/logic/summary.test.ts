import { describe, expect, it } from 'vitest'
import { countByGroup } from './summary.ts'
import { arcSummary } from '../../../test/helpers.tsx'

const group = (key: string, label: string) => ({ key, label, hubId: 'a', personal: false })

describe('countByGroup', () => {
  const arcs = [
    arcSummary({ hubId: 'a', group: group('a/x', 'X') }),
    arcSummary({ hubId: 'b', group: group('a/y', 'Y') }),
    arcSummary({ hubId: 'b', group: group('a/z', 'A group') }),
    arcSummary({ hubId: 'b', group: group('a/z', 'A group') }),
  ]

  it('breaks ties by label', () => {
    const labels = new Map([['a/x', 'X'], ['a/y', 'Y'], ['a/z', 'A group']])
    expect(countByGroup(arcs, labels).map(item => item.label)).toEqual(['A group', 'X', 'Y'])
  })

  it('titles group labels that repeat across DataHUBs with the hub name', () => {
    const labels = new Map([['a/x', 'CEPLAS'], ['b/x', 'CEPLAS']])
    const hubNames = new Map([['a', 'Alpha'], ['b', 'Beta']])
    const items = countByGroup([
      arcSummary({ hubId: 'a', group: group('a/x', 'CEPLAS') }),
      arcSummary({ hubId: 'b', group: group('b/x', 'CEPLAS') }),
    ], labels, hubNames)
    expect(items).toEqual([
      { key: 'a/x', label: 'CEPLAS', title: 'CEPLAS on Alpha', count: 1 },
      { key: 'b/x', label: 'CEPLAS', title: 'CEPLAS on Beta', count: 1 },
    ])
  })

  it('leaves labels unique to one DataHUB without a title', () => {
    const items = countByGroup(arcs, new Map([['a/x', 'X'], ['a/y', 'Y'], ['a/z', 'A group']]))
    expect(items.every(item => !('title' in item))).toBe(true)
  })
})
