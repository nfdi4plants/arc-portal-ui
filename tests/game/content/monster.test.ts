import { ARC } from '@nfdi4plants/arctrl'
import { beforeAll, describe, expect, it } from 'vitest'
import { buildProvenanceIndex } from '../../../src/arc/provenance/buildIndex'
import type { Annotation, AnnotationCategory } from '../../../src/arc/provenance/types'
import type { PassiveKind } from '../../../src/game/contracts/content'
import { monsterFromAnnotation } from '../../../src/game/model/content'
import { crateJson } from '../../helpers/sampleCrate'

let sampleAnnotations: Annotation[]

beforeAll(() => {
  const index = buildProvenanceIndex(ARC.fromROCrateJsonString(crateJson))
  sampleAnnotations = [...index.nodes.flatMap((node) => node.annotations), ...index.rows.flatMap((row) => row.annotations)]
})

function annotation(overrides: Partial<Annotation> = {}): Annotation {
  return { name: 'temperature day', value: '22', unit: '°C', accession: null, category: 'parameter', ...overrides }
}

describe('monsterFromAnnotation', () => {
  it('builds the same monster whenever it sees the same annotation', () => {
    expect(sampleAnnotations.length).toBeGreaterThan(100)
    const forward = sampleAnnotations.map((source) => monsterFromAnnotation(source, 2))
    const backward = [...sampleAnnotations].reverse().map((source) => monsterFromAnnotation(source, 2)).reverse()
    expect(backward).toEqual(forward)
    expect(forward.every((monster, i) => monster.source === sampleAnnotations[i])).toBe(true)
  })

  it('gives different annotations different ids', () => {
    const a = monsterFromAnnotation(annotation(), 0)
    expect(monsterFromAnnotation(annotation({ value: '23' }), 0).id).not.toBe(a.id)
    expect(monsterFromAnnotation(annotation({ accession: 'NCIT:C25206' }), 0).id).not.toBe(a.id)
  })

  it('keeps the look of a monster at any depth and strengthens it', () => {
    for (const source of sampleAnnotations) {
      const shallow = monsterFromAnnotation(source, 0)
      const deep = monsterFromAnnotation(source, 5)
      expect(deep.id).toBe(shallow.id)
      expect(deep.body).toBe(shallow.body)
      expect(deep.hue).toBe(shallow.hue)
      expect(deep.size).toBe(shallow.size)
      expect(deep.passive).toEqual(shallow.passive)
      expect(deep.weapon.kind).toBe(shallow.weapon.kind)
      expect(deep.weapon.scale).toBe(shallow.weapon.scale)
      expect(deep.stats.hp).toBeGreaterThanOrEqual(shallow.stats.hp)
      expect(deep.segmentIndex).toBe(5)
    }
    const shallow = monsterFromAnnotation(annotation({ category: 'protocol' }), 0)
    const deep = monsterFromAnnotation(annotation({ category: 'protocol' }), 5)
    expect(deep.stats.hp).toBeGreaterThan(shallow.stats.hp)
    expect(deep.stats.contactDamage).toBeGreaterThan(shallow.stats.contactDamage)
    expect(deep.weapon.damage).toBeGreaterThan(shallow.weapon.damage)
  })

  it('derives body and hue from the name alone', () => {
    const a = monsterFromAnnotation(annotation({ value: '1', category: 'parameter' }), 0)
    const b = monsterFromAnnotation(annotation({ value: 'other', category: 'factor' }), 0)
    expect(b.body).toBe(a.body)
    expect(b.hue).toBe(a.hue)
    expect(a.hue).toBeGreaterThanOrEqual(0)
    expect(a.hue).toBeLessThan(360)
  })

  it('maps every category to its passive', () => {
    const expected: Record<AnnotationCategory, PassiveKind> = {
      characteristic: 'armored',
      factor: 'stanceShift',
      parameter: 'tuned',
      component: 'shieldDrop',
      protocol: 'patrol',
      performer: 'summoner',
      date: 'blink',
      comment: 'chatter',
    }
    for (const [category, kind] of Object.entries(expected) as [AnnotationCategory, PassiveKind][]) {
      const monster = monsterFromAnnotation(annotation({ category }), 0)
      expect(monster.passive.kind).toBe(kind)
      expect(monster.passive.variant).toBeGreaterThanOrEqual(0)
      expect(monster.passive.variant).toBeLessThan(4)
    }
  })

  it('scales the weapon with the magnitude of a numeric value', () => {
    const scaleOf = (value: string | null) => monsterFromAnnotation(annotation({ value }), 0).weapon.scale
    expect(scaleOf('0')).toBe(0.75)
    expect(scaleOf(' 22 ')).toBeCloseTo(0.75 + 0.2 * Math.log10(23))
    expect(scaleOf('-22')).toBeCloseTo(scaleOf('22'))
    expect(scaleOf('1000000000')).toBe(1.6)
    expect(scaleOf('leaf')).toBe(1)
    expect(scaleOf('')).toBe(1)
    expect(scaleOf(null)).toBe(1)
  })

  it('marks a value with a unit as calibrated', () => {
    expect(monsterFromAnnotation(annotation({ unit: '°C' }), 0).weapon.calibrated).toBe(true)
    expect(monsterFromAnnotation(annotation({ unit: null }), 0).weapon.calibrated).toBe(false)
  })

  it('gives 5 extra xp for an ontology accession', () => {
    expect(monsterFromAnnotation(annotation(), 0).xp).toBe(10)
    expect(monsterFromAnnotation(annotation({ accession: 'NCIT:C25206' }), 0).xp).toBe(15)
  })

  it('keeps comment monsters small and golems at least medium', () => {
    const names = Array.from({ length: 200 }, (_, i) => `annotation ${i}`)
    for (const name of names) {
      expect(monsterFromAnnotation(annotation({ name, category: 'comment' }), 0).size).toBe('small')
      const other = monsterFromAnnotation(annotation({ name, category: 'factor' }), 0)
      if (other.body === 'golem') expect(other.size).not.toBe('small')
    }
  })

  it('labels the monster after its annotation', () => {
    expect(monsterFromAnnotation(annotation(), 0).label).toBe('Parameter · temperature day = 22 °C')
  })
})
