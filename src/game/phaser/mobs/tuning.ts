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

// Heavier mobs are pushed less.
export const KNOCKBACK_MASS: Record<MonsterSpec['size'], number> = { small: 1, medium: 0.8, large: 0.55 }

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
