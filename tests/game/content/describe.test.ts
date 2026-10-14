import { describe, expect, it } from 'vitest'
import type { Annotation, AnnotationCategory } from '../../../src/arc/provenance/types'
import type { PassiveKind } from '../../../src/game/contracts/content'
import type { Segment } from '../../../src/game/contracts/run'
import { SUMMONED_SUFFIX, describeMonster, monsterFromAnnotation } from '../../../src/game/model/content'

const CATEGORIES: AnnotationCategory[] = ['parameter', 'characteristic', 'factor', 'component', 'protocol', 'performer', 'date', 'comment']
const PASSIVE_NAME: Record<AnnotationCategory, string> = {
  parameter: 'Tuned',
  characteristic: 'Armored',
  factor: 'Stance shift',
  component: 'Shield drop',
  protocol: 'Patrol',
  performer: 'Summoner',
  date: 'Blink',
  comment: 'Chatter',
}

function annotation(overrides: Partial<Annotation> = {}): Annotation {
  return { name: 'temperature day', value: '22', unit: '°C', accession: null, category: 'parameter', ...overrides }
}

function segmentOf(annotations: Annotation[]): Segment {
  return {
    index: 1,
    fromNodeId: 'a',
    toNodeId: 'b',
    processKey: 'p',
    processName: 'illumina',
    datasetId: 'assays/RNASeq/',
    datasetKind: 'assay',
    annotations,
    quality: 0.5,
    telegraphMs: 600,
  }
}

function describeOf(overrides: Partial<Annotation> = {}, others = 0) {
  const source = annotation(overrides)
  const spec = monsterFromAnnotation(source, 1)
  return describeMonster(spec, segmentOf([source, ...Array.from({ length: others }, () => annotation({ name: 'other' }))]))
}

const row = (result: ReturnType<typeof describeOf>, part: string) => {
  const found = result.rows.find((r) => r.part === part)
  if (!found) throw new Error(`No row ${part}`)
  return found
}

describe('describeMonster', () => {
  it('explains a phantom and where its weapon comes from', () => {
    const result = describeOf({ value: null, unit: null })
    expect(row(result, 'Value')).toMatchObject({ value: 'missing', color: 'teal' })
    expect(row(result, 'Value').arrowTo).toMatch(/^invisible phantom, weapon: \w+ \(from the empty value\)/)
    expect(describeOf({ value: '22' }).rows.some((r) => r.arrowTo.includes('phantom'))).toBe(false)
  })

  it('titles the card with the annotation label', () => {
    const source = annotation()
    const spec = monsterFromAnnotation(source, 1)
    expect(describeMonster(spec, segmentOf([source])).title).toBe(spec.label)
  })

  it('gives one row for each annotation part', () => {
    expect(describeOf().rows.map((r) => r.part)).toEqual(['Key', 'Value', 'Type', 'Ontology term', 'Step'])
  })

  it('uses one colour for each trait group and four colours overall', () => {
    const rows = describeOf().rows
    expect(new Set(rows.map((r) => r.color))).toEqual(new Set(['blue', 'teal', 'yellow', 'cream']))
    expect(row(describeOf(), 'Key').color).toBe('blue')
    expect(row(describeOf(), 'Value').color).toBe('teal')
    expect(row(describeOf(), 'Type').color).toBe('yellow')
  })

  it('explains every ISA category in one line below the rows', () => {
    const explained = new Set<string>()
    for (const category of CATEGORIES) {
      const line = describeOf({ category }).lines.find((l) => l.startsWith('Type: '))
      expect(line).toContain(category.charAt(0).toUpperCase() + category.slice(1))
      explained.add(line as string)
    }
    expect(explained.size).toBe(CATEGORIES.length)
    expect(describeOf({ category: 'parameter' }).lines).toContain('Type: Parameter, a setting of the protocol step')
  })

  it('matches the passive in the type row to the category', () => {
    for (const category of CATEGORIES) {
      const type = row(describeOf({ category }), 'Type')
      expect(type.value).toBe(category.charAt(0).toUpperCase() + category.slice(1))
      expect(type.arrowTo).toContain(`passive: ${PASSIVE_NAME[category]}`)
    }
    const kinds: PassiveKind[] = CATEGORIES.map((c) => monsterFromAnnotation(annotation({ category: c }), 1).passive.kind)
    expect(new Set(kinds).size).toBe(CATEGORIES.length)
  })

  it('shows key, value and the unit only when there is one', () => {
    const withUnit = describeOf()
    expect(row(withUnit, 'Key').value).toBe('"temperature day"')
    expect(row(withUnit, 'Value').value).toBe('"22" + unit "°C"')
    expect(row(describeOf({ unit: null, value: null }), 'Value').value).toBe('missing')
    expect(row(describeOf({ unit: null }), 'Value').value).toBe('"22"')
  })

  it('names the body and its colour from the key', () => {
    const spec = monsterFromAnnotation(annotation(), 1)
    const key = row(describeOf(), 'Key')
    expect(key.arrowTo).toContain(`body: ${spec.body.charAt(0).toUpperCase()}${spec.body.slice(1)}`)
    expect(key.arrowTo).toMatch(/(red|orange|yellow|green|teal|blue|purple|pink) hue/)
  })

  it('names the ontology term or says there is none, with the XP bonus', () => {
    const plain = describeOf()
    expect(row(plain, 'Ontology term')).toMatchObject({ value: 'no ontology term', arrowTo: 'base XP' })
    expect(plain.lines).toContain('XP: 10')
    const termed = describeOf({ accession: 'PATO:0000146' })
    expect(row(termed, 'Ontology term')).toMatchObject({ value: 'PATO:0000146', arrowTo: '+5 XP' })
    expect(termed.lines).toContain('XP: 15 (base 10, +5 for the ontology term)')
  })

  it('names the step, its annotation count and the depth factor', () => {
    const result = describeOf({}, 2)
    const step = row(result, 'Step')
    expect(step.value).toBe('assays/RNASeq (3 annotations)')
    expect(step.arrowTo).toContain('x1.12')
    expect(result.lines).toContain('Step 2: assays/RNASeq · illumina, 3 annotations, one monster each')
    expect(row(describeOf(), 'Step').value).toBe('assays/RNASeq (1 annotation)')
  })

  it('says a weapon aims precisely only when the value has a unit', () => {
    const precise = 'aims precisely (has a unit)'
    expect(row(describeOf(), 'Value').arrowTo).toContain(precise)
    expect(row(describeOf({ unit: null }), 'Value').arrowTo).not.toContain(precise)
  })

  it('names the weapon and its size', () => {
    expect(row(describeOf(), 'Value').arrowTo).toMatch(/^weapon: [A-Z][a-z]+, size \d\.\d\dx/)
    expect(row(describeOf({ value: 'text' }), 'Value').arrowTo).toContain('normal size')
  })

  it('describes a summoned minion without rows', () => {
    const source = annotation({ category: 'performer' })
    const spec = { ...monsterFromAnnotation(source, 1), label: `x${SUMMONED_SUFFIX}` }
    const result = describeMonster(spec, segmentOf([source]))
    expect(result.rows).toEqual([])
    expect(result.lines.some((l) => l.includes('weak slime'))).toBe(true)
  })
})
