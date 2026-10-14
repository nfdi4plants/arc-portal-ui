import { ARC } from '@nfdi4plants/arctrl'
import { beforeAll, describe, expect, it } from 'vitest'
import { buildProvenanceIndex } from '../../../src/arc/provenance/buildIndex'
import type { Annotation, AnnotationCategory } from '../../../src/arc/provenance/types'
import { createRng } from '../../../src/game/contracts/rng'
import type { RunPlan, Segment } from '../../../src/game/contracts/run'
import {
  BOSS_SLOT_COUNT,
  MAX_BOSS_HIT,
  bossDamageScale,
  bossFromNode,
  bossGenome,
  describeBoss,
  describeFinalBoss,
  finalBossFromPlan,
  genomeMechanics,
  scaledHit,
  staggerBarFactor,
  termId,
  unitTheme,
} from '../../../src/game/model/content'
import { planRun, segmentQuality, telegraphMs } from '../../../src/game/model/run'
import { staggerBarSize } from '../../../src/game/phaser/bosses/stagger'
import { crateJson } from '../../helpers/sampleCrate'

function a(name: string, value: string | null, unit: string | null, accession: string | null, category: AnnotationCategory): Annotation {
  return { name, value, unit, accession, category }
}

// A step as an ARC would annotate it well: ontology terms, values with units and several types.
const RICH: Annotation[] = [
  a('temperature', '22', 'degree Celsius', 'PATO:0000146', 'parameter'),
  a('light intensity', '150', 'microeinstein per square meter per second', 'PATO:0001718', 'parameter'),
  a('organism', 'Talinum fruticosum', null, 'NCBITaxon:1569278', 'characteristic'),
  a('watering', 'drought', null, 'PECO:0007174', 'factor'),
  a('growth time', '21', 'day', 'PATO:0000165', 'parameter'),
  a('instrument', 'growth chamber', null, null, 'component'),
  a('protocol', 'plant growth', null, null, 'protocol'),
  a('sample volume', '50', 'microliter', null, 'parameter'),
]

function segmentOf(annotations: Annotation[], index = 0, processName = 'plant growth'): Segment {
  const quality = segmentQuality(annotations)
  return {
    index,
    fromNodeId: `in-${index}`,
    toNodeId: `out-${index}`,
    processKey: `p${index}`,
    processName,
    datasetId: 'studies/Growth',
    datasetKind: 'study',
    annotations,
    quality,
    telegraphMs: telegraphMs(quality),
  }
}

const filled = (slots: readonly { source: Annotation | null }[]) => slots.filter((slot) => slot.source).length

let plan: RunPlan

beforeAll(() => {
  const planned = planRun(buildProvenanceIndex(ARC.fromROCrateJsonString(crateJson)), 'Talinum', 'genome-tests')
  if (!planned) throw new Error('The sample ARC has no path')
  plan = planned
})

describe('bossGenome', () => {
  it('builds the same genome from the same step', () => {
    expect(bossGenome(segmentOf(RICH), 'sample')).toEqual(bossGenome(segmentOf([...RICH]), 'sample'))
    expect(bossGenome(segmentOf(RICH), 'sample')).toEqual(bossGenome(segmentOf([...RICH].reverse()), 'sample'))
  })

  it('fills every slot of a well annotated step and ties each slot to its annotations', () => {
    const genome = bossGenome(segmentOf(RICH), 'sample')
    expect(genome.filledSlots).toBe(BOSS_SLOT_COUNT)
    for (const slot of genome.heavy) expect(slot.source?.accession).toBeTruthy()
    for (const slot of genome.light) {
      expect(slot.source?.value).toBeTruthy()
      expect(slot.source?.unit).toBeTruthy()
    }
    expect(genome.mechanics.map((slot) => slot.category)).toEqual(['parameter', 'characteristic', 'factor'])
    expect(genome.mechanics.map((slot) => slot.mechanic)).toEqual(['enrage', 'armoredFront', 'phaseShift'])
    for (const slot of genome.mechanics) for (const source of slot.sources) expect(source.category).toBe(slot.category)
    expect(genome.theme.kind).not.toBeNull()
    for (const source of genome.theme.sources) expect(unitTheme(source.unit ?? '')).toBe(genome.theme.kind)
    expect(genome.body.key).not.toBeNull()
    for (const source of genome.body.sources) expect(source.name).toBe(genome.body.key)
    expect(genome.body.size).toBe('large')
    expect(new Set([...genome.heavy, ...genome.light].map((slot) => slot.attack?.kind)).size).toBe(4)
  })

  it('leaves the heavy slots empty without ontology terms and falls back to one plain heavy attack', () => {
    const genome = bossGenome(segmentOf(RICH.map((x) => ({ ...x, accession: null }))), 'sample')
    expect(filled(genome.heavy)).toBe(0)
    expect(genome.heavy[0].attack?.heavy).toBe(true)
    expect(genome.heavy[1].attack).toBeNull()
    expect(filled(genome.light)).toBe(2)
    expect(genome.filledSlots).toBe(BOSS_SLOT_COUNT - 2)
  })

  it('leaves the light slots and the theme empty without units', () => {
    const genome = bossGenome(segmentOf(RICH.map((x) => ({ ...x, unit: null }))), 'sample')
    expect(filled(genome.light)).toBe(0)
    expect(genome.light[0].attack?.heavy).toBe(false)
    expect(genome.light[1].attack).toBeNull()
    expect(genome.theme).toEqual({ kind: null, sources: [] })
    expect(filled(genome.heavy)).toBe(2)
  })

  it('needs a unit and a value for a light slot', () => {
    const genome = bossGenome(segmentOf([a('temperature', '', '°C', null, 'parameter'), a('time', '3', 'hour', null, 'parameter')]), 'data')
    expect(filled(genome.light)).toBe(1)
    expect(genome.light[0].source?.name).toBe('time')
  })

  it('gives a step without annotations a plain boss of its node kind', () => {
    const genome = bossGenome(segmentOf([]), 'data')
    expect(genome.filledSlots).toBe(0)
    expect(genome.body).toMatchObject({ archetype: 'glitchDaemon', key: null, size: 'small' })
    expect(genome.heavy.map((slot) => Boolean(slot.attack))).toEqual([true, false])
    expect(genome.light.map((slot) => Boolean(slot.attack))).toEqual([true, false])
    expect(genome.mechanics.every((slot) => slot.mechanic === null)).toBe(true)
    expect(genome.damageScale).toBe(1.55)
  })

  it('fills more slots the more annotations a step has', () => {
    let last = -1
    for (let n = 0; n <= RICH.length; n++) {
      const count = bossGenome(segmentOf(RICH.slice(0, n)), 'source').filledSlots
      expect(count).toBeGreaterThanOrEqual(last)
      last = count
    }
    expect(last).toBe(BOSS_SLOT_COUNT)
  })

  it('caps the slots: two heavy, two light, three mechanics, and always one heavy and one light attack', () => {
    const many = [...RICH, ...['date', 'comment', 'performer', 'protocol'].map((c, i) => a(`extra ${i}`, `${i}`, 'gram', `X:${i}`, c as AnnotationCategory))]
    for (const annotations of [[], RICH.slice(0, 1), RICH, many]) {
      const genome = bossGenome(segmentOf(annotations), 'material')
      expect(genome.heavy).toHaveLength(2)
      expect(genome.light).toHaveLength(2)
      expect(genome.mechanics).toHaveLength(3)
      expect(genome.heavy.some((slot) => slot.attack?.heavy)).toBe(true)
      expect(genome.light.some((slot) => slot.attack && !slot.attack.heavy)).toBe(true)
      expect(genomeMechanics(genome).length).toBeLessThanOrEqual(3)
    }
  })

  it('builds a node boss from its own step only and ignores earlier steps', () => {
    const own = segmentOf(RICH.slice(0, 2), 1, 'second step')
    const after = (first: Annotation[]) => {
      const steps: RunPlan = {
        seed: 's',
        arcTitle: 'Test',
        nodes: [0, 1, 2].map((i) => ({ id: `n${i}`, kind: 'sample' as const, annotations: [] })),
        segments: [segmentOf(first, 0, 'first step'), own],
      }
      return bossFromNode(steps.nodes[2], steps.segments[1], createRng('x'))
    }
    expect(after(RICH)).toEqual(after([]))
    expect(after(RICH).genome).toEqual(bossGenome(own, 'sample'))
  })

  it('makes a poorly annotated boss after a well annotated one warn less and hit harder', () => {
    const good = bossFromNode({ id: 'a', kind: 'sample', annotations: [] }, segmentOf(RICH, 0), createRng('x'))
    const poor = bossFromNode({ id: 'b', kind: 'sample', annotations: [] }, segmentOf(RICH.slice(0, 2), 1), createRng('x'))
    expect(poor.quality).toBeLessThan(good.quality)
    expect(poor.telegraphMs).toBeLessThan(good.telegraphMs)
    expect(poor.staggerWindowMs).toBeLessThan(good.staggerWindowMs)
    expect(poor.damageScale).toBeGreaterThan(good.damageScale)
    expect(poor.genome.filledSlots).toBeLessThan(good.genome.filledSlots)
    // The same first ontology term gives the same kind of heavy attack, which now hits harder.
    const firstKind = poor.genome.heavy[0].attack?.kind
    const same = good.attacks.find((attack) => attack.heavy && attack.kind === firstKind)
    if (same) expect(poor.genome.heavy[0].attack!.damage).toBeGreaterThan(same.damage)
  })
})

describe('boss damage', () => {
  it('rises smoothly from x1 at quality 1 to about x1.55 at quality 0', () => {
    expect(bossDamageScale(1)).toBe(1)
    expect(bossDamageScale(0)).toBe(1.55)
    let last = Infinity
    for (let q = 0; q <= 1.0001; q += 0.125) {
      const scale = bossDamageScale(q)
      expect(scale).toBeLessThanOrEqual(last)
      expect(scale).toBeGreaterThanOrEqual(1)
      expect(scale).toBeLessThanOrEqual(1.55)
      last = scale
    }
    expect(bossDamageScale(-1)).toBe(1.55)
    expect(bossDamageScale(2)).toBe(1)
  })

  it('never lets one boss hit take more than MAX_BOSS_HIT, well under the 100 hp a mage starts with', () => {
    expect(MAX_BOSS_HIT).toBeLessThan(100)
    expect(scaledHit(30, 1.55)).toBe(MAX_BOSS_HIT)
    expect(scaledHit(10, 1.2)).toBe(12)
    for (const segment of plan.segments) {
      for (const quality of [0, 0.5, 1]) {
        const boss = bossFromNode({ id: 'n', kind: 'source', annotations: [] }, { ...segment, quality, telegraphMs: telegraphMs(quality) }, createRng('x'))
        for (const attack of boss.attacks) expect(attack.damage).toBeLessThanOrEqual(MAX_BOSS_HIT)
        for (const mechanic of boss.mechanics) expect(mechanic.damage).toBeLessThanOrEqual(MAX_BOSS_HIT)
      }
    }
    for (const phase of finalBossFromPlan(plan, createRng('x')).phases) for (const attack of phase.attacks) expect(attack.damage).toBeLessThanOrEqual(MAX_BOSS_HIT)
  })
})

describe('unitTheme', () => {
  it.each([
    ['degree Celsius', 'heat'],
    ['°C', 'heat'],
    ['hour', 'tempo'],
    ['min', 'tempo'],
    ['day', 'tempo'],
    ['millimeter', 'reach'],
    ['cm', 'reach'],
    ['microliter', 'dense'],
    ['mM', 'dense'],
    ['milligram', 'dense'],
    ['percent', 'dense'],
    ['hertz', 'precise'],
  ])('reads %s as %s', (unit, theme) => {
    expect(unitTheme(unit)).toBe(theme)
  })
})

describe('describeBoss', () => {
  const row = (rows: { part: string; value: string; arrowTo: string }[], part: string) => {
    const found = rows.find((r) => r.part === part)
    if (!found) throw new Error(`No row ${part}`)
    return found
  }

  it('names the annotation behind every filled slot', () => {
    const boss = bossFromNode({ id: 'studies/x/leaf', kind: 'sample', annotations: [] }, segmentOf(RICH), createRng('x'))
    const { title, rows, lines } = describeBoss(boss)
    expect(title).toBe('leaf · Step 1: plant growth')
    expect(rows.map((r) => r.part)).toEqual(['Key', 'Heavy 1', 'Heavy 2', 'Light 1', 'Light 2', 'Mechanic 1', 'Mechanic 2', 'Mechanic 3', 'Theme', 'Quality'])
    const heavy = boss.genome.heavy[0]
    expect(row(rows, 'Heavy 1').value).toContain(termId(heavy.source!.accession!))
    expect(row(rows, 'Heavy 1').arrowTo).toContain(heavy.attack!.name)
    expect(row(rows, 'Light 1').value).toContain(boss.genome.light[0].source!.unit!)
    expect(row(rows, 'Mechanic 2').arrowTo).toMatch(/^Armored front/)
    expect(row(rows, 'Quality').value).toBe('8 of 8 annotations on plant growth')
    expect(row(rows, 'Quality').arrowTo).toBe('telegraph 900 ms, stagger bar smallest, normal damage')
    expect(lines[0]).toContain(`Slots filled: ${BOSS_SLOT_COUNT} of ${BOSS_SLOT_COUNT}`)
  })

  it('says what is missing for the empty slots and how the quality hurts', () => {
    const annotations = [a('temperature', '22', null, null, 'parameter'), a('note', 'x', null, null, 'comment')]
    const boss = bossFromNode({ id: 'leaf', kind: 'sample', annotations: [] }, segmentOf(annotations, 2, 'drying'), createRng('x'))
    const { rows } = describeBoss(boss)
    expect(row(rows, 'Heavy 1').arrowTo).toMatch(/^no ontology term on this step, plain /)
    expect(row(rows, 'Heavy 2')).toMatchObject({ value: 'empty', arrowTo: 'no ontology term on this step, slot stays empty' })
    expect(row(rows, 'Light 2').arrowTo).toBe('no value with a unit on this step, slot stays empty')
    expect(row(rows, 'Mechanic 3').arrowTo).toBe('needs a third annotation type, this step has 2')
    expect(row(rows, 'Theme')).toMatchObject({ value: 'no units', arrowTo: 'no value with a unit, no theme modifier' })
    expect(row(rows, 'Quality').value).toBe('2 of 8 annotations on drying')
    expect(row(rows, 'Quality').arrowTo).toBe(`telegraph 285 ms, stagger bar ×${staggerBarFactor(0.25).toFixed(1)}, hits ×${bossDamageScale(0.25).toFixed(2)}`)
  })

  it('shows the phase of the final boss and the slots it leaves out', () => {
    const spec = finalBossFromPlan(plan, createRng('x'))
    const last = spec.phases.length - 1
    const { title, rows } = describeFinalBoss(spec, last)
    expect(title).toBe(`Talinum · Phase ${last + 1} of ${spec.phases.length}: ${plan.segments[last].processName}`)
    expect(row(rows, 'Key').arrowTo).toMatch(/^the RO-Crate itself/)
    const second = spec.phases[last].genome.heavy[1]
    if (second.attack) expect(row(rows, 'Heavy 2').arrowTo).toContain('not used in this phase')
  })

  it('shortens ontology terms to their id', () => {
    expect(termId('http://purl.obolibrary.org/obo/PATO_0000146')).toBe('PATO:0000146')
    expect(termId('https://bioregistry.io/NCIT:C25330')).toBe('NCIT:C25330')
    expect(termId('PECO:0007174')).toBe('PECO:0007174')
  })

  it('compares the stagger bar the same way as the runtime bar', () => {
    for (const q of [0, 0.25, 0.5, 1]) expect(staggerBarFactor(q)).toBeCloseTo(staggerBarSize(q) / staggerBarSize(1), 6)
  })
})
