import { describe, expect, it } from 'vitest'
import { describePill } from '../../src/components/ArcDashboard/Provenance/GraphCanvas/pills'
import type { CanvasPill } from '../../src/components/ArcDashboard/Provenance/GraphCanvas/types'

function property(name: string, value: string | null, unit?: string): CanvasPill {
  return { key: name, kind: 'property', name, value, unit, category: 'parameter' }
}

function shownText(pill: CanvasPill): string {
  const { namePart, valuePart } = describePill(pill)
  return namePart + valuePart
}

describe('describePill', () => {
  it('cuts the name when the value is short', () => {
    expect(shownText(property('Chromatography injection mode', 'splitless'))).toBe('Chromatography injection…: splitless')
  })

  it('cuts a value over 24 characters to 23 and shrinks the name to the rest of the budget', () => {
    expect(
      shownText(property('Chromatography autosampler model', 'GERSTEL MultiPurpose Sampler (MPS) Dual Head')),
    ).toBe('Chromatog…: GERSTEL MultiPurpose Sa…')
    expect(shownText(property('watering exposure', '12 days drought + 2 days rewatered'))).toBe(
      'watering…: 12 days drought + 2 day…',
    )
  })

  it('shows a null value as "(empty)", never cuts it and lets the name give way', () => {
    const text = describePill(property('Chromatography autosampler model', null))

    expect(text.namePart).toBe('Chromatography autosampler…: ')
    expect(text.valuePart).toBe('(empty)')
    expect(text.empty).toBe(true)
  })

  it('cuts a process name to 28 characters and keeps it whole in the tooltip', () => {
    const name = 'Gas chromatography with mass spectrometry'
    const pill: CanvasPill = { key: 'process', kind: 'process', value: name }

    const text = describePill(pill)

    expect(text.valuePart).toBe('Gas chromatography with mas…')
    expect(text.valuePart).toHaveLength(28)
    expect(text.tooltip).toBe(name)
  })

  it('takes the tooltip of a count pill from the pill and falls back to its text', () => {
    const count: CanvasPill = { key: 'count', kind: 'count', value: '3' }

    expect(describePill(count).tooltip).toBe('3')
    expect(describePill({ ...count, tooltip: '3 shared nodes' }).tooltip).toBe('3 shared nodes')
  })

  it('keeps the full text with its category in the tooltip', () => {
    const pill = property('Chromatography autosampler model', 'GERSTEL MultiPurpose Sampler (MPS) Dual Head', 'x')

    expect(describePill(pill).tooltip).toBe(
      'Parameter · Chromatography autosampler model: GERSTEL MultiPurpose Sampler (MPS) Dual Head x',
    )
  })
})
