import { describe, expect, it } from 'vitest'
import { addXp, applyCard, createBuild, levelUpSummary } from '../../../src/game/model/progression'

describe('levelUpSummary', () => {
  it('shows the new level, the max HP gained and the heal of one level', () => {
    const before = { ...createBuild(), hp: 64 }
    const { build: after } = addXp(before, 25)
    const summary = levelUpSummary(before, after)
    expect(summary).toMatchObject({ fromLevel: 1, toLevel: 2, xp: 5, xpToNext: 30 })
    expect(summary.rows).toEqual([
      { label: 'Max HP', from: 100, to: 110, unit: '', change: '+10' },
      { label: 'HP', from: 64, to: 97, unit: '', change: '+33 healed' },
    ])
  })

  it('adds up several levels gained at once', () => {
    const before = { ...createBuild(), hp: 40 }
    // 20 + 30 + 40 xp: three levels at once.
    const { build: after, levelsGained } = addXp(before, 90)
    expect(levelsGained).toBe(3)
    const summary = levelUpSummary(before, after)
    expect(summary.fromLevel).toBe(1)
    expect(summary.toLevel).toBe(4)
    expect(summary.rows[0]).toMatchObject({ from: 100, to: after.stats.maxHp, change: `+${after.stats.maxHp - 100}` })
    expect(summary.rows[1]).toMatchObject({ from: 40, to: after.hp, change: `+${after.hp - 40} healed` })
    expect(summary.xp).toBe(0)
    expect(summary.xpToNext).toBe(50)
  })

  it('shows the legendary chance growing while no legendary is owned', () => {
    const before = addXp(createBuild(), 20).build
    const after = addXp(before, 30).build
    expect(levelUpSummary(before, after).rows[2]).toEqual({ label: 'Legendary chance', from: 0.5, to: 4.5, unit: '%', change: 'per card' })
  })

  it('leaves the legendary chance out once a legendary is owned or while it does not change', () => {
    const level1 = createBuild()
    expect(levelUpSummary(level1, addXp(level1, 20).build).rows.map((row) => row.label)).toEqual(['Max HP', 'HP'])
    const withLegendary = applyCard(addXp(level1, 20).build, 'legendary.peerReview')
    const rows = levelUpSummary(withLegendary, addXp(withLegendary, 30).build).rows
    expect(rows.map((row) => row.label)).toEqual(['Max HP', 'HP'])
  })
})
