import { describe, expect, it } from 'vitest'
import {
  compactPillViews,
  describePill,
  estimateTextWidth,
  pillBlock,
  pillListText,
  PILL_GAP,
  PILL_HEIGHT,
  rowWidth,
  wrapPillRows,
  type PillView,
} from '../../src/components/ArcDashboard/Provenance/GraphCanvas/pills'
import type { CanvasEdge, CanvasPill } from '../../src/components/ArcDashboard/Provenance/GraphCanvas/types'

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

function sized(width: number, key: string = `w${width}`): PillView {
  return { key, kind: 'property', namePart: '', valuePart: '', empty: false, fullText: '', tooltip: '', width }
}

describe('wrapPillRows', () => {
  it('fills a row from the left until the next pill does not fit', () => {
    const rows = wrapPillRows([sized(100, 'a'), sized(100, 'b'), sized(100, 'c'), sized(40, 'd')], 212)

    expect(rows.map((row) => row.map(({ key }) => key))).toEqual([['a', 'b'], ['c', 'd']])
    expect(rows.map(rowWidth)).toEqual([206, 146])
  })

  it('counts a gap between two pills as part of the row', () => {
    expect(wrapPillRows([sized(100, 'a'), sized(100, 'b')], 100 + PILL_GAP + 99)).toHaveLength(2)
    expect(wrapPillRows([sized(100, 'a'), sized(100, 'b')], 100 + PILL_GAP + 100)).toHaveLength(1)
  })

  it('gives a pill wider than the cap a row of its own and cuts nothing', () => {
    const rows = wrapPillRows([sized(50, 'a'), sized(300, 'wide'), sized(50, 'b'), sized(50, 'c')], 120)

    expect(rows.map((row) => row.map(({ key }) => key))).toEqual([['a'], ['wide'], ['b', 'c']])
  })

  it('returns no row for no pill', () => {
    expect(wrapPillRows([], 100)).toEqual([])
  })
})

describe('pillBlock', () => {
  const views = [sized(100, 'a'), sized(100, 'b'), sized(100, 'c')]

  it('keeps a collapsed edge in one row however wide it is', () => {
    const block = pillBlock(views)

    expect(block.rows).toEqual([views])
    expect(block.width).toBe(3 * 100 + 2 * PILL_GAP + 32)
    expect(block.height).toBe(PILL_HEIGHT)
  })

  it('wraps an expanded edge at the row cap and measures all rows', () => {
    const block = pillBlock(views, 210)

    expect(block.rows.map((row) => row.length)).toEqual([2, 1])
    expect(block.width).toBe(2 * 100 + PILL_GAP + 32)
    expect(block.height).toBe(2 * PILL_HEIGHT + PILL_GAP)
  })

  it('never wraps narrower than the widest pill', () => {
    const block = pillBlock([sized(80, 'a'), sized(150, 'b'), sized(60, 'c'), sized(60, 'd')], 10)

    expect(block.rows.map((row) => row.map(({ key }) => key))).toEqual([['a'], ['b'], ['c', 'd']])
    expect(block.width).toBe(150 + 32)
  })
})

describe('compactPillViews', () => {
  const measure = (text: string) => estimateTextWidth(text)
  const parameter: CanvasPill = { key: 'p', kind: 'property', name: 'temperature', value: '20', category: 'parameter' }
  const factor: CanvasPill = { key: 'f', kind: 'property', name: 'light', value: 'dark', category: 'factor' }
  const count: CanvasPill = { key: 'c', kind: 'count', value: '6' }
  const edge = (pills: CanvasPill[], morePills: CanvasPill[] = []): CanvasEdge => ({
    id: 'e',
    from: 'a',
    to: 'b',
    color: 'study',
    pills,
    morePills,
  })

  it('keeps a lone pill and shows nothing for an edge without pills', () => {
    expect(compactPillViews(edge([count]), measure).map(({ key, toggle }) => [key, toggle])).toEqual([['c', undefined]])
    expect(compactPillViews(edge([], [count]), measure).map(({ key }) => key)).toEqual(['c'])
    expect(compactPillViews(edge([]), measure)).toEqual([])
  })

  it('turns several pills, the hidden ones included, into one chip with the first property category', () => {
    const [chip, ...rest] = compactPillViews(edge([count, factor], [parameter]), measure)

    expect(rest).toEqual([])
    expect(chip).toMatchObject({ kind: 'toggle', toggle: 'more', valuePart: '3', category: 'factor' })
    expect(chip.tooltip).toBe('Show the 3 details')
    // The dot takes 10px more than a chip without one.
    expect(chip.width).toBe(compactPillViews(edge([count, count]), measure)[0].width + 10 + 7 * ('3'.length - '2'.length))
  })

  it('shows no dot when no pill is a property', () => {
    expect(compactPillViews(edge([count], [count]), measure)[0].category).toBeUndefined()
  })
})

describe('pillListText', () => {
  it('writes a property in full and any other pill by its tooltip', () => {
    expect(pillListText({ key: 'p', kind: 'property', name: 'Chromatography injection mode', value: 'splitless', unit: 'x' })).toBe(
      'Chromatography injection mode: splitless x',
    )
    expect(pillListText({ key: 'c', kind: 'count', value: '3', tooltip: '3 shared nodes' })).toBe('3 shared nodes')
    expect(pillListText({ key: 'o', kind: 'process', value: 'Gas chromatography with mass spectrometry' })).toBe(
      'Gas chromatography with mass spectrometry',
    )
  })
})
