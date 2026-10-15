import { describe, expect, it } from 'vitest'
import type { Annotation } from '../../../src/arc/provenance/types'
import { TILE } from '../../../src/game/contracts/constants'
import type { Segment } from '../../../src/game/contracts/run'
import { internBridges, internSteps, stepAt, walkWithoutJumping } from '../../../src/game/phaser/scenes/internPlan'
import { generateStretch, type Ground } from '../../../src/game/phaser/scenes/levelGen'

function segmentWith(mobs: number, index = 0): Segment {
  const annotations: Annotation[] = Array.from({ length: mobs }, (_, i) => ({
    name: `parameter ${i}`,
    value: String(i),
    unit: null,
    accession: null,
    category: 'parameter',
  }))
  return {
    index,
    fromNodeId: 'a',
    toNodeId: 'b',
    processKey: `assays/RNASeq::illumina-${mobs}`,
    processName: 'illumina',
    datasetId: 'assays/RNASeq',
    datasetKind: 'assay',
    annotations,
    quality: Math.min(1, mobs / 8),
    telegraphMs: 80,
  }
}

const T = TILE

describe('the kraken intern of Deprecated jump()', () => {
  it('gets a mage without a jump through every generated stretch, with bridges and lifts only', () => {
    let bridges = 0
    let lifts = 0
    for (let s = 0; s < 120; s++) {
      for (const mobs of [0, 3, 9, 20]) {
        const layout = generateStretch(segmentWith(mobs, s % 5), `seed-${s}`)
        expect(walkWithoutJumping(layout)).toBeNull()
        bridges += internBridges(layout.grounds).length
        lifts += internSteps(layout.grounds).filter((step) => step.up === 1).length
      }
    }
    // The walk really needed the help, many times over.
    expect(bridges).toBeGreaterThan(100)
    expect(lifts).toBeGreaterThan(50)
  })

  it('bridges the holes between grounds at their height and nothing else', () => {
    const grounds: Ground[] = [
      { x: 0, w: 5 * T, top: 0 },
      { x: 8 * T, w: 4 * T, top: 0 },
      { x: 12 * T, w: 4 * T, top: -2 * T },
    ]
    expect(internBridges(grounds)).toEqual([{ x: 5 * T, w: 3 * T, top: 0 }])
    expect(internSteps(grounds)).toEqual([{ x: 12 * T, low: 0, high: -2 * T, up: 1 }])
  })

  it('lifts only a mage pushing against the wall from below', () => {
    const steps = internSteps([
      { x: 0, w: 5 * T, top: 0 },
      { x: 5 * T, w: 5 * T, top: -T },
    ])
    expect(stepAt(steps, 5 * T - 9, 0, 1, 9)).not.toBeNull()
    expect(stepAt(steps, 5 * T - 9, 0, -1, 9)).toBeNull()
    expect(stepAt(steps, 3 * T, 0, 1, 9)).toBeNull()
    // Standing on the high side, walking back down needs no lift.
    expect(stepAt(steps, 5 * T + 9, -T, -1, 9)).toBeNull()
  })

  it('also lifts a mage walking back up a step it came down', () => {
    const steps = internSteps([
      { x: 0, w: 5 * T, top: -T },
      { x: 5 * T, w: 5 * T, top: 0 },
    ])
    expect(stepAt(steps, 5 * T + 9, 0, -1, 9)).toEqual({ x: 5 * T, low: 0, high: -T, up: -1 })
  })
})
