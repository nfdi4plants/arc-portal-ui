import { ARC } from '@nfdi4plants/arctrl'
import { beforeAll, describe, expect, it } from 'vitest'
import { buildProvenanceIndex } from '../../../src/arc/provenance/buildIndex'
import type { ProvenanceIndex } from '../../../src/arc/provenance/types'
import type { RunPlan } from '../../../src/game/contracts/run'
import { listStartCandidates, planRun, segmentQuality, telegraphMs } from '../../../src/game/model/run'
import { crateJson } from '../../helpers/sampleCrate'

let index: ProvenanceIndex

beforeAll(() => {
  index = buildProvenanceIndex(ARC.fromROCrateJsonString(crateJson))
})

const seeds = Array.from({ length: 50 }, (_, i) => `seed-${i}`)

function planFor(seed: string): RunPlan {
  const plan = planRun(index, 'Talinum', seed)
  if (!plan) throw new Error(`No plan for ${seed}`)
  return plan
}

function findPlan(accept: (plan: RunPlan) => boolean): RunPlan {
  for (let i = 0; i < 1000; i++) {
    const plan = planFor(`find-${i}`)
    if (accept(plan)) return plan
  }
  throw new Error('No seed gave a matching plan')
}

describe('listStartCandidates on the sample ARC', () => {
  it('lists the 11 inputs, longest path first and by id within a length', () => {
    const candidates = listStartCandidates(index)
    expect(candidates).toHaveLength(11)
    for (let i = 1; i < candidates.length; i++) {
      const [before, after] = [candidates[i - 1], candidates[i]]
      expect(before.pathLength >= after.pathLength).toBe(true)
      if (before.pathLength === after.pathLength) expect(before.nodeId < after.nodeId).toBe(true)
    }
  })

  it('puts the six DB_* inputs with six steps on top', () => {
    const top = listStartCandidates(index).filter((candidate) => candidate.pathLength === 6)
    expect(top.map((candidate) => candidate.nodeId)).toEqual(['DB_097', 'DB_099', 'DB_103', 'DB_161', 'DB_163', 'DB_165'])
  })
})

describe('planRun on the sample ARC', () => {
  it('starts every run at a DB_* input and walks six connected segments', () => {
    for (const seed of seeds) {
      const plan = planFor(seed)
      expect(plan.nodes[0].id).toMatch(/^DB_/)
      expect(plan.segments).toHaveLength(6)
      expect(plan.nodes).toHaveLength(7)
      expect(plan.segments.map((segment) => segment.fromNodeId)).toEqual(plan.nodes.slice(0, -1).map((node) => node.id))
      expect(plan.segments.map((segment) => segment.toNodeId)).toEqual(plan.nodes.slice(1).map((node) => node.id))
      expect(plan.segments.map((segment) => segment.index)).toEqual([0, 1, 2, 3, 4, 5])
    }
  })

  it('counts the annotations of DB_097 per segment and scales the telegraphs with them', () => {
    // DB_097 has five equally long paths and a seed picks one of them. This one ends in sleuth_dge.csv.
    const plan = findPlan((candidate) => candidate.nodes[0].id === 'DB_097' && candidate.nodes[6].id === 'runs/sleuth/results/sleuth_dge.csv')
    expect(plan.segments.map((segment) => segment.annotations.length)).toEqual([13, 6, 11, 4, 0, 2])
    expect(plan.segments.map((segment) => segment.telegraphMs)).toEqual([900, 695, 900, 490, 80, 285])
    expect(plan.segments.map((segment) => segment.quality)).toEqual([1, 0.75, 1, 0.5, 0, 0.25])
  })

  it('plans the same run for the same seed', () => {
    expect(planFor('same')).toEqual(planFor('same'))
  })

  it('reaches different start inputs with different seeds', () => {
    const starts = new Set(seeds.map((seed) => planFor(seed).nodes[0].id))
    expect(starts.size).toBeGreaterThanOrEqual(2)
  })

  it('returns null when the index has no rows', () => {
    const empty: ProvenanceIndex = {
      datasets: [],
      processes: [],
      rows: [],
      nodes: [],
      datasetById: new Map(),
      processByKey: new Map(),
      rowById: new Map(),
      nodeById: new Map(),
      groupById: new Map(),
      producedBy: new Map(),
      consumedBy: new Map(),
    }
    expect(listStartCandidates(empty)).toEqual([])
    expect(planRun(empty, 'Empty', 'seed')).toBeNull()
  })
})

describe('segment rewards', () => {
  it('caps the quality at 1 from eight annotations', () => {
    const annotation = { name: 'a', value: null, unit: null, accession: null, category: 'comment' as const }
    expect(segmentQuality([])).toBe(0)
    expect(segmentQuality(Array(4).fill(annotation))).toBe(0.5)
    expect(segmentQuality(Array(13).fill(annotation))).toBe(1)
  })

  it('maps the quality to a telegraph between 80 and 900 ms', () => {
    expect([0, 0.5, 1].map(telegraphMs)).toEqual([80, 490, 900])
  })
})
