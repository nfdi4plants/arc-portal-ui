import { ARC } from '@nfdi4plants/arctrl'
import { beforeAll, describe, expect, it } from 'vitest'
import { buildProvenanceIndex } from '../../../src/arc/provenance/buildIndex'
import type { IoKind } from '../../../src/arc/provenance/types'
import { createRng } from '../../../src/game/contracts/rng'
import type { RunNode, RunPlan, Segment } from '../../../src/game/contracts/run'
import { bossArchetypeFor, bossFromNode, bossGenome, FINAL_PHASE_MECHANICS, finalBossFromPlan } from '../../../src/game/model/content'
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
  it('picks the fallback archetype of a step without annotations by node kind', () => {
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
    expect(boss.damageScale).toBe([1.55, 1.28, 1][[0, 0.5, 1].indexOf(quality)])
  })


  it('scales the HP with the depth and names the node', () => {
    const first = bossFromNode(nodeOf('source'), segmentWith(0, 80, 0), createRng('hp'))
    const third = bossFromNode(nodeOf('source'), segmentWith(0, 80, 2), createRng('hp'))
    const dense = first.theme === 'dense' ? 1.15 : 1
    expect(first.hp).toBe(Math.round(400 * dense))
    expect(third.hp).toBe(Math.round(680 * dense))
    expect(third.xp).toBe(15)
    expect(third.segmentIndex).toBe(2)
    expect(third.nodeId).toBe(nodeOf('source').id)
    expect(third.nodeKind).toBe('source')
    expect(third.archetype).toBe(third.genome.body.archetype)
    expect(third.label).toBe('leaf-material-with-a-lo…')
  })

  it('takes its attacks, mechanics and theme from the genome of its own step', () => {
    plan.segments.forEach((segment, i) => {
      const boss = bossFromNode(plan.nodes[i + 1], segment, createRng(i))
      const genome = bossGenome(segment, plan.nodes[i + 1].kind)
      expect(boss.genome).toEqual(genome)
      const slotted = [...genome.heavy, ...genome.light].flatMap((slot) => (slot.attack ? [slot.attack] : []))
      expect(boss.attacks).toEqual(slotted)
      expect(boss.mechanics.map((m) => m.kind)).toEqual(genome.mechanics.flatMap((slot) => (slot.mechanic ? [slot.mechanic] : [])))
      expect(boss.theme).toBe(genome.theme.kind)
      expect(new Set(boss.attacks.map((attack) => attack.id)).size).toBe(boss.attacks.length)
    })
  })
})

describe('finalBossFromPlan', () => {
  it('has one phase per segment, each built from its own step, and 600 HP per node boss', () => {
    const boss = finalBossFromPlan(plan, createRng('final'))
    expect(boss.title).toBe('Talinum')
    expect(boss.hp).toBe(600 * plan.segments.length)
    expect(boss.phases).toHaveLength(plan.segments.length)
    boss.phases.forEach((phase, i) => {
      const segment = plan.segments[i]
      expect(phase.segmentIndex).toBe(segment.index)
      expect(phase.datasetKind).toBe(segment.datasetKind)
      expect(phase.genome).toEqual(bossGenome(segment, plan.nodes[i + 1].kind))
      expect(phase.archetype).toBe(phase.genome.body.archetype)
      expect(phase.quality).toBe(segment.quality)
      expect(phase.telegraphMs).toBe(segment.telegraphMs)
    })
  })

  it('keeps the signature heavy, the light attacks and two mechanics of the step and ends with the crate', () => {
    for (const phase of finalBossFromPlan(plan, createRng('final')).phases) {
      const { genome } = phase
      const crate = phase.attacks[phase.attacks.length - 1]
      expect(crate).toMatchObject({ name: 'Crate Collapse', kind: 'rain', heavy: true })
      expect(phase.attacks[0]).toEqual(genome.heavy[0].attack)
      const lights = phase.attacks.filter((attack) => !attack.heavy)
      expect(lights).toEqual(genome.light.flatMap((slot) => (slot.attack ? [slot.attack] : [])))
      expect(lights.length).toBeGreaterThanOrEqual(1)
      expect(phase.attacks.filter((attack) => attack.heavy)).toHaveLength(2)
      expect(phase.mechanics.length).toBeLessThanOrEqual(FINAL_PHASE_MECHANICS)
      expect(new Set(phase.attacks.map((attack) => attack.id)).size).toBe(phase.attacks.length)
      for (const attack of phase.attacks) expect(attack.telegraphMs).toBe(attack.heavy ? phase.telegraphMs : 250)
    }
  })

  it('never telegraphs faster than 80 ms', () => {
    const rushed: RunPlan = { ...plan, segments: [{ ...plan.segments[0], telegraphMs: 40 }], nodes: plan.nodes.slice(0, 2) }
    const [phase] = finalBossFromPlan(rushed, createRng('floor')).phases
    expect(phase.telegraphMs).toBe(80)
    expect(phase.attacks.filter((attack) => attack.heavy).every((attack) => attack.telegraphMs === 80)).toBe(true)
  })

  it('builds the same final boss for the same plan and falls back to ARC without a title', () => {
    expect(finalBossFromPlan(plan, createRng('same'))).toEqual(finalBossFromPlan(plan, createRng('other')))
    expect(finalBossFromPlan({ ...plan, arcTitle: '' }, createRng('same')).title).toBe('ARC')
  })
})
