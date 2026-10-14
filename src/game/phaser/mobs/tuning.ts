import type { ProjectileArt } from '../../contracts/art'
import { TILE } from '../../contracts/constants'
import type { BodyKind, MonsterSpec } from '../../contracts/content'

// Feel constants for mobs, in world units and milliseconds. Spec stats (hp, damage, speed, range)
// come from the generator, so only behaviour timing lives here.

export const GRAVITY = 1900
export const TERMINAL_FALL = 720
export const MAX_SPEED_X = 600

export const CONTACT_COOLDOWN_MS = 600
export const CONTACT_ACTIVE_MS = 60
export const HIT_FLASH_MS = 90
export const HIT_STUN_MS = 160
export const DEATH_MS = 420
// A mob this far below its spawn point fell out of the level and is dropped without a kill.
export const FALL_LIMIT = 1500

export const WANDER_RADIUS = 2 * TILE
export const PATROL_RADIUS = 4 * TILE
// Aggro ends only when the player is this much farther than the aggro range, so the edge does not flicker.
export const AGGRO_RELEASE = 1.15
// A hit provokes the mob for this long whatever the distance, so shots from beyond its aggro range
// still draw it to the player. Each further hit restarts the timer.
export const PROVOKE_MS = 6000

export const BLINK_MIN_MS = 2500
export const BLINK_MAX_MS = 4000
export const BLINK_REACH = 4 * TILE
export const BLINK_FLASH_MS = 250
export const BLINK_STAND_OFF = 40

export const MINION_COUNT = 2
export const MINION_HP_SHARE = 0.25
export const MINION_DAMAGE_SHARE = 0.5

export const BOMB_FUSE_MS = 1200
export const BOMB_SLOTS = 2
export const LOB_GRAVITY = 900

// How much of the sprite box the hurtbox covers. The sprite includes the weapon and head marks.
export const HURTBOX_WIDTH = 0.7
export const HURTBOX_HEIGHT = 0.85

// Flyers start this high above the point the scene gives them.
export const HOVER_HEIGHT: Partial<Record<BodyKind, number>> = { wisp: 40, bat: 72 }

export interface PoiseEntry {
  // Multiplies the hit's world-space knockback.
  knockback: number
  // Upward speed added to a mob that stands on the ground.
  launch: number
  staggerMs: number
}

// How a mob of each size reacts to a light and to a heavy player hit.
export const POISE: Record<MonsterSpec['size'], { light: PoiseEntry; heavy: PoiseEntry }> = {
  small: { light: { knockback: 1.3, launch: 0, staggerMs: 220 }, heavy: { knockback: 2.2, launch: 260, staggerMs: 520 } },
  medium: { light: { knockback: 0.9, launch: 0, staggerMs: 120 }, heavy: { knockback: 1.6, launch: 0, staggerMs: 380 } },
  large: { light: { knockback: 0.35, launch: 0, staggerMs: 0 }, heavy: { knockback: 0.8, launch: 0, staggerMs: 260 } },
}

// Bodies that resist more than their size says. A turret never moves and staggers only from heavy hits.
export const BODY_POISE: Partial<Record<BodyKind, { knockback: number; launch: number; stagger: number }>> = {
  golem: { knockback: 0.7, launch: 0.5, stagger: 0.75 },
  turret: { knockback: 0, launch: 0, stagger: 1 },
}

// Armored front and defensive stance each shave this much off knockback and stagger.
export const BRACE_FACTOR = 0.8
// Stagger longer than this shows the dizzy stars.
export const DIZZY_MIN_MS = 300
// A staggered mob may attack this long after it recovers.
export const STAGGER_RECOVER_MS = 250
// The pause dim of the gameplay scene sits above the world and below the mob the player inspects.
export const INSPECT_DIM_DEPTH = 150
export const PAUSE_DIM_ALPHA = 0.45
export const SQUASH_MS = 140
export const HIT_TILT_DEG = 12
export const HIT_SQUASH = 0.18
// Time in the air before a launched mob counts as landed, so the first step after the launch
// (which still reports the ground) is skipped.
export const LAUNCH_GRACE_MS = 90

export interface MeleeTuning {
  windupMs: number
  activeMs: number
  recoverMs: number
  // Hitbox height as a multiple of the body height (before the weapon scale).
  thickness: number
  knockback: { x: number; y: number }
}

export const MELEE: Record<'claw' | 'spear' | 'whip' | 'shield', MeleeTuning> = {
  claw: { windupMs: 200, activeMs: 120, recoverMs: 250, thickness: 1, knockback: { x: 200, y: -120 } },
  whip: { windupMs: 250, activeMs: 160, recoverMs: 300, thickness: 0.55, knockback: { x: 180, y: -100 } },
  spear: { windupMs: 300, activeMs: 140, recoverMs: 350, thickness: 0.5, knockback: { x: 220, y: -110 } },
  shield: { windupMs: 350, activeMs: 140, recoverMs: 350, thickness: 1, knockback: { x: 260, y: -90 } },
}

export interface RangedTuning {
  windupMs: number
  art: ProjectileArt
  // Units per second for straight shots. Lobbed shots (gravity above 0) use a flight time instead.
  speed: number
  gravity: number
  // Hitbox size at weapon scale 1.
  size: { w: number; h: number }
}

export const RANGED: Record<'bow' | 'wand' | 'flask' | 'bomb', RangedTuning> = {
  bow: { windupMs: 250, art: 'arrow', speed: 320, gravity: 0, size: { w: 14, h: 5 } },
  wand: { windupMs: 220, art: 'bolt', speed: 240, gravity: 0, size: { w: 10, h: 10 } },
  flask: { windupMs: 250, art: 'droplet', speed: 0, gravity: LOB_GRAVITY, size: { w: 12, h: 12 } },
  bomb: { windupMs: 300, art: 'bomb', speed: 0, gravity: LOB_GRAVITY, size: { w: 12, h: 12 } },
}

// Blast radius of a bomb at weapon scale 1.
export const BLAST_RADIUS = 38

// The golem walks slowly and hits hard.
export const GOLEM_DAMAGE = 1.3
export const GOLEM_WINDUP_MS = 50

export const PROJECTILE_KNOCKBACK = { x: 150, y: -100 }
export const CONTACT_KNOCKBACK = { x: 150, y: -140 }
