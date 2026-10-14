import { describe, expect, it } from 'vitest'
import { LEDGE_DEPTH, LEDGE_LOOKAHEAD, SAME_LEVEL, groundProbe, isOneWay, sameLevel, turnsAtLedge } from '../../../src/game/phaser/mobs/ledge'

const fresh = () => ({ minX: 0, minY: 0, maxX: 0, maxY: 0 })

describe('groundProbe', () => {
  it('looks past the front foot and reaches down to the ledge depth', () => {
    const right = groundProbe(fresh(), 100, 50, 1, 10)
    const x = 100 + 10 + LEDGE_LOOKAHEAD
    expect(right.minX).toBeLessThan(x)
    expect(right.maxX).toBeGreaterThan(x)
    expect(right.maxY).toBe(50 + LEDGE_DEPTH)
    expect(right.minY).toBeLessThan(50)
  })

  it('mirrors for a mob that walks left', () => {
    const left = groundProbe(fresh(), 100, 50, -1, 10)
    const right = groundProbe(fresh(), 100, 50, 1, 10)
    expect((left.minX + left.maxX) / 2 - 100).toBeCloseTo(-((right.minX + right.maxX) / 2 - 100))
  })

  it('writes into the box it is given', () => {
    const box = fresh()
    expect(groundProbe(box, 0, 0, 1, 10)).toBe(box)
  })
})

describe('turnsAtLedge', () => {
  it('turns an idle walker at a ledge', () => {
    expect(turnsAtLedge(false, false, false, false)).toBe(true)
  })

  it('lets a chaser go on when the player is at its level and there is ground below', () => {
    expect(turnsAtLedge(true, true, false, false)).toBe(false)
  })

  it('stops a chaser when the player is on another level', () => {
    expect(turnsAtLedge(true, false, false, false)).toBe(true)
  })

  it('never lets a crawler leave its platform', () => {
    expect(turnsAtLedge(true, true, true, false)).toBe(true)
  })

  it('stops a chaser at a pit even when the player is at its level', () => {
    expect(turnsAtLedge(true, true, false, true)).toBe(true)
  })
})

describe('sameLevel', () => {
  it('accepts feet within the tolerance and rejects a full tile of difference', () => {
    expect(sameLevel(100, 100 + SAME_LEVEL)).toBe(true)
    expect(sameLevel(100, 100 - 24)).toBe(false)
  })
})

describe('isOneWay', () => {
  it('is true for a body that collides only on top', () => {
    expect(isOneWay({ up: true, down: false })).toBe(true)
    expect(isOneWay({ up: true, down: true })).toBe(false)
  })
})
