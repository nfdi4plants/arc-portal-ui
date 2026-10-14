import { describe, expect, it } from 'vitest'
import { overheadShape, upwardKnockback } from '../../../src/game/phaser/player/weapons/helpers'

describe('overheadShape', () => {
  it('turns a forward rect into one centred over the head with width and height swapped', () => {
    const shape = overheadShape({ kind: 'rect', x: 4, y: -34, w: 38, h: 24 })
    expect(shape).toEqual({ kind: 'rect', x: -12, y: -68, w: 24, h: 42 })
  })

  it('keeps a thin lash wide enough to land', () => {
    const shape = overheadShape({ kind: 'rect', x: 4, y: -26, w: 70, h: 10 })
    expect(shape).toMatchObject({ kind: 'rect', x: -10, w: 20 })
  })

  it('moves a circle forward offset upward', () => {
    expect(overheadShape({ kind: 'circle', x: 20, y: -22, r: 30 })).toEqual({ kind: 'circle', x: 0, y: -50, r: 30 })
  })
})

describe('upwardKnockback', () => {
  it('points mostly up and keeps a small forward part', () => {
    const knockback = upwardKnockback({ x: 300, y: -160 })
    expect(knockback.y).toBe(-270)
    expect(knockback.x).toBe(75)
  })

  it('leaves no knockback as none', () => {
    expect(upwardKnockback({ x: 0, y: 0 })).toEqual({ x: 0, y: 0 })
  })
})
