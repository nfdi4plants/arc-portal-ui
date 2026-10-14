// The boss stagger bar. Plain math, nothing here imports Phaser.
//
// Every player hit fills the bar by its damage times a factor for the kind of hit. A full bar
// staggers the boss, pushes it back a little and empties. A well-annotated boss has a small bar and
// staggers often, a barely annotated one a bar so large that a stagger takes a long fight.

export type AttackPhase = 'none' | 'windup' | 'active' | 'recovery'

// Bar size at quality 1. Ten light staff jabs or two heavy swings fill it.
const BAR_AT_FULL_QUALITY = 60
// At quality 0 the bar is this many times larger.
const LOW_QUALITY_FACTOR = 10

export function staggerBarSize(quality: number): number {
  const q = Math.min(1, Math.max(0, quality))
  return BAR_AT_FULL_QUALITY / (1 / LOW_QUALITY_FACTOR + (1 - 1 / LOW_QUALITY_FACTOR) * q)
}

// How much each kind of hit staggers per point of damage. Big melee swings shake the boss, a
// stream of light shots barely does.
export const STAGGER_FACTOR = {
  heavyMelee: 1,
  lightMelee: 0.6,
  heavyProjectile: 0.4,
  lightProjectile: 0.1,
} as const

export function staggerProgress(hit: { damage: number; tags: readonly string[]; stagger?: number }): number {
  const heavy = hit.tags.includes('heavy')
  const factor = hit.tags.includes('projectile')
    ? heavy
      ? STAGGER_FACTOR.heavyProjectile
      : STAGGER_FACTOR.lightProjectile
    : heavy
      ? STAGGER_FACTOR.heavyMelee
      : STAGGER_FACTOR.lightMelee
  return Math.max(0, hit.damage * factor * (hit.stagger ?? 1))
}

// How long a stagger lasts. A better annotated step gives a longer stagger window, see bossFromNode.
export function staggerDurationMs(staggerWindowMs: number): number {
  return 1000 + staggerWindowMs / 2
}

// A heavy attack that is winding up or hitting locks the bar: hits add nothing and the boss cannot
// be staggered until the attack reaches its recovery. Light attacks never lock it.
export function staggerLocked(phase: AttackPhase, heavy: boolean): boolean {
  return heavy && (phase === 'windup' || phase === 'active')
}
