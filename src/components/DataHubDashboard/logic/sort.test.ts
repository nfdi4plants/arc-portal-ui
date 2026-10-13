import { describe, expect, it } from 'vitest'
import { sortArcs } from './sort.ts'
import { arcSummary } from '../../../test/helpers.tsx'

const hubNames = new Map([['a', 'Alpha'], ['b', 'Beta']])
const arcs = [
  arcSummary({ title: 'banana', hubId: 'b', lastActivityAt: '2026-01-01T00:00:00Z' }),
  arcSummary({ title: 'Apple', hubId: 'b', lastActivityAt: '2026-03-01T00:00:00Z' }),
  arcSummary({ title: 'cherry', hubId: 'a', lastActivityAt: '2026-02-01T00:00:00Z' }),
]
const titles = (sorted: typeof arcs) => sorted.map(arc => arc.title)

describe('sortArcs', () => {
  it('sorts by last change, newest first', () => {
    expect(titles(sortArcs(arcs, { column: 'lastChange', direction: 'DESC' }, hubNames))).toEqual(['Apple', 'cherry', 'banana'])
    expect(titles(sortArcs(arcs, { column: 'lastChange', direction: 'ASC' }, hubNames))).toEqual(['banana', 'cherry', 'Apple'])
  })

  it('sorts titles case-insensitively', () => {
    expect(titles(sortArcs(arcs, { column: 'title', direction: 'ASC' }, hubNames))).toEqual(['Apple', 'banana', 'cherry'])
  })

  it('sorts by DataHUB name, newest first within a DataHUB', () => {
    expect(titles(sortArcs(arcs, { column: 'hub', direction: 'ASC' }, hubNames))).toEqual(['cherry', 'Apple', 'banana'])
  })

  it('keeps newest first within a DataHUB when sorting DataHUB names descending', () => {
    expect(titles(sortArcs(arcs, { column: 'hub', direction: 'DESC' }, hubNames))).toEqual(['Apple', 'banana', 'cherry'])
  })

  it('does not mutate its input', () => {
    const before = [...arcs]
    sortArcs(arcs, { column: 'title', direction: 'DESC' }, hubNames)
    expect(arcs).toEqual(before)
  })
})
