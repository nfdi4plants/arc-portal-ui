import { describe, expect, it } from 'vitest'
import { fillCrop, IMPACT_FLASH_MS, impactFlash, type FillCrop } from '../../../src/game/phaser/bosses/fill'

const out = (): FillCrop => ({ x: 0, y: 0, w: 0, h: 0, scale: 1 })
const W = 200
const H = 40

describe('fillCrop', () => {
  it('is full exactly when the wind-up ends', () => {
    for (const mode of ['wide', 'right', 'left', 'up'] as const) {
      expect(fillCrop(mode, 1, W, H, out())).toEqual({ x: 0, y: 0, w: W, h: H, scale: 1 })
    }
    expect(fillCrop('radial', 1, W, H, out()).scale).toBe(1)
  })

  it('grows along the direction the attack travels', () => {
    expect(fillCrop('right', 0.25, W, H, out())).toMatchObject({ x: 0, w: 50, h: H })
    expect(fillCrop('left', 0.25, W, H, out())).toMatchObject({ x: 150, w: 50, h: H })
    expect(fillCrop('wide', 0.5, W, H, out())).toMatchObject({ x: 50, w: 100 })
    expect(fillCrop('up', 0.25, W, H, out())).toMatchObject({ y: 30, h: 10, w: W })
    expect(fillCrop('radial', 0.5, W, H, out())).toMatchObject({ scale: 0.5, w: W, h: H })
  })

  it('fills twice as slowly in a telegraph twice as long', () => {
    const at = (elapsedMs: number, windupMs: number) => fillCrop('right', elapsedMs / windupMs, W, H, out()).w
    expect(at(200, 400)).toBeCloseTo(2 * at(200, 800))
  })

  it('never crops to nothing at the start, which would show the whole image', () => {
    expect(fillCrop('right', 0, W, H, out()).w).toBeGreaterThan(0)
    expect(fillCrop('radial', -1, W, H, out()).scale).toBeGreaterThan(0)
  })
})

describe('impactFlash', () => {
  it('is brightest at the impact and gone after the flash time', () => {
    expect(impactFlash(0)).toBe(1)
    expect(impactFlash(IMPACT_FLASH_MS / 2)).toBeCloseTo(0.5)
    expect(impactFlash(IMPACT_FLASH_MS)).toBe(0)
    expect(impactFlash(-5)).toBe(0)
  })
})
