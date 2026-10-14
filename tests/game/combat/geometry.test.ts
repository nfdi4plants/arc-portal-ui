import { describe, expect, it } from 'vitest'
import { facingOfVelocity, mirrorKnockback, overlaps, resolveShape } from '../../../src/game/phaser/combat/geometry'

describe('resolveShape', () => {
  const origin = { x: 100, y: 200 }

  it('moves a right-facing rect by the origin', () => {
    expect(resolveShape({ kind: 'rect', x: 10, y: -20, w: 30, h: 10 }, origin, 1)).toEqual({ kind: 'rect', x: 110, y: 180, w: 30, h: 10 })
  })

  it('mirrors a left-facing rect so its near edge stays the same distance from the origin', () => {
    const shape = resolveShape({ kind: 'rect', x: 10, y: -20, w: 30, h: 10 }, origin, -1)
    expect(shape).toEqual({ kind: 'rect', x: 60, y: 180, w: 30, h: 10 })
    expect(origin.x - (shape.kind === 'rect' ? shape.x + shape.w : 0)).toBe(10)
  })

  it('mirrors the centre of a circle', () => {
    expect(resolveShape({ kind: 'circle', x: 16, y: -8, r: 5 }, origin, 1)).toEqual({ kind: 'circle', x: 116, y: 192, r: 5 })
    expect(resolveShape({ kind: 'circle', x: 16, y: -8, r: 5 }, origin, -1)).toEqual({ kind: 'circle', x: 84, y: 192, r: 5 })
  })
})

describe('overlaps', () => {
  const rect = { x: 10, y: 10, w: 20, h: 20 }

  it('detects overlapping and separate rects', () => {
    expect(overlaps({ kind: 'rect', x: 25, y: 25, w: 20, h: 20 }, rect)).toBe(true)
    expect(overlaps({ kind: 'rect', x: 12, y: 12, w: 4, h: 4 }, rect)).toBe(true)
    expect(overlaps({ kind: 'rect', x: 31, y: 10, w: 20, h: 20 }, rect)).toBe(false)
  })

  it('does not count rects that only touch along an edge or a corner', () => {
    expect(overlaps({ kind: 'rect', x: 30, y: 10, w: 10, h: 20 }, rect)).toBe(false)
    expect(overlaps({ kind: 'rect', x: 0, y: 10, w: 10, h: 20 }, rect)).toBe(false)
    expect(overlaps({ kind: 'rect', x: 10, y: 30, w: 20, h: 5 }, rect)).toBe(false)
    expect(overlaps({ kind: 'rect', x: 30, y: 30, w: 5, h: 5 }, rect)).toBe(false)
    expect(overlaps({ kind: 'rect', x: 29, y: 10, w: 10, h: 20 }, rect)).toBe(true)
  })

  it('detects a circle that reaches into a rect', () => {
    expect(overlaps({ kind: 'circle', x: 20, y: 20, r: 2 }, rect)).toBe(true)
    expect(overlaps({ kind: 'circle', x: 34, y: 20, r: 5 }, rect)).toBe(true)
    expect(overlaps({ kind: 'circle', x: 40, y: 20, r: 5 }, rect)).toBe(false)
  })

  it('does not count a circle that only touches a rect edge', () => {
    expect(overlaps({ kind: 'circle', x: 35, y: 20, r: 5 }, rect)).toBe(false)
    expect(overlaps({ kind: 'circle', x: 20, y: 5, r: 5 }, rect)).toBe(false)
  })

  it('measures a circle near a corner against the corner point', () => {
    // The corner (30, 30) is exactly 5 away from (33, 34).
    expect(overlaps({ kind: 'circle', x: 33, y: 34, r: 6 }, rect)).toBe(true)
    expect(overlaps({ kind: 'circle', x: 33, y: 34, r: 5 }, rect)).toBe(false)
    expect(overlaps({ kind: 'circle', x: 33, y: 34, r: 4 }, rect)).toBe(false)
  })
})

describe('mirrorKnockback', () => {
  it('keeps the push for a right-facing attacker', () => {
    expect(mirrorKnockback({ x: 120, y: -40 }, 1)).toEqual({ x: 120, y: -40 })
  })

  it('flips only the horizontal push for a left-facing attacker', () => {
    expect(mirrorKnockback({ x: 120, y: -40 }, -1)).toEqual({ x: -120, y: -40 })
  })
})

describe('facingOfVelocity', () => {
  it('follows the sign of the horizontal speed and falls back when it is zero', () => {
    expect(facingOfVelocity(180, -1)).toBe(1)
    expect(facingOfVelocity(-180, 1)).toBe(-1)
    expect(facingOfVelocity(0, -1)).toBe(-1)
  })
})
