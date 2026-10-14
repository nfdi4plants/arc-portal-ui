import { describe, expect, it } from 'vitest'
import type { Combatant } from '../../../src/game/contracts/combat'
import { createDamageModifier, damageMultiplier, rollHit } from '../../../src/game/phaser/player/weapons/helpers'

const player = { id: 'player' } as Combatant
const dummy = { id: 'dummy' } as Combatant

describe('damageMultiplier', () => {
  it('multiplies the damage stat by 1.2 with the F letter', () => {
    expect(damageMultiplier(1.5, false)).toBe(1.5)
    expect(damageMultiplier(1.5, true)).toBeCloseTo(1.8)
  })
})

describe('rollHit', () => {
  const state = { multiplier: 2, critChance: 0.25, critMultiplier: 1.5 }

  it('applies the multiplier without a crit', () => {
    expect(rollHit(10, state, 0.9)).toEqual({ damage: 20, crit: false })
  })

  it('crits when the roll is below the chance', () => {
    expect(rollHit(10, state, 0.1)).toEqual({ damage: 30, crit: true })
  })

  it('does not crit when the roll equals the chance', () => {
    expect(rollHit(10, state, 0.25).crit).toBe(false)
  })
})

describe('createDamageModifier', () => {
  it('scales and crits attacks of the owner', () => {
    const state = { multiplier: 1.15, critChance: 0.5, critMultiplier: 2 }
    const modifier = createDamageModifier(player, state, () => 0.1)
    expect(modifier(player, 10)).toEqual({ damage: 10 * 1.15 * 2, crit: true })
  })

  it('leaves other attackers unchanged and does not draw a roll', () => {
    let rolls = 0
    const modifier = createDamageModifier(player, { multiplier: 3, critChance: 1, critMultiplier: 5 }, () => {
      rolls++
      return 0
    })
    expect(modifier(dummy, 10)).toEqual({ damage: 10, crit: false })
    expect(rolls).toBe(0)
  })

  it('follows state changes made after creation', () => {
    const state = { multiplier: 1, critChance: 0, critMultiplier: 1.5 }
    const modifier = createDamageModifier(player, state, () => 0.5)
    expect(modifier(player, 10).damage).toBe(10)
    state.multiplier = damageMultiplier(1.15, true)
    expect(modifier(player, 10).damage).toBeCloseTo(10 * 1.15 * 1.2)
  })
})
