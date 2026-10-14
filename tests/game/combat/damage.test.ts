import { describe, expect, it, vi } from 'vitest'
import type { Combatant } from '../../../src/game/contracts/combat'
import { applyDamageModifier } from '../../../src/game/phaser/combat/damage'

const attacker = { id: 'mage', team: 'player' } as Combatant

describe('applyDamageModifier', () => {
  it('passes the base damage through without a modifier', () => {
    expect(applyDamageModifier(null, attacker, 12)).toEqual({ damage: 12, crit: false })
  })

  it('lets the modifier decide the final damage and crit', () => {
    const modifier = vi.fn((_attacker: Combatant, base: number) => ({ damage: base * 2, crit: true }))
    expect(applyDamageModifier(modifier, attacker, 12)).toEqual({ damage: 24, crit: true })
    expect(modifier).toHaveBeenCalledWith(attacker, 12)
  })
})
