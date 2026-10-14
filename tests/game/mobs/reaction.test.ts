import { describe, expect, it } from 'vitest'
import { hitReaction, type ReactionInput } from '../../../src/game/phaser/mobs/reaction'

const base: ReactionInput = { size: 'medium', body: 'beetle', heavy: false, armoredFront: false, defensiveStance: false }
const react = (patch: Partial<ReactionInput>) => hitReaction({ ...base, ...patch })

describe('hitReaction', () => {
  it('pushes and staggers small mobs most on a light hit', () => {
    expect(react({ size: 'small' })).toEqual({ knockbackScale: 1.3, launch: 0, staggerMs: 220 })
    expect(react({ size: 'medium' })).toEqual({ knockbackScale: 0.9, launch: 0, staggerMs: 120 })
    expect(react({ size: 'large' })).toEqual({ knockbackScale: 0.35, launch: 0, staggerMs: 0 })
  })

  it('launches a small mob on a heavy hit and staggers every size', () => {
    expect(react({ size: 'small', heavy: true })).toEqual({ knockbackScale: 2.2, launch: 260, staggerMs: 520 })
    expect(react({ size: 'medium', heavy: true })).toEqual({ knockbackScale: 1.6, launch: 0, staggerMs: 380 })
    expect(react({ size: 'large', heavy: true })).toEqual({ knockbackScale: 0.8, launch: 0, staggerMs: 260 })
  })

  it('makes a heavy hit move and stagger more than a light one at every size', () => {
    for (const size of ['small', 'medium', 'large'] as const) {
      const light = react({ size })
      const heavy = react({ size, heavy: true })
      expect(heavy.knockbackScale).toBeGreaterThan(light.knockbackScale)
      expect(heavy.staggerMs).toBeGreaterThan(light.staggerMs)
    }
  })

  it('lets a golem resist more than a beetle of the same size', () => {
    const golem = react({ body: 'golem', size: 'medium', heavy: true })
    const beetle = react({ body: 'beetle', size: 'medium', heavy: true })
    expect(golem.knockbackScale).toBeLessThan(beetle.knockbackScale)
    expect(golem.staggerMs).toBeLessThan(beetle.staggerMs)
  })

  it('keeps a turret in place and staggers it only from heavy hits', () => {
    expect(react({ body: 'turret', size: 'small' })).toEqual({ knockbackScale: 0, launch: 0, staggerMs: 0 })
    const heavy = react({ body: 'turret', size: 'small', heavy: true })
    expect(heavy.knockbackScale).toBe(0)
    expect(heavy.launch).toBe(0)
    expect(heavy.staggerMs).toBeGreaterThan(0)
  })

  it('resists a bit more with an armored front or a defensive stance', () => {
    const plain = react({ heavy: true })
    const armored = react({ heavy: true, armoredFront: true })
    const defensive = react({ heavy: true, defensiveStance: true })
    const both = react({ heavy: true, armoredFront: true, defensiveStance: true })
    expect(armored.knockbackScale).toBeLessThan(plain.knockbackScale)
    expect(defensive.staggerMs).toBeLessThan(plain.staggerMs)
    expect(both.staggerMs).toBeLessThan(armored.staggerMs)
  })
})
