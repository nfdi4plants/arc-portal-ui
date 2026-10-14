import { describe, expect, it } from 'vitest'
import { boundsOf, conePts, domePts, ellipsePts, flipPts, ribbonPts, starPts, wrapTitle } from '../../../src/game/phaser/art/geometry'

describe('shape points', () => {
  it('keeps ellipse points inside the radii', () => {
    const points = ellipsePts(10, 20, 6, 4, 12)
    expect(points).toHaveLength(12)
    const b = boundsOf(points)
    expect(b.minX).toBeGreaterThanOrEqual(4 - 1e-9)
    expect(b.maxX).toBeLessThanOrEqual(16 + 1e-9)
    expect(b.minY).toBeGreaterThanOrEqual(16 - 1e-9)
    expect(b.maxY).toBeLessThanOrEqual(24 + 1e-9)
  })

  it('puts a dome on a flat base', () => {
    const b = boundsOf(domePts(2, 3, 20, 10))
    expect([b.minX, b.maxX, b.minY]).toEqual([2, 22, 3])
    expect(b.maxY).toBeCloseTo(13)
  })

  it('alternates outer and inner star points', () => {
    const points = starPts(0, 0, 10, 4, 5)
    expect(points).toHaveLength(10)
    expect(Math.hypot(...points[0])).toBeCloseTo(10)
    expect(Math.hypot(...points[1])).toBeCloseTo(4)
  })

  it('mirrors around an axis', () => {
    expect(flipPts([[2, 5]], 10)).toEqual([[18, 5]])
  })

  it('draws a wedge from the left middle that stays inside its box', () => {
    const points = conePts(90, 50)
    expect(points[0]).toEqual([1, 25])
    const b = boundsOf(points)
    expect(b.maxX).toBeLessThanOrEqual(90)
    expect(b.minY).toBeGreaterThanOrEqual(0)
    expect(b.maxY).toBeLessThanOrEqual(50)
  })

  it('wraps a centre line into one closed outline', () => {
    const outline = ribbonPts([[0, 0], [0, 10], [0, 20]], 6, 2)
    expect(outline).toHaveLength(6)
    expect(outline[0]).toEqual([-3, 0])
    expect(outline[5]).toEqual([3, 0])
  })
})

describe('wrapTitle', () => {
  it('breaks at word boundaries', () => {
    expect(wrapTitle('Talinum growth under drought stress', 16, 3)).toEqual(['Talinum growth', 'under drought', 'stress'])
  })

  it('keeps an overlong word on its own line', () => {
    expect(wrapTitle('a Supercalifragilistic b', 8, 3)).toEqual(['a', 'Supercalifragilistic', 'b'])
  })

  it('cuts the text after the last line with an ellipsis', () => {
    const lines = wrapTitle('one two three four five six seven eight', 9, 2)
    expect(lines).toHaveLength(2)
    expect(lines[1].endsWith('...')).toBe(true)
  })
})
