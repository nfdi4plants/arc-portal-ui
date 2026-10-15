import { ARC } from '@nfdi4plants/arctrl'
import { beforeAll, describe, expect, it } from 'vitest'
import { buildProvenanceIndex } from '../../../src/arc/provenance/buildIndex'
import type { RunPlan } from '../../../src/game/contracts/run'
import { priceOf } from '../../../src/game/model/progression'
import { planRun } from '../../../src/game/model/run'
import { historyRow } from '../../../src/game/phaser/scenes/levelHistory'
import { RunDirector } from '../../../src/game/phaser/scenes/RunDirector'
import { crateJson } from '../../helpers/sampleCrate'

let plan: RunPlan

beforeAll(() => {
  const found = planRun(buildProvenanceIndex(ARC.fromROCrateJsonString(crateJson)), 'Talinum', 'store')
  if (!found) throw new Error('No plan')
  plan = found
})

// A run standing in the waystation after the first node boss.
function atFirstTrader(fragments: number): RunDirector {
  const director = new RunDirector(plan, { emit: () => {}, enter: () => {} })
  director.start()
  director.completeStretch()
  director.defeatBoss()
  director.addFragments(fragments)
  return director
}

describe('Ontology Fragments in a run', () => {
  it('carry over from the stretch to the boss, through the waystation and on to the next stretch', () => {
    const director = new RunDirector(plan, { emit: () => {}, enter: () => {} })
    director.start()
    director.addFragments(4)
    director.completeStretch()
    director.addFragments(7)
    director.defeatBoss()
    director.leaveWaystation()
    expect(director.stage.kind).toBe('stretch')
    expect(director.fragments).toBe(11)
  })
})

describe('the FAIR trade store in a run', () => {
  it('shows the same stock when the player leaves and comes back', () => {
    const director = atFirstTrader(0)
    const first = director.stock(0).map((card) => card.id)
    director.addFragments(3)
    expect(director.stock(0).map((card) => card.id)).toEqual(first)
  })

  it('takes the price, adds only the card and takes it off the table', () => {
    const director = atFirstTrader(100)
    director.setHp(55)
    const before = director.build
    const card = director.stock(0)[0]
    expect(director.buy(0, card.id)).toBe(true)
    expect(director.fragments).toBe(100 - priceOf(card))
    expect(director.stock(0).map((entry) => entry.id)).not.toContain(card.id)
    expect(director.build.level).toBe(before.level)
    expect(director.build.xp).toBe(before.xp)
    expect(director.pendingLevelUps).toBe(0)
    if (card.id !== 'stat.thickRobe') {
      expect(director.build.hp).toBe(55)
      expect(director.build.stats.maxHp).toBe(before.stats.maxHp)
    }
  })

  it('refuses a card the fragments do not cover', () => {
    const director = atFirstTrader(0)
    const card = director.stock(0)[0]
    expect(director.buy(0, card.id)).toBe(false)
    expect(director.stock(0)).toContain(card)
    expect(director.levelHistory).toHaveLength(0)
  })

  it('writes the purchase into the level-up provenance', () => {
    const director = atFirstTrader(100)
    const card = director.stock(0)[1]
    director.buy(0, card.id)
    const [record] = director.levelHistory
    expect(record.cardId).toBe(card.id)
    expect(record.price).toBe(priceOf(card))
    const row = historyRow(record)
    expect(row.title).toContain(`Bought · ${card.name}`)
    expect(row.source).toContain('FAIR trade store')
    expect(row.source).toContain('waystation')
    expect(row.source).toContain(director.bossSpec(0).label)
    expect(row.title).toBe(`Bought · ${card.name} (${card.rarity}) · ${priceOf(card)} fragments`)
  })
})
