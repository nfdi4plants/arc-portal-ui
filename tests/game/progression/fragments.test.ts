import { describe, expect, it } from 'vitest'
import { createRng } from '../../../src/game/contracts/rng'
import { bossFragmentDrop, FRAGMENT_DROP, fragmentChance, mobFragmentDrop, type FragmentSource } from '../../../src/game/model/progression'

const mob = (size: FragmentSource['size'], segmentIndex = 0, phantom = false, accession: string | null = 'OBI:0000070'): FragmentSource => ({
  size,
  segmentIndex,
  phantom,
  source: { accession },
})

function drops(source: FragmentSource, count: number, seed: string): number[] {
  const rng = createRng(seed)
  return Array.from({ length: count }, (_, i) => mobFragmentDrop(source, rng.fork(String(i))))
}

const average = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length
const dropShare = (values: number[]) => values.filter((value) => value > 0).length / values.length

describe('mob fragment drops', () => {
  it('drops nothing most of the time and never more than three', () => {
    const values = drops(mob('medium'), 4000, 'medium')
    expect(dropShare(values)).toBeGreaterThan(FRAGMENT_DROP.termChance - 0.04)
    expect(dropShare(values)).toBeLessThan(FRAGMENT_DROP.termChance + 0.04)
    expect(Math.max(...values)).toBeLessThanOrEqual(3)
  })

  it('drops more often from a mob whose annotation has an ontology term', () => {
    expect(fragmentChance(mob('medium'))).toBeGreaterThan(fragmentChance(mob('medium', 0, false, null)))
    const term = dropShare(drops(mob('small'), 4000, 'term'))
    const freeText = dropShare(drops(mob('small', 0, false, null), 4000, 'free'))
    expect(freeText).toBeGreaterThan(FRAGMENT_DROP.freeTextChance - 0.04)
    expect(freeText).toBeLessThan(FRAGMENT_DROP.freeTextChance + 0.04)
    expect(term - freeText).toBeGreaterThan(0.12)
  })

  it('pays about the old flat 40% on a well-annotated path', () => {
    // About four in five annotations of the Talinum ARC have an accession.
    const mixed = 0.8 * FRAGMENT_DROP.termChance + 0.2 * FRAGMENT_DROP.freeTextChance
    expect(mixed).toBeGreaterThan(0.37)
    expect(mixed).toBeLessThan(0.44)
  })

  it('gives a large mob at least two fragments when it drops', () => {
    for (const value of drops(mob('large'), 1000, 'large')) expect(value === 0 || value >= 2).toBe(true)
  })

  it('pays a little more deeper down the path', () => {
    expect(average(drops(mob('medium', 4), 4000, 'deep'))).toBeGreaterThan(average(drops(mob('medium', 0), 4000, 'shallow')))
  })

  it('lets a phantom drop one fragment at most, and more rarely', () => {
    const values = drops(mob('large', 3, true), 4000, 'phantom')
    expect(Math.max(...values)).toBe(1)
    expect(average(values)).toBeLessThan(FRAGMENT_DROP.freeTextChance)
  })

  it('is the same for the same seed', () => {
    expect(drops(mob('small', 2), 50, 'again')).toEqual(drops(mob('small', 2), 50, 'again'))
  })
})

describe('boss fragment drops', () => {
  it('always drops a handful, more for later bosses', () => {
    const rng = createRng('boss')
    for (let i = 0; i < 200; i++) expect(bossFragmentDrop(0, rng)).toBeGreaterThanOrEqual(FRAGMENT_DROP.bossBase)
    expect(bossFragmentDrop(3, createRng('late'))).toBeGreaterThan(bossFragmentDrop(0, createRng('late')))
  })
})
