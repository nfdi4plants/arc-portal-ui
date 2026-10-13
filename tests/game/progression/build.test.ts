import { describe, expect, it } from 'vitest'
import { createRng } from '../../../src/game/contracts/rng'
import { addXp, applyCard, createBuild, rollOffer, xpForNextLevel } from '../../../src/game/model/progression'

describe('createBuild', () => {
  it('starts at level 1 with the staff in both slots and three offered cards', () => {
    const build = createBuild()
    expect(build).toMatchObject({ level: 1, xp: 0, hp: 100, offerSize: 3, mechanics: [], legendaries: [] })
    expect(build.stats).toMatchObject({ maxHp: 100, moveSpeed: 1, critChance: 0.05, dashCooldownMs: 600, lifesteal: 0 })
    expect(build.weapons).toEqual({ light: { id: 'staff', tier: 1 }, heavy: { id: 'staff', tier: 1 } })
    expect(build.abilitySlots).toEqual([null, null, null, null])
  })
})

describe('xp curve', () => {
  it('needs 20 xp for level 2 and 10 more for each level after that', () => {
    expect([1, 2, 3, 4].map((level) => xpForNextLevel(level))).toEqual([20, 30, 40, 50])
  })
})

describe('addXp', () => {
  it('levels up on an exact fit and keeps no xp', () => {
    expect(addXp(createBuild(), 20)).toMatchObject({ build: { level: 2, xp: 0 }, levelsGained: 1 })
  })

  it('keeps xp below the threshold without leveling up', () => {
    const { build, levelsGained } = addXp(createBuild(), 19)
    expect(levelsGained).toBe(0)
    expect(build).toMatchObject({ level: 1, xp: 19, stats: { maxHp: 100 } })
  })

  it('carries the remainder through several levels and heals 30% of the new max HP each time', () => {
    // 50 -> 83 after the first level (110 max), then 119 after the second (121 max).
    const { build, levelsGained } = addXp({ ...createBuild(), hp: 50 }, 65)
    expect(levelsGained).toBe(2)
    expect(build).toMatchObject({ level: 3, xp: 15, hp: 119, stats: { maxHp: 121 } })
  })
})

describe('input builds', () => {
  it('are never mutated', () => {
    const build = createBuild()
    const snapshot = structuredClone(build)
    addXp(build, 50)
    applyCard(build, 'weapon.wand')
    rollOffer(build, createRng('no-mutation'))
    expect(build).toEqual(snapshot)
  })
})
