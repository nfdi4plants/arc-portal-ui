import type { ProjectileArt } from '../../../contracts/art'
import type { AttackContext, AttackMove, WeaponMoveset } from '../../../contracts/player'
import type { WeaponSlot } from '../../../contracts/progression'
import type { Point } from './helpers'

// Building blocks shared by the weapon movesets.

export type Timing = Omit<AttackMove, 'name' | 'onActive'>

// Where shots leave the mage, relative to the feet. x is mirrored with the facing.
const MUZZLE = { x: 10, y: -26 }

export function muzzle(ctx: AttackContext): Point {
  const feet = ctx.player.position()
  return { x: feet.x + ctx.player.facing() * MUZZLE.x, y: feet.y + MUZZLE.y }
}

export function move(name: string, timing: Timing, onActive: (ctx: AttackContext, self: AttackMove) => void): AttackMove {
  const result: AttackMove = { name, ...timing, onActive: (ctx) => onActive(ctx, result) }
  return result
}

// The attack machine divides every phase by the attack speed, so a hitbox lasts as long as the
// active phase does.
export function activeMs(ctx: AttackContext, self: AttackMove): number {
  return self.activeMs / ctx.player.getBuild().stats.attackSpeed
}

// Delays inside a move use the scene clock. They drift from the move's own timing by the length
// of a hit-stop at most.
export function later(ctx: AttackContext, delayMs: number, run: () => void): void {
  ctx.scene.time.delayedCall(delayMs, run)
}

export interface MeleeHit {
  // A rect relative to the feet, facing right. x and w grow with the melee range stat.
  x: number
  y: number
  w: number
  h: number
  damage: number
  knockback: Point
  hitStopMs: number
  tags: string[]
}

export function spawnMelee(ctx: AttackContext, durationMs: number, hit: MeleeHit): void {
  const scale = ctx.rangeScale
  ctx.combat.spawnHitbox({
    owner: ctx.player,
    shape: { kind: 'rect', x: hit.x * scale, y: hit.y, w: hit.w * scale, h: hit.h },
    follow: true,
    activeMs: durationMs,
    damage: hit.damage,
    knockback: hit.knockback,
    hitStopMs: hit.hitStopMs,
    maxTargets: Infinity,
    tags: hit.tags,
  })
}

export interface Shot {
  art: ProjectileArt
  velocity: Point
  damage: number
  // World units. The shape is a circle around the projectile.
  radius: number
  lifetimeMs: number
  pierce?: number
  knockback: Point
  hitStopMs?: number
  tags: string[]
  gravity?: number
  // Rect instead of a circle, for flat shapes such as ground shockwaves.
  rect?: { w: number; h: number }
}

export function fireShot(ctx: AttackContext, origin: Point, shot: Shot): void {
  const ref = ctx.art.projectile(ctx.scene, shot.art)
  const { rect } = shot
  ctx.combat.spawnProjectile(
    {
      owner: ctx.player,
      shape: rect ? { kind: 'rect', x: -rect.w / 2, y: -rect.h / 2, w: rect.w, h: rect.h } : { kind: 'circle', x: 0, y: 0, r: shot.radius },
      textureKey: ref.textureKey,
      animKey: ref.animKey,
      velocity: shot.velocity,
      gravity: shot.gravity ?? 0,
      lifetimeMs: shot.lifetimeMs,
      pierce: shot.pierce ?? 0,
      reflectable: false,
      damage: shot.damage,
      knockback: shot.knockback,
      hitStopMs: shot.hitStopMs ?? 0,
      maxTargets: Infinity,
      tags: shot.tags,
    },
    origin,
  )
}

export interface WaveOptions {
  damage: number
  // Size of the flat wave box, in world units.
  width: number
  height: number
  speed: number
  distance: number
}

// Two flat waves along the ground, one each way. The knockback follows each wave's own direction.
export function spawnShockwaves(ctx: AttackContext, wave: WaveOptions): void {
  const feet = ctx.player.position()
  const lifetimeMs = (wave.distance / wave.speed) * 1000
  for (const dir of [1, -1]) {
    fireShot(ctx, { x: feet.x + dir * 14, y: feet.y - wave.height / 2 }, {
      art: 'orb',
      velocity: { x: dir * wave.speed, y: 0 },
      damage: wave.damage,
      radius: wave.width / 2,
      rect: { w: wave.width, h: wave.height },
      lifetimeMs,
      pierce: 99,
      knockback: { x: 120, y: -150 },
      hitStopMs: 0,
      tags: ['heavy', 'shockwave'],
    })
  }
}

// Move lists are built once per slot and tier, because the attack machine asks on every attack.
export function memoMoves(build: (slot: WeaponSlot, tier: 1 | 2) => AttackMove[]): WeaponMoveset['moves'] {
  const cache: (AttackMove[] | undefined)[] = [undefined, undefined, undefined, undefined]
  return (slot, tier) => {
    const index = (slot === 'light' ? 0 : 2) + tier - 1
    return (cache[index] ??= build(slot, tier))
  }
}
