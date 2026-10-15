import { describe, expect, it } from 'vitest'
import {
  RESCUE_DESCEND_MS,
  RESCUE_DROP,
  RESCUE_GRACE_MS,
  RESCUE_HOLD_MS,
  RESCUE_MS,
  createRescueFrame,
  rescueAt,
  rescueSpot,
} from '../../../src/game/phaser/scenes/rescue'

const at = (ms: number) => ({ ...rescueAt(createRescueFrame(), ms) })

describe('rescueAt', () => {
  it('lasts about one and a half seconds', () => {
    expect(RESCUE_MS).toBeGreaterThanOrEqual(1200)
    expect(RESCUE_MS).toBeLessThanOrEqual(1600)
  })

  it('starts the mage high above the spot and lowers it steadily onto it', () => {
    expect(at(0).lift).toBeCloseTo(RESCUE_DROP)
    let previous = Infinity
    for (let ms = 0; ms <= RESCUE_DESCEND_MS; ms += 50) {
      const { lift } = at(ms)
      expect(lift).toBeLessThanOrEqual(previous)
      previous = lift
    }
    expect(at(RESCUE_DESCEND_MS).lift).toBeCloseTo(0)
    expect(at(RESCUE_DESCEND_MS).sway).toBeCloseTo(0)
  })

  it('holds the mage until it stands on the ground, then lets go', () => {
    expect(at(RESCUE_DESCEND_MS).released).toBe(false)
    expect(at(RESCUE_DESCEND_MS + RESCUE_HOLD_MS - 1).released).toBe(false)
    expect(at(RESCUE_DESCEND_MS + RESCUE_HOLD_MS).released).toBe(true)
  })

  it('keeps the mage safe from mobs through the carry and a short grace after the release', () => {
    const release = RESCUE_DESCEND_MS + RESCUE_HOLD_MS
    expect(at(0).vulnerable).toBe(false)
    expect(at(release + RESCUE_GRACE_MS - 1).vulnerable).toBe(false)
    expect(at(release + RESCUE_GRACE_MS).vulnerable).toBe(true)
  })

  it('flies the cloud up and out of sight once it let go', () => {
    const held = at(RESCUE_DESCEND_MS)
    expect(held.cloudDx).toBeCloseTo(0)
    expect(held.cloudDy).toBeCloseTo(0)
    expect(held.cloudAlpha).toBe(1)
    const end = at(RESCUE_MS)
    expect(end.cloudDy).toBeLessThan(-RESCUE_DROP)
    expect(end.cloudAlpha).toBe(0)
    expect(end.done).toBe(true)
  })
})

describe('rescueSpot', () => {
  const ground = { x: 0, w: 480, top: 300 }
  // A three-tile stepping stone over a pit, one tile above the ground.
  const stone = { x: 600, w: 72, top: 276 }

  it('puts the mage in the middle of a stepping stone it left near the edge', () => {
    expect(rescueSpot([ground, stone], 669, 276)).toEqual({ x: 636, y: 276 })
  })

  it('finds the stone when the feet sank a few units into it', () => {
    expect(rescueSpot([ground, stone], 604, 279.5)).toEqual({ x: 636, y: 276 })
  })

  it('keeps two tiles from the edge of wide ground and stays put further in', () => {
    expect(rescueSpot([ground, stone], 478, 300)).toEqual({ x: 432, y: 300 })
    expect(rescueSpot([ground, stone], 200, 300)).toEqual({ x: 200, y: 300 })
  })
})
