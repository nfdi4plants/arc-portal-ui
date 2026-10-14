import { ARC } from '@nfdi4plants/arctrl'
import { beforeAll, describe, expect, it } from 'vitest'
import { buildProvenanceIndex } from '../../../src/arc/provenance/buildIndex'
import type { IoKind } from '../../../src/arc/provenance/types'
import { createRng } from '../../../src/game/contracts/rng'
import type { RunNode, RunPlan, Segment } from '../../../src/game/contracts/run'
import { bossArchetypeFor, bossFromNode, finalBossFromPlan } from '../../../src/game/model/content'
import { planRun } from '../../../src/game/model/run'
import { crateJson } from '../../helpers/sampleCrate'

let plan: RunPlan

beforeAll(() => {
  const index = buildProvenanceIndex(ARC.fromROCrateJsonString(crateJson))
  const planned = planRun(index, 'Talinum', 'boss-tests')
  if (!planned) throw new Error('The sample ARC has no path')
  plan = planned
})

function segmentWith(quality: number, telegraphMs: number, index = 0): Segment {
  return { ...plan.segments[0], index, quality, telegraphMs }
}

function nodeOf(kind: IoKind): RunNode {
  return { id: 'studies/Samples/resources/leaf-material-with-a-long-name.txt', kind, annotations: plan.nodes[0].annotations }
}

describe('bossArchetypeFor', () => {
  it('picks the archetype by node kind', () => {
    expect(bossArchetypeFor('source')).toBe('rootTreant')
    expect(bossArchetypeFor('sample')).toBe('specimenJar')
    expect(bossArchetypeFor('material')).toBe('reagentGolem')
    expect(bossArchetypeFor('data')).toBe('glitchDaemon')
  })
})

describe('bossFromNode', () => {
  it('builds the same boss for the same node, segment and seed', () => {
    const segment = segmentWith(0.5, 490)
    expect(bossFromNode(nodeOf('sample'), segment, createRng('a'))).toEqual(bossFromNode(nodeOf('sample'), segment, createRng('a')))
  })

  it.each([
    { quality: 0, telegraphMs: 80, hidden: true, zones: 0, stagger: 400 },
    { quality: 0.5, telegraphMs: 490, hidden: false, zones: 2, stagger: 1000 },
    { quality: 1, telegraphMs: 900, hidden: false, zones: 3, stagger: 1600 },
  ])('hands out the rewards of quality $quality', ({ quality, telegraphMs, hidden, zones, stagger }) => {
    const node = nodeOf('data')
    const boss = bossFromNode(node, segmentWith(quality, telegraphMs), createRng('rewards'))
    expect(boss.quality).toBe(quality)
    expect(boss.telegraphMs).toBe(telegraphMs)
    expect(boss.showHpBar).toBe(!hidden)
    expect(boss.showAttackNames).toBe(!hidden)
    expect(boss.safeZones).toBe(zones)
    expect(boss.weakPoints).toBe(zones)
    expect(boss.staggerWindowMs).toBe(stagger)
    expect(boss.tells).toBe(node.annotations)
    for (const attack of boss.attacks) expect(attack.telegraphMs).toBe(attack.heavy ? telegraphMs : 250)
  })

  it('scales the HP with the depth and names the node', () => {
    const first = bossFromNode(nodeOf('source'), segmentWith(0, 80, 0), createRng('hp'))
    const third = bossFromNode(nodeOf('source'), segmentWith(0, 80, 2), createRng('hp'))
    expect(first.hp).toBe(400)
    expect(third.hp).toBe(680)
    expect(third.xp).toBe(15)
    expect(third.segmentIndex).toBe(2)
    expect(third.nodeId).toBe(nodeOf('source').id)
    expect(third.nodeKind).toBe('source')
    expect(third.archetype).toBe('rootTreant')
    expect(third.label).toBe('leaf-material-with-a-lo…')
  })

  it('draws four to six distinct attacks with at least two heavy ones for every archetype', () => {
    const counts = new Set<number>()
    for (const kind of ['source', 'sample', 'material', 'data'] as const) {
      for (let seed = 0; seed < 50; seed++) {
        const boss = bossFromNode(nodeOf(kind), segmentWith(1, 900), createRng(seed))
        counts.add(boss.attacks.length)
        expect(boss.attacks.length).toBeGreaterThanOrEqual(4)
        expect(boss.attacks.length).toBeLessThanOrEqual(6)
        expect(boss.attacks.filter((attack) => attack.heavy).length).toBeGreaterThanOrEqual(2)
        expect(new Set(boss.attacks.map((attack) => attack.id)).size).toBe(boss.attacks.length)
        for (const attack of boss.attacks) expect(attack.id.startsWith(`${boss.archetype}.${attack.kind}.`)).toBe(true)
      }
    }
    expect([...counts].sort()).toEqual([4, 5, 6])
  })

})

describe('finalBossFromPlan', () => {
  it('has one phase per segment and 600 HP per node boss', () => {
    const boss = finalBossFromPlan(plan, createRng('final'))
    expect(boss.title).toBe('Talinum')
    expect(boss.hp).toBe(600 * plan.segments.length)
    expect(boss.phases).toHaveLength(plan.segments.length)
    boss.phases.forEach((phase, i) => {
      const segment = plan.segments[i]
      expect(phase.segmentIndex).toBe(segment.index)
      expect(phase.datasetKind).toBe(segment.datasetKind)
      expect(phase.archetype).toBe(bossArchetypeFor(plan.nodes[i + 1].kind))
      expect(phase.quality).toBe(segment.quality)
      expect(phase.telegraphMs).toBe(segment.telegraphMs)
    })
  })

  it('draws three archetype attacks, at least one heavy, and ends each phase with the crate', () => {
    for (const phase of finalBossFromPlan(plan, createRng('final')).phases) {
      expect(phase.attacks).toHaveLength(4)
      const [drawn, shared] = [phase.attacks.slice(0, 3), phase.attacks[3]]
      expect(drawn.some((attack) => attack.heavy)).toBe(true)
      expect(new Set(phase.attacks.map((attack) => attack.id)).size).toBe(4)
      expect(shared).toMatchObject({ name: 'Crate Collapse', kind: 'rain', heavy: true })
      for (const attack of phase.attacks) expect(attack.telegraphMs).toBe(attack.heavy ? phase.telegraphMs : 250)
    }
  })

  it('gives every phase one drawn heavy and two light attacks, so it always has a light one, over 200 seeds', () => {
    for (let seed = 0; seed < 200; seed++) {
      for (const phase of finalBossFromPlan(plan, createRng(seed)).phases) {
        expect(phase.attacks.slice(0, 3).filter((attack) => attack.heavy)).toHaveLength(1)
        expect(phase.attacks.filter((attack) => !attack.heavy)).toHaveLength(2)
      }
    }
  })

  it('never telegraphs faster than 80 ms', () => {
    const rushed: RunPlan = { ...plan, segments: [{ ...plan.segments[0], telegraphMs: 40 }], nodes: plan.nodes.slice(0, 2) }
    const [phase] = finalBossFromPlan(rushed, createRng('floor')).phases
    expect(phase.telegraphMs).toBe(80)
    expect(phase.attacks.filter((attack) => attack.heavy).every((attack) => attack.telegraphMs === 80)).toBe(true)
  })

  it('builds the same final boss for the same seed and falls back to ARC without a title', () => {
    expect(finalBossFromPlan(plan, createRng('same'))).toEqual(finalBossFromPlan(plan, createRng('same')))
    expect(finalBossFromPlan({ ...plan, arcTitle: '' }, createRng('same')).title).toBe('ARC')
  })
})
