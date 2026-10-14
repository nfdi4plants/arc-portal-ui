import { describe, expect, it } from 'vitest'
import { createRng } from '../../../src/game/contracts/rng'
import { bossCoinDrop, COIN_DROP, mobCoinDrop } from '../../../src/game/model/progression'
import type { CoinSource } from '../../../src/game/model/progression/coins'

const mob = (size: CoinSource['size'], segmentIndex = 0, phantom = false): CoinSource => ({ size, segmentIndex, phantom })

function drops(source: CoinSource, count: number, seed: string): number[] {
  const rng = createRng(seed)
  return Array.from({ length: count }, (_, i) => mobCoinDrop(source, rng.fork(String(i))))
}

const average = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length

describe('mob coin drops', () => {
  it('drops nothing most of the time and never more than three', () => {
    const values = drops(mob('medium'), 4000, 'medium')
    const dropped = values.filter((value) => value > 0).length / values.length
    expect(dropped).toBeGreaterThan(COIN_DROP.chance - 0.04)
    expect(dropped).toBeLessThan(COIN_DROP.chance + 0.04)
    expect(Math.max(...values)).toBeLessThanOrEqual(3)
  })

  it('gives a large mob at least two coins when it drops', () => {
    for (const value of drops(mob('large'), 1000, 'large')) expect(value === 0 || value >= 2).toBe(true)
  })

  it('pays a little more deeper down the path', () => {
    expect(average(drops(mob('medium', 4), 4000, 'deep'))).toBeGreaterThan(average(drops(mob('medium', 0), 4000, 'shallow')))
  })

  it('lets a phantom drop one coin at most, and more rarely', () => {
    const values = drops(mob('large', 3, true), 4000, 'phantom')
    expect(Math.max(...values)).toBe(1)
    expect(average(values)).toBeLessThan(COIN_DROP.chance)
  })

  it('is the same for the same seed', () => {
    expect(drops(mob('small', 2), 50, 'again')).toEqual(drops(mob('small', 2), 50, 'again'))
  })
})

describe('boss coin drops', () => {
  it('always drops a handful, more for later bosses', () => {
    const rng = createRng('boss')
    for (let i = 0; i < 200; i++) expect(bossCoinDrop(0, rng)).toBeGreaterThanOrEqual(COIN_DROP.bossBase)
    expect(bossCoinDrop(3, createRng('late'))).toBeGreaterThan(bossCoinDrop(0, createRng('late')))
  })
})
