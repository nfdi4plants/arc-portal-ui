import { describe, expect, it } from 'vitest'
import { placePanel } from '../../../src/game/phaser/scenes/panelPlacement'

const view = { width: 480, height: 360 }

describe('placePanel', () => {
  it('goes to the right of the anchor when there is room', () => {
    expect(placePanel({ x: 20, y: 100, w: 20, h: 20 }, 200, 100, view, 8, 6)).toEqual({ x: 46, y: 60 })
  })

  it('goes left when the right side is too narrow', () => {
    const { x } = placePanel({ x: 400, y: 100, w: 20, h: 20 }, 200, 100, view, 8, 6)
    expect(x).toBe(194)
  })

  it('goes below or above in a narrow view and stays inside', () => {
    const narrow = { width: 480, height: 1000 }
    const below = placePanel({ x: 200, y: 100, w: 30, h: 30 }, 460, 200, narrow, 8, 6)
    expect(below).toEqual({ x: 8, y: 136 })
    const above = placePanel({ x: 200, y: 900, w: 30, h: 30 }, 460, 200, narrow, 8, 6)
    expect(above).toEqual({ x: 8, y: 694 })
  })

  it('clamps into the view when no side has room', () => {
    const { x, y } = placePanel({ x: 200, y: 150, w: 30, h: 30 }, 460, 300, view, 8, 6)
    expect(x).toBe(8)
    expect(y).toBeGreaterThanOrEqual(8)
    expect(y + 300).toBeLessThanOrEqual(352)
  })
})
