import { describe, expect, it } from 'vitest'
import { WORLD_MAX_ASPECT, WORLD_MIN_VIEW_WIDTH, WORLD_VIEW_HEIGHT } from '../../src/game/contracts/constants'
import { createRng, hashString } from '../../src/game/contracts/rng'
import { viewForBox } from '../../src/game/phaser/view'

describe('rng', () => {
  it('repeats the same sequence for the same seed', () => {
    const a = createRng('talinum')
    const b = createRng('talinum')
    expect(Array.from({ length: 5 }, () => a.next())).toEqual(Array.from({ length: 5 }, () => b.next()))
  })

  it('gives forks their own stream without moving the parent', () => {
    const parent = createRng('seed')
    const untouched = createRng('seed')
    const fork = parent.fork('path')
    fork.next()
    expect(parent.next()).toBe(untouched.next())
    expect(createRng('seed').fork('path').next()).toBe(createRng('seed').fork('path').next())
    expect(createRng('seed').fork('path').next()).not.toBe(createRng('seed').fork('start').next())
  })

  it('keeps int within its bounds', () => {
    const rng = createRng(1)
    for (let i = 0; i < 1000; i++) {
      const value = rng.int(2, 4)
      expect(value).toBeGreaterThanOrEqual(2)
      expect(value).toBeLessThanOrEqual(4)
    }
  })

  it('hashes with FNV-1a', () => {
    expect(hashString('')).toBe(0x811c9dc5)
    expect(hashString('a')).toBe(0xe40c292c)
  })
})

describe('viewForBox', () => {
  it('shows the fixed world height on a landscape box', () => {
    const view = viewForBox(1280, 720)
    expect(view.height).toBeCloseTo(WORLD_VIEW_HEIGHT)
    expect(view.width).toBeCloseTo(640)
  })

  it('zooms out on a portrait box so the minimum width fits', () => {
    const view = viewForBox(390, 844)
    expect(view.width).toBeCloseTo(WORLD_MIN_VIEW_WIDTH)
    expect(view.height).toBeGreaterThan(WORLD_VIEW_HEIGHT)
  })

  it('caps the visible width on very wide boxes', () => {
    const view = viewForBox(4000, 360)
    expect(view.width).toBeCloseTo(WORLD_VIEW_HEIGHT * WORLD_MAX_ASPECT)
  })
})
