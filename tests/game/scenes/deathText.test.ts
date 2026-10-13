import { describe, expect, it } from 'vitest'
import type { Annotation } from '../../../src/arc/provenance/types'
import { createRng } from '../../../src/game/contracts/rng'
import type { RunNode, RunPlan, Segment } from '../../../src/game/contracts/run'
import { bossFromNode } from '../../../src/game/model/content'
import { segmentQuality, telegraphMs } from '../../../src/game/model/run'
import { deathText } from '../../../src/game/phaser/scenes/deathText'

function annotation(i: number): Annotation {
  return { name: `parameter ${i}`, value: String(i), unit: null, accession: null, category: 'parameter' }
}

function segmentWith(annotationCount: number, index: number, processName: string): Segment {
  const annotations = Array.from({ length: annotationCount }, (_, i) => annotation(i))
  const quality = segmentQuality(annotations)
  return {
    index,
    fromNodeId: `n${index}`,
    toNodeId: `n${index + 1}`,
    processKey: `assays/RNASeq::${processName}`,
    processName,
    datasetId: 'assays/RNASeq',
    datasetKind: 'assay',
    annotations,
    quality,
    telegraphMs: telegraphMs(quality),
  }
}

function nodeBossKiller(segment: Segment) {
  const node: RunNode = { id: 'assays/RNASeq/resources/reads.fastq', kind: 'data', annotations: [] }
  return { kind: 'boss', spec: bossFromNode(node, segment, createRng('death')), segment } as const
}

describe('deathText', () => {
  it('names the mob that killed the mage', () => {
    const text = deathText({ kind: 'mob', annotation: annotation(0), label: 'a flaky pipette' }, null)
    expect(text).toEqual({ headline: 'Slain by a flaky pipette', detail: '' })
  })

  it('names the step of a node boss with few annotations and asks for more', () => {
    const { headline, detail } = deathText(nodeBossKiller(segmentWith(2, 0, 'illumina')), null)
    expect(headline).toMatch(/^Defeated by /)
    expect(detail).toContain('illumina has only 2 annotations.')
    expect(detail).toContain('Annotate this step')
  })

  it('gives no annotate hint when a node boss step has 8 annotations', () => {
    const { detail } = deathText(nodeBossKiller(segmentWith(8, 0, 'illumina')), null)
    expect(detail).toContain('illumina has 8 annotations, so this boss warns before every big attack.')
    expect(detail).not.toContain('Annotate this step')
    expect(detail).not.toContain('only')
  })

  it('names the step of the final boss phase and asks for more annotations', () => {
    const plan: RunPlan = {
      seed: 'death',
      arcTitle: 'Talinum',
      nodes: [],
      segments: [segmentWith(8, 0, 'extraction'), segmentWith(1, 1, 'sequencing')],
    }
    const { headline, detail } = deathText({ kind: 'finalBoss', title: 'Talinum', phase: 1 }, plan)
    expect(headline).toBe('The ARC Talinum stood firm in phase 2.')
    expect(detail).toContain('sequencing has only 1 annotation.')
    expect(detail).toContain('Annotate this step')
  })
})
