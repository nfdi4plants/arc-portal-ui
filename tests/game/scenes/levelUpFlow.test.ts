import { ARC } from '@nfdi4plants/arctrl'
import { beforeAll, describe, expect, it } from 'vitest'
import { buildProvenanceIndex } from '../../../src/arc/provenance/buildIndex'
import type { RunPlan } from '../../../src/game/contracts/run'
import { priceOf } from '../../../src/game/model/progression'
import { planRun } from '../../../src/game/model/run'
import { runRecap, type LevelUpRecord } from '../../../src/game/phaser/scenes/levelHistory'
import { RunDirector } from '../../../src/game/phaser/scenes/RunDirector'
import { crateJson } from '../../helpers/sampleCrate'

let plan: RunPlan

beforeAll(() => {
  const found = planRun(buildProvenanceIndex(ARC.fromROCrateJsonString(crateJson)), 'Talinum', 'levelUpFlow')
  if (!found) throw new Error('No plan')
  plan = found
})

function director(): RunDirector {
  const d = new RunDirector(plan, { emit: () => {}, enter: () => {} })
  d.start()
  return d
}

describe('level-up summary of a run', () => {
  it('is null while no level waits for its card', () => {
    const d = director()
    expect(d.levelUpSummary()).toBeNull()
    d.creditXp(10)
    expect(d.levelUpSummary()).toBeNull()
  })

  it('shows one level from the hp the mage had when the XP came in', () => {
    const d = director()
    d.setHp(55)
    d.creditXp(20)
    const summary = d.levelUpSummary()
    expect(summary).toMatchObject({ fromLevel: 1, toLevel: 2 })
    expect(summary?.rows[0]).toMatchObject({ label: 'Max HP', from: 100, to: 110 })
    expect(summary?.rows[1]).toMatchObject({ label: 'HP', from: 55, to: 88, change: '+33 healed' })
  })

  it('sums several pending levels, also from XP that arrives before the screen opens', () => {
    const d = director()
    d.creditXp(20)
    // A second kill in the same frame, before the first card is chosen.
    d.creditXp(30)
    expect(d.pendingLevelUps).toBe(2)
    expect(d.levelUpSummary()).toMatchObject({ fromLevel: 1, toLevel: 3 })
  })

  it('starts from the new level for the next level-up', () => {
    const d = director()
    d.creditXp(50)
    while (d.pendingLevelUps > 0) d.chooseCard(d.rollOffer()[0].id)
    const maxHp = d.build.stats.maxHp
    d.creditXp(40)
    expect(d.levelUpSummary()).toMatchObject({ fromLevel: 3, toLevel: 4 })
    expect(d.levelUpSummary()?.rows[0].from).toBe(maxHp)
  })
})

describe('run recap', () => {
  it('lists the level-up picks and the purchases in the order they were taken', () => {
    const d = director()
    d.creditXp(20)
    const first = d.rollOffer()[0]
    d.chooseCard(first.id)
    d.completeStretch()
    d.defeatBoss()
    d.addFragments(100)
    const bought = d.stock(0)[0]
    expect(d.buy(0, bought.id)).toBe(true)
    d.leaveWaystation()
    d.creditXp(30)
    d.chooseCard(null)

    const recap = runRecap(d.levelHistory)
    expect(recap.map((entry) => entry.tag)).toEqual(['Lv 2', 'Bought', 'Lv 3'])
    expect(recap[0]).toMatchObject({ name: first.name, rarity: first.rarity, cardId: first.id, skipped: false })
    expect(recap[1]).toMatchObject({ name: bought.name, rarity: bought.rarity, skipped: false })
    expect(recap[1].note).toContain(`${priceOf(bought)} fragments`)
    expect(recap[2]).toMatchObject({ name: 'no card taken', skipped: true, rarity: null })
  })

  it('names a weapon picked twice by its tier 2 and notes its slot', () => {
    const record = (level: number, cardId: string, cardName: string, price?: number): LevelUpRecord => ({
      level,
      cardId,
      cardName,
      rarity: 'uncommon',
      offered: [],
      source: 'earned in a stretch',
      ...(price === undefined ? {} : { price }),
    })
    const recap = runRecap([
      record(2, 'weapon.wand', 'Wand'),
      record(3, 'weapon.beakerHammer', 'Beaker Hammer'),
      record(3, 'weapon.wand', 'Wand', 10),
      record(4, 'weapon.scalpel', 'Scalpel'),
    ])
    expect(recap.map((entry) => entry.note)).toEqual(['light weapon', 'heavy weapon', 'light, tier 2 · 10 fragments', 'light weapon'])
    expect(recap[2].name).not.toBe('Wand')
    expect(recap[3].name).toBe('Scalpel')
  })

  it('is empty for a run without augments', () => {
    expect(runRecap(director().levelHistory)).toEqual([])
  })
})
