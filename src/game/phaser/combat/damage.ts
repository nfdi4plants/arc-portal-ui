import type { Combatant } from '../../contracts/combat'

// `tags` are the tags of the hit ('projectile' included for shots) and `target` the one it lands on,
// for bonuses that depend on the kind of hit or on whom it hits (corrupted augments).
export type DamageModifier = (attacker: Combatant, base: number, tags: readonly string[], target: Combatant) => { damage: number; crit: boolean }

// The modifier belongs to the attacker's build (crit chance, damage multipliers). Without one the
// base damage lands as it is.
// Runs a hit through every modifier in turn. It crits when any of them says so.
export function applyDamageModifiers(
  modifiers: readonly DamageModifier[],
  attacker: Combatant,
  base: number,
  tags: readonly string[],
  target: Combatant,
): { damage: number; crit: boolean } {
  let damage = base
  let crit = false
  for (const modifier of modifiers) {
    const result = modifier(attacker, damage, tags, target)
    damage = result.damage
    crit ||= result.crit
  }
  return { damage, crit }
}

export function applyDamageModifier(
  modifier: DamageModifier | null,
  attacker: Combatant,
  base: number,
  tags: readonly string[] = [],
  target: Combatant = attacker,
): { damage: number; crit: boolean } {
  return modifier ? modifier(attacker, base, tags, target) : { damage: base, crit: false }
}
