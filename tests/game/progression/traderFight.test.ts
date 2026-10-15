import { describe, expect, it } from 'vitest'
import { createRng } from '../../../src/game/contracts/rng'
import {
  applyCard,
  applyLoot,
  CARDS,
  createBuild,
  createStrikeState,
  HOSTILE_STRIKE,
  STRIKE_WINDOW_MS,
  strikeAt,
  TRADER_FIGHT_LINES,
  TRADER_HP_FACTOR,
  TRADER_WARNINGS,
  traderBonus,
  traderBuild,
} from '../../../src/game/model/progression'

const LEGENDARY_AUGMENTS = CARDS.filter((card) => card.kind === 'legendary')
const LEGENDARY_WEAPONS = CARDS.filter((card) => card.kind === 'weapon' && card.rarity === 'legendary')
const COMMON_IDS = new Set(CARDS.filter((card) => card.rarity === 'common').map((card) => card.id))

describe('strikes on the FAIR trader', () => {
  it('count a multi-hit attack once, and every hit keeps the strike going', () => {
    const state = createStrikeState()
    expect(strikeAt(state, 1000)).toBe(1)
    // A flame cone: four pulses 100 ms apart, then an echo 150 ms later.
    for (const ms of [1100, 1200, 1300, 1450]) expect(strikeAt(state, ms)).toBe(0)
    expect(state.strikes).toBe(1)
    expect(strikeAt(state, 1450 + STRIKE_WINDOW_MS)).toBe(2)
  })

  it('escalate through three warnings to the hostile fourth, and count nothing after it', () => {
    const state = createStrikeState()
    const strikes = [0, 1, 2, 3, 4, 5].map((i) => strikeAt(state, i * 1000))
    expect(strikes).toEqual([1, 2, 3, HOSTILE_STRIKE, 0, 0])
    expect(HOSTILE_STRIKE).toBe(4)
  })

  it('have several warnings per stage, short enough for a speech bubble', () => {
    for (const stage of [1, 2, 3] as const) {
      expect(TRADER_WARNINGS[stage].length).toBeGreaterThanOrEqual(4)
      for (const line of TRADER_WARNINGS[stage]) expect(line.length).toBeLessThanOrEqual(70)
    }
    for (const lines of Object.values(TRADER_FIGHT_LINES)) {
      expect(lines.length).toBeGreaterThanOrEqual(4)
      for (const line of lines) expect(line.length).toBeLessThanOrEqual(60)
    }
  })
})

describe('the trader as a fighter', () => {
  it('holds a legendary weapon at full power in each slot and every legendary augment', () => {
    const build = traderBuild(4, createRng('trader'))
    for (const slot of ['light', 'heavy'] as const) {
      const card = LEGENDARY_WEAPONS.find((entry) => entry.id === `weapon.${build.weapons[slot].id}`)
      expect(card?.slot).toBe(slot)
      expect(build.weapons[slot].tier).toBe(2)
    }
    expect([...build.legendaries].sort()).toEqual(LEGENDARY_AUGMENTS.map((card) => card.id.slice('legendary.'.length)).sort())
    expect(build.abilitySlots).toEqual(expect.arrayContaining(['gitRevert', 'peerPressure', 'labCoat']))
  })

  it('takes only common cards for his levels, one per level gained', () => {
    for (const level of [1, 3, 6]) {
      const build = traderBuild(level, createRng(`commons/${level}`))
      expect(build.level).toBe(level)
      expect(build.mechanics).toEqual([])
      expect(build.corrupted).toEqual([])
      // Rebuild the stats from the same draws: the only stat changes are commons and level-up hp.
      let replay = createBuild()
      const rng = createRng(`commons/${level}`)
      replay = applyCard(replay, rng.pick(LEGENDARY_WEAPONS.filter((card) => card.slot === 'light')).id)
      replay = applyCard(replay, rng.pick(LEGENDARY_WEAPONS.filter((card) => card.slot === 'heavy')).id)
      for (const card of LEGENDARY_AUGMENTS) replay = applyCard(replay, card.id)
      const picks: string[] = []
      for (let next = 2; next <= level; next++) {
        replay = { ...replay, level: next, stats: { ...replay.stats, maxHp: Math.round(replay.stats.maxHp * 1.1) } }
        const commons = CARDS.filter((card) => COMMON_IDS.has(card.id))
        const usable = commons.filter((card) => applyCard(replay, card.id) !== replay)
        const pick = rng.pick(usable)
        picks.push(pick.id)
        replay = applyCard(replay, pick.id)
      }
      expect(picks.every((id) => COMMON_IDS.has(id))).toBe(true)
      expect(picks).toHaveLength(level - 1)
      expect(build.stats.maxHp).toBe(Math.round(replay.stats.maxHp * TRADER_HP_FACTOR))
    }
  })

  it('has the hp of a mage of his level, raised by the factor, and starts at full health', () => {
    const level = 5
    const build = traderBuild(level, createRng('hp'))
    const levelled = [2, 3, 4, 5].reduce((hp) => Math.round(hp * 1.1), 100)
    expect(build.stats.maxHp).toBeGreaterThanOrEqual(Math.round(levelled * TRADER_HP_FACTOR))
    expect(build.hp).toBe(build.stats.maxHp)
  })

  it('is the same trader for the same seed', () => {
    expect(traderBuild(4, createRng('same'))).toEqual(traderBuild(4, createRng('same')))
  })
})

describe('the loot of a beaten trader', () => {
  it('applies the unsold stock like purchases, skipping what no longer fits', () => {
    const stock = ['stat.sharpened', 'weapon.wand', 'mechanic.doubleJump'].map((id) => CARDS.find((card) => card.id === id)!)
    const { build, applied } = applyLoot(createBuild(), stock)
    expect(applied.map((card) => card.id)).toEqual(['stat.sharpened', 'weapon.wand', 'mechanic.doubleJump'])
    expect(build.level).toBe(1)
    expect(build.stats.maxHp).toBe(100)
    const full = { ...createBuild(), mechanics: ['doubleJump' as const] }
    expect(applyLoot(full, stock).applied.map((card) => card.id)).toEqual(['stat.sharpened', 'weapon.wand'])
  })

  it('adds one legendary augment or legendary weapon the mage lacks and the stock did not hold', () => {
    const owned = applyCard(applyCard(createBuild(), 'legendary.gitRevert'), 'weapon.gitLfs')
    const stockIds = ['legendary.theOntology', 'weapon.arcitect']
    for (let i = 0; i < 40; i++) {
      const bonus = traderBonus(owned, stockIds, createRng(`bonus/${i}`))
      expect(bonus).not.toBeNull()
      expect(bonus?.rarity).toBe('legendary')
      expect(['legendary.gitRevert', 'weapon.gitLfs', ...stockIds]).not.toContain(bonus?.id)
    }
  })

  it('has no bonus once the mage holds everything left', () => {
    let build = createBuild()
    for (const card of LEGENDARY_AUGMENTS) build = applyCard(build, card.id)
    const weapons = LEGENDARY_WEAPONS.map((card) => card.id)
    // Both legendary weapons of each slot are taken or were in stock.
    build = applyCard(applyCard(build, 'weapon.arcitect'), 'weapon.gitLfs')
    expect(traderBonus(build, ['weapon.arcCommander', 'weapon.publicationPress'], createRng('none'))).toBeNull()
    expect(weapons).toHaveLength(4)
  })
})
