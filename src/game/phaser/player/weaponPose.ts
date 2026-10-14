import type { AttackVariant } from '../../contracts/player'
import type { AttackPhase } from './attacks'

// Where the held weapon sits for a right-facing mage, relative to the feet and before the idle bob.
// The sprite stands upright with the grip at its origin, so `angle` (from upright, positive tips it
// forward) swings it around the hand. The player draws the weapon from this pose, and the hitbox
// tests check that each melee box covers the weapon drawn here.
export interface WeaponPose {
  x: number
  y: number
  angle: number
  // -0.4 winding up, 1 striking, 0.4 recovering, 0 idle. The player leans the mage with it.
  poke: number
}

export interface PosedAttack {
  heavy: boolean
  variant: AttackVariant
  plunge: boolean
}

// Turns per ms of a dash heavy's spin.
export const SPIN_RATE = 0.03

// Writes into `out`, so the render loop allocates nothing. spinMs is the move's own clock.
export function weaponPose(attack: PosedAttack | null, phase: AttackPhase, spinMs: number, out: WeaponPose): WeaponPose {
  let poke = 0
  if (attack && phase === 'startup') poke = -0.4
  else if (attack && phase === 'active') poke = 1
  else if (attack && phase === 'recovery') poke = 0.4
  const up = attack?.variant === 'up'
  const heavy = attack?.heavy ?? false
  out.poke = poke
  out.x = up ? 4 : 8 + poke * 8
  out.y = -12 - (up ? Math.max(0, poke) * 8 : 0)
  if (up) out.angle = phase === 'startup' ? -0.6 : phase === 'active' ? -0.05 : 0.15
  else if (attack?.plunge && phase === 'active') out.angle = 2.8
  else if (attack?.variant === 'dash' && heavy && phase === 'active') out.angle = (spinMs * SPIN_RATE) % (Math.PI * 2)
  else if (heavy) out.angle = phase === 'startup' ? -0.6 : phase === 'active' ? 2 : 1.2
  else out.angle = 0.35 + Math.max(0, poke) * 1.1
  return out
}
