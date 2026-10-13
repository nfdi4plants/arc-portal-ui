import type { Combatant } from '../../contracts/combat'

export type DamageModifier = (attacker: Combatant, base: number) => { damage: number; crit: boolean }

// The modifier belongs to the attacker's build (crit chance, damage multipliers). Without one the
// base damage lands as it is.
export function applyDamageModifier(
  modifier: DamageModifier | null,
  attacker: Combatant,
  base: number,
): { damage: number; crit: boolean } {
  return modifier ? modifier(attacker, base) : { damage: base, crit: false }
}
