import type { FxArt, ProjectileArt } from '../../../contracts/art'
import type { HitShape } from '../../../contracts/combat'
import type { AttackContext, AttackMove, WeaponMoveset } from '../../../contracts/player'
import type { WeaponSlot } from '../../../contracts/progression'
import type { FxPool } from './fx'
import type { Point } from './helpers'
import type { Scheduler } from './scheduler'
import { UNGROUPED } from './scheduler'

// Building blocks shared by the weapon movesets.

export type Timing = Omit<AttackMove, 'name' | 'onActive'>

// Where shots leave the mage, relative to the feet. x is mirrored with the facing.
const MUZZLE = { x: 10, y: -26 }

export function muzzle(ctx: AttackContext): Point {
  const feet = ctx.player.position()
  return { x: feet.x + ctx.player.facing() * MUZZLE.x, y: feet.y + MUZZLE.y }
}

// What the effects that follow a heavy move (DOI Excalibur, Heavy Shockwave) read from it.
export interface HeavyDeclaration {
  // The damage one target takes from the main hit of the move, before the damage multiplier. The
  // pulses of a flame cone and the two cuts of Dual Scalpels add up.
  damage: number
  // Time from the start of the active phase until that damage, before the attack speed divides it.
  delayMs?: number
}

const declared = new WeakMap<AttackMove, HeavyDeclaration>()

export function heavyOf(move: AttackMove): HeavyDeclaration | undefined {
  return declared.get(move)
}

// For a move derived from another one (a fallback variant), so the extras still read its damage.
export function declareHeavy(move: AttackMove, heavy: HeavyDeclaration): void {
  declared.set(move, heavy)
}

export function move(
  name: string,
  timing: Timing,
  onActive: (ctx: AttackContext, self: AttackMove) => void,
  heavy?: HeavyDeclaration,
): AttackMove {
  const result: AttackMove = { name, ...timing, onActive: (ctx) => onActive(ctx, result) }
  if (heavy) declared.set(result, heavy)
  return result
}

// The attack machine divides every phase by the attack speed, so a hitbox lasts as long as the
// active phase does.
export function activeMs(ctx: AttackContext, self: AttackMove): number {
  return self.activeMs / ctx.player.getBuild().stats.attackSpeed
}

// The movesets are module constants that know nothing of the loadout, so the move layer binds the
// loadout's scheduler to its wielder and `later` looks it up there. Per wielder, not per scene:
// the FAIR trader wields a loadout of his own in the same scene as the mage.
const schedulers = new WeakMap<object, Scheduler>()

export function bindScheduler(wielder: object, scheduler: Scheduler): () => void {
  schedulers.set(wielder, scheduler)
  return () => {
    if (schedulers.get(wielder) === scheduler) schedulers.delete(wielder)
  }
}

// Group of the sub-hits that belong to one attack. The move layer drops the group when the mage is
// hit or dashes out of the attack.
export const SUB_HITS = 1

// Delays inside a move run on the loadout's fixed-step scheduler, so they stand still during
// hit-stop like the hitboxes and projectiles they spawn.
export function later(ctx: AttackContext, delayMs: number, run: () => void, group = SUB_HITS): void {
  schedulers.get(ctx.player)?.at(delayMs, run, group)
}

// The loadout's effect pool, bound the same way as the scheduler. Without a loadout (the test
// room) the effects are skipped and the hits still land.
const fxPools = new WeakMap<object, FxPool>()

export function bindFx(wielder: object, fx: FxPool): () => void {
  fxPools.set(wielder, fx)
  return () => {
    if (fxPools.get(wielder) === fx) fxPools.delete(wielder)
  }
}

// ARCitect's ISA blocks need the physics world and the loadout, which the movesets know nothing
// of. legendaryFeature.ts binds a builder per wielder. It puts a block of `kind` at the x and
// returns the floor it stands on, or null when the block could not stand there.
export type BlockBuilder = (kind: 'assay' | 'study' | 'investigation', x: number, fromY: number) => number | null

const builders = new WeakMap<object, BlockBuilder>()

export function bindBuilder(wielder: object, builder: BlockBuilder): () => void {
  builders.set(wielder, builder)
  return () => {
    if (builders.get(wielder) === builder) builders.delete(wielder)
  }
}

// Without a builder (the tests) the block only hits, on the floor under the mage.
export function placeBlock(ctx: AttackContext, kind: 'assay' | 'study' | 'investigation', x: number): number {
  const feet = ctx.player.position()
  return builders.get(ctx.player)?.(kind, x, feet.y) ?? feet.y
}

export function burst(ctx: AttackContext, x: number, y: number, kind: FxArt, size = 1): void {
  fxPools.get(ctx.player)?.burst(x, y, kind, size)
}

export function streak(ctx: AttackContext, x1: number, y1: number, x2: number, y2: number, durationMs: number): void {
  fxPools.get(ctx.player)?.line(x1, y1, x2, y2, durationMs)
}

// The top of the nearest floor (any static body, one-way platforms included) below a world point,
// or null when there is none within maxDepth. It allocates the result list of the query, so call
// it once per attack, never per step.
export function groundBelow(ctx: AttackContext, x: number, y: number, maxDepth: number): number | null {
  const bodies = ctx.scene.physics.overlapRect(x - 1, y, 2, maxDepth, false, true)
  let best: number | null = null
  for (const body of bodies) {
    if (body.top >= y - 1 && (best === null || body.top < best)) best = body.top
  }
  return best
}

export interface Area {
  art: ProjectileArt
  // Relative to the area's point, which is the projectile position.
  shape: HitShape
  damage: number
  // Relative to `face`.
  knockback: Point
  lifetimeMs: number
  hitStopMs?: number
  tags: string[]
  // Which way the knockback points. Defaults to the mage's facing.
  face?: 1 | -1
  // 0 makes a visual that hits nothing.
  maxTargets?: number
}

// The combat world faces a projectile the way it flies. This speed is too small to move the area
// by a visible amount but still sets its facing.
const STILL_SPEED = 0.001

// A hit area fixed to a world point, as a projectile that stands still. A hitbox would follow the
// mage or be placed relative to the mage, and lingering areas (puddles, fire) must stay put.
export function spawnArea(ctx: AttackContext, at: Point, area: Area): void {
  const ref = ctx.art.projectile(ctx.scene, area.art)
  const face = area.face ?? ctx.player.facing()
  ctx.combat.spawnProjectile(
    {
      owner: ctx.player,
      shape: area.shape,
      textureKey: ref.textureKey,
      animKey: ref.animKey,
      velocity: { x: face * STILL_SPEED, y: 0 },
      gravity: 0,
      lifetimeMs: area.lifetimeMs,
      pierce: 99,
      reflectable: false,
      damage: area.damage,
      knockback: area.knockback,
      hitStopMs: area.hitStopMs ?? 0,
      maxTargets: area.maxTargets ?? Infinity,
      tags: area.tags,
    },
    at,
  )
}

// An area that hits again every `everyMs`, `ticks` times. Each tick is a new area, so a target
// standing in it is hit once per tick. The ticks are ungrouped, so a hit on the mage or a dash
// leaves the area in place.
export function linger(ctx: AttackContext, at: Point, area: Area, ticks: number, everyMs: number): void {
  spawnArea(ctx, at, area)
  for (let i = 1; i < ticks; i++) later(ctx, i * everyMs, () => spawnArea(ctx, at, area), UNGROUPED)
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
  // A rect hit shape for flat attacks such as ground shockwaves. Without it the shot is a circle.
  rect?: { w: number; h: number }
  // 0 makes a shot that only shows, for effects built from projectile art.
  maxTargets?: number
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
      maxTargets: shot.maxTargets ?? Infinity,
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
  // Mobs only stagger from a shot tagged 'heavy', which a move earns by committing the mage while
  // it fires. Defaults to ['heavy', 'shockwave'].
  tags?: string[]
}

const WAVE_TAGS = ['heavy', 'shockwave']

// Distance from the mage's centre to the inner edge of each wave. The gap keeps an enemy next to
// the mage out of both waves in the same step.
const WAVE_GAP = 12

// Two flat waves along the ground, one each way. The knockback follows each wave's own direction.
export function spawnShockwaves(ctx: AttackContext, wave: WaveOptions): void {
  const feet = ctx.player.position()
  const lifetimeMs = (wave.distance / wave.speed) * 1000
  for (const dir of [1, -1]) {
    fireShot(ctx, { x: feet.x + dir * (WAVE_GAP + wave.width / 2), y: feet.y - wave.height / 2 }, {
      art: 'orb',
      velocity: { x: dir * wave.speed, y: 0 },
      damage: wave.damage,
      radius: wave.width / 2,
      rect: { w: wave.width, h: wave.height },
      lifetimeMs,
      pierce: 99,
      knockback: { x: 120, y: -150 },
      hitStopMs: 0,
      tags: wave.tags ?? WAVE_TAGS,
    })
  }
}

// Variants share one timing helper. They may all start in the air.
export const variantTiming = (startupMs: number, activeMs: number, recoveryMs: number, cancelAfterMs: number, extra: Partial<Timing> = {}): Timing => ({
  startupMs,
  activeMs,
  recoveryMs,
  cancelAfterMs,
  allowedInAir: true,
  ...extra,
})

// Dash lights carry the dash, never lock and cancel right after their hit.
export const dashLightTiming = (startupMs: number, activeMs: number, recoveryMs: number): Timing =>
  variantTiming(startupMs, activeMs, recoveryMs, 0, { keepsMomentum: true })

// How long a hitbox riding on a plunge should last: until the expected landing, so a plunge cut
// short by a hit leaves no box behind for long.
export function fallMs(ctx: AttackContext, speed: number): number {
  const feet = ctx.player.position()
  const floor = groundBelow(ctx, feet.x, feet.y, 600)
  return floor === null ? 600 : ((floor - feet.y) / speed) * 1000 + 40
}

// A box over the head that follows the mage. The melee range stretches it upward, not sideways.
export function overheadBox(
  ctx: AttackContext,
  reach: number,
  width: number,
  durationMs: number,
  damage: number,
  knockback: Point,
  hitStopMs: number,
  tags: string[],
): void {
  const height = reach * ctx.rangeScale
  ctx.combat.spawnHitbox({
    owner: ctx.player,
    shape: { kind: 'rect', x: -width / 2, y: -30 - height, w: width, h: height },
    follow: true,
    activeMs: durationMs,
    damage,
    knockback,
    hitStopMs,
    maxTargets: Infinity,
    tags,
  })
}

// A variant is built once per tier, because the attack machine asks on every attack.
export function memoTier(build: (tier: 1 | 2) => AttackMove): (tier: 1 | 2) => AttackMove {
  const cache: (AttackMove | undefined)[] = [undefined, undefined]
  return (tier) => (cache[tier - 1] ??= build(tier))
}

// Move lists are built once per slot and tier, because the attack machine asks on every attack.
export function memoMoves(build: (slot: WeaponSlot, tier: 1 | 2) => AttackMove[]): WeaponMoveset['moves'] {
  const cache: (AttackMove[] | undefined)[] = [undefined, undefined, undefined, undefined]
  return (slot, tier) => {
    const index = (slot === 'light' ? 0 : 2) + tier - 1
    return (cache[index] ??= build(slot, tier))
  }
}
