import { ARC } from '@nfdi4plants/arctrl'
import { beforeAll, describe, expect, it } from 'vitest'
import { buildProvenanceIndex } from '../../../src/arc/provenance/buildIndex'
import type { RunPlan } from '../../../src/game/contracts/run'
import { planRun } from '../../../src/game/model/run'
import { RunDirector, type RunStage } from '../../../src/game/phaser/scenes/RunDirector'
import { crateJson } from '../../helpers/sampleCrate'

let plan: RunPlan

beforeAll(() => {
  const found = planRun(buildProvenanceIndex(ARC.fromROCrateJsonString(crateJson)), 'Talinum', 'waystation')
  if (!found) throw new Error('No plan')
  plan = found
})

function run(): { director: RunDirector; stages: RunStage[] } {
  const stages: RunStage[] = []
  const director = new RunDirector(plan, { emit: () => {}, enter: (stage) => stages.push(stage) })
  director.start()
  return { director, stages }
}

describe('the waystation between a node boss and the next step', () => {
  it('follows every node boss and leads on to the next stretch', () => {
    expect(plan.segments.length).toBeGreaterThan(1)
    const { director, stages } = run()
    director.completeStretch()
    director.defeatBoss()
    expect(director.stage).toEqual({ kind: 'waystation', index: 0 })
    director.leaveWaystation()
    expect(director.stage).toEqual({ kind: 'stretch', index: 1 })
    expect(stages.map((stage) => stage.kind)).toEqual(['stretch', 'boss', 'waystation', 'stretch'])
  })

  it('comes after the last node boss too, and then the final boss, with no waystation after it', () => {
    const { director, stages } = run()
    for (let i = 0; i < plan.segments.length; i++) {
      director.completeStretch()
      director.defeatBoss()
      director.leaveWaystation()
    }
    expect(director.stage.kind).toBe('finalBoss')
    director.defeatFinalBoss()
    expect(director.stage.kind).toBe('victory')
    expect(stages.filter((stage) => stage.kind === 'waystation')).toHaveLength(plan.segments.length)
    expect(stages.at(-2)?.kind).toBe('finalBoss')
  })

  it('marks the beaten node on the path and points at the next one', () => {
    const { director } = run()
    director.completeStretch()
    expect(director.currentNodeIndex()).toBe(1)
    director.defeatBoss()
    expect(director.currentNodeIndex()).toBe(2)
    director.leaveWaystation()
    expect(director.currentNodeIndex()).toBe(2)
  })
})
