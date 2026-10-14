import { describe, expect, it } from 'vitest'
import { staggerBarSize, staggerDurationMs, staggerLocked, staggerProgress } from '../../../src/game/phaser/bosses/stagger'

// Staff damage: a light jab does 10, a heavy swing 30.
const jab = { damage: 10, tags: ['light'] }
const swing = { damage: 30, tags: ['heavy'] }
const shot = { damage: 10, tags: ['light', 'projectile'] }
const bigShot = { damage: 30, tags: ['heavy', 'projectile'] }

const hitsToFill = (quality: number, hit: { damage: number; tags: string[] }) => Math.ceil(staggerBarSize(quality) / staggerProgress(hit))

describe('staggerBarSize', () => {
  it('is small for a well-annotated boss and grows as annotations go missing', () => {
    expect(staggerBarSize(1)).toBeLessThan(staggerBarSize(0.5))
    expect(staggerBarSize(0.5)).toBeLessThan(staggerBarSize(0))
    expect(staggerBarSize(0)).toBe(10 * staggerBarSize(1))
  })

  it('lets a few swings stagger a documented boss but takes a long fight at quality 0', () => {
    expect(hitsToFill(1, swing)).toBeLessThanOrEqual(3)
    expect(hitsToFill(1, jab)).toBeLessThanOrEqual(10)
    expect(hitsToFill(0, swing)).toBeGreaterThanOrEqual(15)
    expect(hitsToFill(0, swing)).toBeLessThan(40)
  })
})

describe('staggerProgress', () => {
  it('ranks heavy melee over light melee over heavy shots over light shots', () => {
    const per = (hit: { damage: number; tags: string[] }) => staggerProgress(hit) / hit.damage
    expect(per(swing)).toBeGreaterThan(per(jab))
    expect(per(jab)).toBeGreaterThan(per(bigShot))
    expect(per(bigShot)).toBeGreaterThan(per(shot))
    expect(per(shot)).toBeCloseTo(0.1)
  })

  it('scales with the damage and the hit stagger multiplier', () => {
    expect(staggerProgress({ ...jab, damage: 20 })).toBeCloseTo(2 * staggerProgress(jab))
    expect(staggerProgress({ ...jab, stagger: 2 })).toBeCloseTo(2 * staggerProgress(jab))
  })
})

describe('staggerDurationMs', () => {
  it('lasts 1.2 to 1.8 s over the quality range of the stagger window', () => {
    expect(staggerDurationMs(400)).toBe(1200)
    expect(staggerDurationMs(1600)).toBe(1800)
  })
})

describe('staggerLocked', () => {
  it('locks the bar while a heavy attack winds up or hits', () => {
    expect(staggerLocked('windup', true)).toBe(true)
    expect(staggerLocked('active', true)).toBe(true)
    expect(staggerLocked('recovery', true)).toBe(false)
    expect(staggerLocked('none', true)).toBe(false)
  })

  it('never locks it for a light attack', () => {
    for (const phase of ['none', 'windup', 'active', 'recovery'] as const) expect(staggerLocked(phase, false)).toBe(false)
  })
})
