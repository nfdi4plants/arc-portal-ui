import { ARC } from '@nfdi4plants/arctrl'
import { beforeAll, describe, expect, it } from 'vitest'
import { buildProvenanceIndex } from '../../../src/arc/provenance/buildIndex'
import type { RunPlan } from '../../../src/game/contracts/run'
import { planRun } from '../../../src/game/model/run'
import { deathText } from '../../../src/game/phaser/scenes/deathText'
import { historyRow, runRecap } from '../../../src/game/phaser/scenes/levelHistory'
import { RunDirector } from '../../../src/game/phaser/scenes/RunDirector'
import { crateJson } from '../../helpers/sampleCrate'

let plan: RunPlan

beforeAll(() => {
  const found = planRun(buildProvenanceIndex(ARC.fromROCrateJsonString(crateJson)), 'Talinum', 'trader')
  if (!found) throw new Error('No plan')
  plan = found
})

function atFirstTrader(): RunDirector {
  const director = new RunDirector(plan, { emit: () => {}, enter: () => {} })
  director.start()
  director.completeStretch()
  director.defeatBoss()
  return director
}

describe('striking the FAIR trader in a run', () => {
  it('keeps the store open through three warnings and closes it on the fourth strike', () => {
    const director = atFirstTrader()
    expect([1, 2, 3].map((i) => director.strikeTrader(0, i * 1000))).toEqual([1, 2, 3])
    expect(director.traderOpen(0)).toBe(true)
    expect(director.strikeTrader(0, 4000)).toBe(4)
    expect(director.traderOpen(0)).toBe(false)
    expect(director.traderHostile(0)).toBe(true)
    expect(director.strikeTrader(0, 5000)).toBe(0)
  })

  it('counts the strikes of each waystation on their own', () => {
    const director = atFirstTrader()
    director.strikeTrader(0, 0)
    director.strikeTrader(0, 1000)
    director.leaveWaystation()
    director.completeStretch()
    director.defeatBoss()
    expect(director.strikeTrader(1, 0)).toBe(1)
  })
})

describe('looting the beaten trader', () => {
  it('gives the unsold stock and one legendary bonus, records them and closes his stall for the run', () => {
    const director = atFirstTrader()
    director.addFragments(100)
    const stock = [...director.stock(0)]
    const bought = stock.find((card) => director.buy(0, card.id))
    const unsold = stock.filter((card) => card !== bought)
    const level = director.build.level
    const loot = director.lootTrader(0)
    expect(loot.cards.map((card) => card.id)).toEqual(unsold.map((card) => card.id))
    expect(loot.bonus?.rarity).toBe('legendary')
    expect(stock.map((card) => card.id)).not.toContain(loot.bonus?.id)
    expect(director.build.level).toBe(level)
    const looted = director.levelHistory.filter((record) => record.looted)
    expect(looted.map((record) => record.cardId)).toEqual([...unsold, loot.bonus].map((card) => card?.id))
    expect(historyRow(looted[0]).title).toMatch(/^Looted from the FAIR trader: /)
    expect(runRecap(director.levelHistory).filter((entry) => entry.tag === 'Looted')).toHaveLength(looted.length)
    expect(director.traderGone).toBe(true)
    expect(director.stock(0)).toHaveLength(0)
    expect(director.lootTrader(0)).toEqual({ cards: [], bonus: null })
  })

  it('keeps him gone in every later waystation of the run, and a new run brings him back', () => {
    const director = atFirstTrader()
    director.lootTrader(0)
    director.leaveWaystation()
    director.completeStretch()
    director.defeatBoss()
    expect(director.traderGone).toBe(true)
    expect(director.traderOpen(1)).toBe(false)
    expect(director.strikeTrader(1, 0)).toBe(0)
    expect(atFirstTrader().traderGone).toBe(false)
  })

  it('fights at the mage level with the hp of such a mage, raised', () => {
    const director = atFirstTrader()
    director.creditXp(20 + 30)
    while (director.pendingLevelUps > 0) director.chooseCard(null)
    const fighter = director.traderFighter(0)
    expect(fighter.level).toBe(director.build.level)
    expect(fighter.stats.maxHp).toBeGreaterThan(director.build.stats.maxHp)
  })
})

describe('dying to the trader', () => {
  it('names him on the death screen with his line', () => {
    const { headline, detail } = deathText({ kind: 'trader', line: 'Priced in. Paid in full.' }, plan)
    expect(headline).toBe('Out-traded by the FAIR trader')
    expect(detail).toContain('Priced in. Paid in full.')
  })
})
