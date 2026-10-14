import type { AttackVariant } from '../../contracts/player'
import type { PlayerWeaponId, WeaponSlot } from '../../contracts/progression'
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
  // False while the weapon is out of the hand, as a thrown disc is.
  visible: boolean
}

// How the mage holds a weapon through its moves. Swing: the staff and the other melee weapons
// swing around the hand. Aim: the Bunsen staff points ahead while its flame streams out. Shield:
// the petri dish is held up in front of the body. Throw: the disc winds up and leaves the hand.
export type WeaponHold = 'swing' | 'aim' | 'shield' | 'throw'

const HOLDS: Partial<Record<PlayerWeaponId, WeaponHold>> = { bunsenStaff: 'aim', petriShield: 'shield', centrifugeDisc: 'throw' }

export function holdOf(id: PlayerWeaponId): WeaponHold {
  return HOLDS[id] ?? 'swing'
}

// The slot whose weapon the mage holds. A heavy move shows the heavy weapon from its startup to the
// end of its recovery. Once it ends or is cancelled the light weapon is back in the hand.
export function heldSlot(attack: { slot: WeaponSlot } | null): WeaponSlot {
  return attack?.slot ?? 'light'
}

export interface PosedAttack {
  heavy: boolean
  variant: AttackVariant
  plunge: boolean
  // The move spins the weapon (AttackMove.spin).
  spin: boolean
  hold: WeaponHold
}

// Radians per ms of a spinning move (dash heavies, the combo finisher).
export const SPIN_RATE = 0.03

// Writes into `out`, so the render loop allocates nothing. spinMs is the move's own clock.
export function weaponPose(attack: PosedAttack | null, phase: AttackPhase, spinMs: number, out: WeaponPose): WeaponPose {
  let poke = 0
  if (attack && phase === 'startup') poke = -0.4
  else if (attack && phase === 'active') poke = 1
  else if (attack && phase === 'recovery') poke = 0.4
  const up = attack?.variant === 'up'
  const heavy = attack?.heavy ?? false
  const hold = attack?.hold ?? 'swing'
  out.poke = poke
  out.visible = !(hold === 'throw' && (phase === 'active' || phase === 'recovery'))
  out.x = up ? 4 : 8 + poke * 8
  out.y = -12 - (up ? Math.max(0, poke) * 8 : 0)
  if (attack?.plunge && phase === 'active') out.angle = 2.8
  else if (hold === 'shield') {
    // Raised over the head for an up move, else held up in front and pushed out on the bash.
    out.x = up ? 2 : 12 + poke * 4
    out.y = up ? -24 - Math.max(0, poke) * 12 : -8
    out.angle = up ? 0 : phase === 'startup' ? -0.2 : phase === 'active' ? 0.2 : 0.35
  } else if (up) out.angle = phase === 'startup' ? -0.6 : phase === 'active' ? -0.05 : 0.15
  else if (((attack?.variant === 'dash' && heavy) || attack?.spin) && phase === 'active') out.angle = (spinMs * SPIN_RATE) % (Math.PI * 2)
  else if (hold === 'aim') {
    // Level at chest height while the flame runs along it.
    out.x = 6
    out.y = phase === 'active' ? -24 : -16
    out.angle = phase === 'startup' ? 0.9 : phase === 'active' ? Math.PI / 2 : 1.1
  } else if (heavy) out.angle = phase === 'startup' ? -0.6 : phase === 'active' ? 2 : 1.2
  else out.angle = 0.35 + Math.max(0, poke) * 1.1
  return out
}
