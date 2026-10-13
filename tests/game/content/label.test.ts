import { describe, expect, it } from 'vitest'
import type { Annotation } from '../../../src/arc/provenance/types'
import { annotationLabel } from '../../../src/game/model/content'

function annotation(overrides: Partial<Annotation> = {}): Annotation {
  return { name: 'temperature day', value: '22', unit: '°C', accession: null, category: 'parameter', ...overrides }
}

describe('annotationLabel', () => {
  it('writes category, name, value and unit', () => {
    expect(annotationLabel(annotation())).toBe('Parameter · temperature day = 22 °C')
  })

  it('leaves out the unit when there is none', () => {
    expect(annotationLabel(annotation({ category: 'characteristic', value: 'Talinum fruticosum', unit: null }))).toBe(
      'Characteristic · temperature day = Talinum fruticosum',
    )
  })

  it('leaves out the equals sign when the value is null or empty', () => {
    expect(annotationLabel(annotation({ category: 'factor', value: null, unit: null }))).toBe('Factor · temperature day')
    expect(annotationLabel(annotation({ value: '' }))).toBe('Parameter · temperature day')
  })

  it('cuts a value longer than 40 characters to 39 plus an ellipsis', () => {
    const exact = 'x'.repeat(40)
    expect(annotationLabel(annotation({ value: exact, unit: null }))).toBe(`Parameter · temperature day = ${exact}`)
    expect(annotationLabel(annotation({ value: 'x'.repeat(41), unit: null }))).toBe(
      `Parameter · temperature day = ${'x'.repeat(39)}…`,
    )
  })
})
