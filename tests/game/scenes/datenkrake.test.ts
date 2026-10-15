import { ARC } from '@nfdi4plants/arctrl'
import { beforeAll, describe, expect, it } from 'vitest'
import { buildProvenanceIndex } from '../../../src/arc/provenance/buildIndex'
import type { RunPlan } from '../../../src/game/contracts/run'
import { applyCorrupted } from '../../../src/game/model/progression'
import { planRun } from '../../../src/game/model/run'
import { historyRow, runRecap, statStacks } from '../../../src/game/phaser/scenes/levelHistory'
import { RunDirector } from '../../../src/game/phaser/scenes/RunDirector'
import { crateJson } from '../../helpers/sampleCrate'

let plan: RunPlan

beforeAll(() => {
  const found = planRun(buildProvenanceIndex(ARC.fromROCrateJsonString(crateJson)), 'Talinum', 'datenkrake')
  if (!found) throw new Error('No plan')
  plan = found
})

// A run in the first waystation after a few level-ups: two stacks of Impact Factor, a weapon and
// Data Aggregation in the first ability slot.
function inWaystation(): RunDirector {
  const director = new RunDirector(plan, { emit: () => {}, enter: () => {} })
  director.start()
  for (const cardId of ['stat.sharpened', 'weapon.wand', 'stat.sharpened', 'mechanic.centrifugeSpin']) {
    director.creditXp(1000)
    director.rollOffer()
    director.chooseCard(cardId)
    while (director.pendingLevelUps > 0) director.chooseCard(null)
  }
  director.completeStretch()
  director.defeatBoss()
  return director
}

describe('the Datenkrake in a run', () => {
  it('counts the stat stacks the run took from the level history', () => {
    const director = inWaystation()
    expect(statStacks(director.levelHistory)).toEqual({ 'stat.sharpened': 2 })
    expect(director.datenkrakeHasPrey()).toBe(true)
  })

  it('records a fight in the history and grabs only once per waystation', () => {
    const director = inWaystation()
    const build = director.build
    director.fightDatenkrake(0)
    expect(director.build).toBe(build)
    expect(director.datenkrakeOutcome(0)).toBe('fought')
    expect(director.datenkrakeWaits(0)).toBe(false)
    expect(director.submitToDatenkrake(0)).toBeNull()
    const last = director.levelHistory.at(-1)
    expect(last && historyRow(last).title).toBe('Fought off the Datenkrake')
    expect(runRecap(director.levelHistory).at(-1)?.name).toBe('Fought off the Datenkrake')
  })

  it('swaps an augment for a corrupted one and writes both into the history and the recap', () => {
    const director = inWaystation()
    const deal = director.submitToDatenkrake(0)
    expect(deal).not.toBeNull()
    if (!deal) return
    expect(['stat.sharpened', 'mechanic.centrifugeSpin']).toContain(deal.taken)
    expect(director.build.corrupted).toEqual([deal.given])
    expect(director.build.weapons.light.id).toBe('wand')
    const rows = director.levelHistory.slice(-2).map((record) => historyRow(record).title)
    expect(rows[0]).toMatch(/^Taken by the Datenkrake: /)
    expect(rows[1]).toMatch(/^Corrupted: /)
    const recap = runRecap(director.levelHistory).slice(-2)
    expect(recap.map((entry) => entry.datenkrake)).toEqual(['taken', 'corrupted'])
    // A stat stack the kraken took is gone from the count, so it cannot be taken twice.
    if (deal.taken === 'stat.sharpened') expect(statStacks(director.levelHistory)).toEqual({ 'stat.sharpened': 1 })
  })

  it('makes the same deal for the same run and choices', () => {
    expect(inWaystation().submitToDatenkrake(0)).toEqual(inWaystation().submitToDatenkrake(0))
  })
})

describe('corrupted augments of the run', () => {
  it('Data Leak triples the fragments picked up and leaks some on every hit taken', () => {
    const director = inWaystation()
    director.build = applyCorrupted(director.build, 'dataLeak')
    director.addFragments(4)
    expect(director.fragments).toBe(12)
    expect(director.leakFragments()).toBe(3)
    expect(director.fragments).toBe(9)
    director.fragments = 1
    expect(director.leakFragments()).toBe(1)
    expect(director.fragments).toBe(0)
  })

  it('Accept All Cookies adds 2 max HP per kill, and only with the augment', () => {
    const director = inWaystation()
    expect(director.eatCookie()).toBe(false)
    director.build = applyCorrupted(director.build, 'acceptAllCookies')
    const before = director.build.stats.maxHp
    expect(director.eatCookie()).toBe(true)
    expect(director.build.stats.maxHp).toBe(before + 2)
  })
})
