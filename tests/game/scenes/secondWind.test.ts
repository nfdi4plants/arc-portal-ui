import { ARC } from '@nfdi4plants/arctrl'
import { beforeAll, describe, expect, it } from 'vitest'
import { buildProvenanceIndex } from '../../../src/arc/provenance/buildIndex'
import type { RunPlan } from '../../../src/game/contracts/run'
import { createBossCharge } from '../../../src/game/model/progression'
import { planRun } from '../../../src/game/model/run'
import { RunDirector } from '../../../src/game/phaser/scenes/RunDirector'
import { crateJson } from '../../helpers/sampleCrate'

let plan: RunPlan

beforeAll(() => {
  const found = planRun(buildProvenanceIndex(ARC.fromROCrateJsonString(crateJson)), 'Talinum', 'second-wind')
  if (!found) throw new Error('No plan')
  plan = found
})

describe('createBossCharge', () => {
  it('spends once and refuses until recharged', () => {
    const charge = createBossCharge()
    expect(charge.ready()).toBe(true)
    expect(charge.spend()).toBe(true)
    expect(charge.ready()).toBe(false)
    expect(charge.spend()).toBe(false)
    charge.recharge()
    expect(charge.spend()).toBe(true)
  })
})

describe('Second Wind charge in a run', () => {
  it('stays spent through the stretch and the boss fight, and recharges when the boss falls', () => {
    const director = new RunDirector(plan, { emit: () => {}, enter: () => {} })
    director.start()
    director.secondWind.spend()
    director.completeStretch()
    expect(director.stage.kind).toBe('boss')
    expect(director.secondWind.ready()).toBe(false)
    director.defeatBoss()
    expect(director.secondWind.ready()).toBe(true)
  })

  it('is charged when the final boss starts', () => {
    expect(plan.segments.length).toBeGreaterThan(0)
    const director = new RunDirector(plan, { emit: () => {}, enter: () => {} })
    director.start()
    for (let i = 0; i < plan.segments.length; i++) {
      director.completeStretch()
      director.secondWind.spend()
      director.defeatBoss()
    }
    expect(director.stage.kind).toBe('finalBoss')
    expect(director.secondWind.ready()).toBe(true)
  })
})
