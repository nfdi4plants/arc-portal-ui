import { describe, expect, it } from 'vitest'
import type { PlayerBuild } from '../../../src/game/contracts/progression'
import { createRng } from '../../../src/game/contracts/rng'
import { addXp, applyCard, bossFragmentDrop, buyCard, canApply, CARDS, createBuild, mobFragmentDrop, PRICES, priceOf, rollStock, STOCK_SIZE, stockState } from '../../../src/game/model/progression'
import type { FragmentSource } from '../../../src/game/model/progression'

const card = (id: string) => {
  const found = CARDS.find((entry) => entry.id === id)
  if (!found) throw new Error(id)
  return found
}

// Four abilities fill every slot, so no further ability card can apply.
const fullSlots = (): PlayerBuild =>
  ['mechanic.parry', 'mechanic.familiar', 'mechanic.centrifugeSpin', 'mechanic.fumeHood'].reduce((build, id) => applyCard(build, id), createBuild())

describe('store prices', () => {
  it('rise with the rarity', () => {
    expect(PRICES.common).toBeLessThan(PRICES.uncommon)
    expect(PRICES.uncommon).toBeLessThan(PRICES.rare)
    expect(PRICES.rare).toBeLessThan(PRICES.legendary)
    expect(priceOf(card('stat.sharpened'))).toBe(PRICES.common)
    expect(priceOf(card('legendary.gitRevert'))).toBe(PRICES.legendary)
  })

  it('makes a first trader visit buy a common or an uncommon, but not a rare', () => {
    // A typical first stretch has about eight mobs of mixed sizes, most of them with an ontology
    // term (the first step of the Talinum ARC has 10 of 13).
    const sizes: FragmentSource['size'][] = ['small', 'medium', 'large', 'medium', 'small', 'large', 'medium', 'small']
    const accessions = ['OBI:1', 'PO:2', 'OBI:3', null, 'UO:4', 'PO:5', null, 'NCIT:6']
    const totals = Array.from({ length: 2000 }, (_, run) => {
      const rng = createRng(`run-${run}`)
      const mobs = sizes.reduce(
        (sum, size, i) => sum + mobFragmentDrop({ size, segmentIndex: 0, phantom: false, source: { accession: accessions[i] } }, rng.fork(`mob-${i}`)),
        0,
      )
      return mobs + bossFragmentDrop(0, rng.fork('boss'))
    })
    const mean = totals.reduce((sum, total) => sum + total, 0) / totals.length
    expect(mean).toBeGreaterThanOrEqual(PRICES.uncommon)
    expect(mean).toBeLessThan(PRICES.rare)
    // The same income as the flat 40% drop chance gave: 10 drop chances at 0.4 plus 7 from the boss.
    expect(mean).toBeGreaterThan(10.4)
    expect(mean).toBeLessThan(11.6)
  })
})

describe('rollStock', () => {
  it('stocks four distinct cards that all apply', () => {
    const build = applyCard(applyCard(createBuild(), 'weapon.wand'), 'mechanic.doubleJump')
    const rng = createRng('stock')
    for (let i = 0; i < 1000; i++) {
      const stock = rollStock(build, rng)
      expect(stock).toHaveLength(STOCK_SIZE)
      expect(new Set(stock.map((entry) => entry.id)).size).toBe(STOCK_SIZE)
      expect(stock.every((entry) => canApply(build, entry.id))).toBe(true)
    }
  })

  it('always has a card that is not a weapon', () => {
    const rng = createRng('not-only-weapons')
    for (let i = 0; i < 3000; i++) expect(rollStock(createBuild(), rng).some((entry) => entry.kind !== 'weapon')).toBe(true)
  })

  it('stocks no ability card once every slot is taken', () => {
    const build = fullSlots()
    const rng = createRng('full-slots')
    for (let i = 0; i < 1000; i++) {
      for (const entry of rollStock(build, rng)) expect(entry.description.startsWith('Takes an ability slot')).toBe(false)
    }
  })

  it('keeps legendaries rare at any level, without the level-up pity', () => {
    const low = createBuild()
    const high = addXp(createBuild(), 2000).build
    expect(high.level).toBeGreaterThan(10)
    for (const build of [low, high]) {
      const rng = createRng(`legendary-${build.level}`)
      let legendaries = 0
      for (let i = 0; i < 2000; i++) legendaries += rollStock(build, rng).filter((entry) => entry.rarity === 'legendary').length
      expect(legendaries / (2000 * STOCK_SIZE)).toBeLessThan(0.06)
      expect(legendaries).toBeGreaterThan(0)
    }
  })

  it('is the same for the same seed', () => {
    const ids = (seed: string) => rollStock(createBuild(), createRng(seed)).map((entry) => entry.id)
    expect(ids('same')).toEqual(ids('same'))
  })
})

describe('buying a card', () => {
  it('applies only the card: no level, XP, max hp or heal', () => {
    const build = { ...addXp(createBuild(), 25).build, hp: 40 }
    const result = buyCard(build, 30, card('stat.sharpened'))
    expect(result).not.toBeNull()
    expect(result?.build).toEqual(applyCard(build, 'stat.sharpened'))
    expect(result?.build.level).toBe(build.level)
    expect(result?.build.xp).toBe(build.xp)
    expect(result?.build.hp).toBe(40)
    expect(result?.build.stats.maxHp).toBe(build.stats.maxHp)
    expect(result?.fragments).toBe(30 - PRICES.common)
  })

  it('refuses a card the fragments do not cover', () => {
    const rare = card('mechanic.wallJump')
    expect(stockState(createBuild(), PRICES.rare - 1, rare)).toBe('poor')
    expect(buyCard(createBuild(), PRICES.rare - 1, rare)).toBeNull()
    expect(stockState(createBuild(), PRICES.rare, rare)).toBe('buy')
  })

  it('refuses a card an earlier purchase made useless', () => {
    const build = fullSlots()
    const autoclave = card('mechanic.autoclave')
    expect(stockState(build, 100, autoclave)).toBe('unusable')
    expect(buyCard(build, 100, autoclave)).toBeNull()
  })
})
