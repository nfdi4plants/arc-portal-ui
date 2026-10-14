import { describe, expect, it } from 'vitest'
import type { RunPlan, Segment } from '../../../src/game/contracts/run'
import { portalLabel } from '../../../src/game/phaser/scenes/RunDirector'

function segment(index: number, processName: string, fromNodeId: string, toNodeId: string): Segment {
  return {
    index,
    fromNodeId,
    toNodeId,
    processKey: processName,
    processName,
    datasetId: 'studies/Demo',
    datasetKind: 'study',
    annotations: [],
    quality: 0.5,
    telegraphMs: 490,
  }
}

const PLAN: RunPlan = {
  seed: 'seed',
  arcTitle: 'Talinum',
  nodes: [],
  segments: [
    segment(0, 'Growth', 'studies/Demo/resources/seed', 'studies/Demo/resources/plant'),
    segment(1, 'RNA extraction', 'studies/Demo/resources/plant', 'assays/RNA/dataset/rna'),
  ],
}

describe('portalLabel', () => {
  it('names the next step and where it leads after a node boss', () => {
    expect(portalLabel(PLAN, 0)).toEqual({ title: 'Next: RNA extraction', detail: 'Step 2 of 2: plant to rna' })
  })

  it('leads to the ARC after the last node boss', () => {
    expect(portalLabel(PLAN, 1)).toEqual({ title: 'Next: Talinum', detail: 'The final boss' })
  })
})
