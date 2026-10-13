export interface DefenseInput {
  // The armored passive.
  armored: boolean
  // A shield weapon that is not in the middle of an attack.
  shieldUp: boolean
  // From stanceMods: 0.6 in the defensive stance, otherwise 1.
  stanceFactor: number
  fromFront: boolean
  fromAbove: boolean
}

// The attacker stands on the side the mob faces.
export function hitFromFront(mobX: number, facing: 1 | -1, attackerX: number): boolean {
  return (attackerX - mobX) * facing > 0
}

// The attacker's feet are above the top of the mob.
export function hitFromAbove(attackerFeetY: number, mobTopY: number): boolean {
  return attackerFeetY < mobTopY
}

// Armor and a raised shield each halve a frontal hit. Hits from behind or above land in full.
export function incomingDamage(base: number, input: DefenseInput): number {
  let damage = base * input.stanceFactor
  if (input.fromFront && !input.fromAbove) {
    if (input.armored) damage *= 0.5
    if (input.shieldUp) damage *= 0.5
  }
  return Math.max(1, Math.round(damage))
}
