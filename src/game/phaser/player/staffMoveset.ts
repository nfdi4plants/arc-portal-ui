import type { HitShape } from '../../contracts/combat'
import type { AttackContext, AttackMove, WeaponMoveset } from '../../contracts/player'
import { burst, groundBelow, streak } from './weapons/kit'

interface StaffHit {
  // Rect relative to the player's feet, facing right. x and w grow with the melee range stat.
  shape: { x: number; y: number; w: number; h: number }
  damage: number
  knockback: { x: number; y: number }
  hitStopMs: number
  tags: string[]
}

function spawn(ctx: AttackContext, attack: AttackMove, hit: StaffHit): void {
  const scale = ctx.rangeScale
  const shape: HitShape = { kind: 'rect', x: hit.shape.x * scale, y: hit.shape.y, w: hit.shape.w * scale, h: hit.shape.h }
  ctx.combat.spawnHitbox({
    owner: ctx.player,
    shape,
    follow: true,
    activeMs: attack.activeMs / ctx.player.getBuild().stats.attackSpeed,
    damage: hit.damage,
    knockback: hit.knockback,
    hitStopMs: hit.hitStopMs,
    maxTargets: Infinity,
    tags: hit.tags,
  })
}

function move(name: string, timing: Omit<AttackMove, 'name' | 'onActive'>, hit: StaffHit): AttackMove {
  const result: AttackMove = { name, ...timing, onActive: (ctx) => spawn(ctx, result, hit) }
  return result
}

const JAB_SHAPE = { x: 4, y: -34, w: 38, h: 18 }

const LIGHT: AttackMove[] = [
  move(
    'Staff jab',
    { startupMs: 60, activeMs: 80, recoveryMs: 140, cancelAfterMs: 60, lunge: 140, allowedInAir: true },
    { shape: JAB_SHAPE, damage: 10, knockback: { x: 110, y: -40 }, hitStopMs: 35, tags: ['light'] },
  ),
  move(
    'Staff jab',
    { startupMs: 60, activeMs: 80, recoveryMs: 140, cancelAfterMs: 60, lunge: 140, allowedInAir: true },
    { shape: JAB_SHAPE, damage: 10, knockback: { x: 110, y: -40 }, hitStopMs: 35, tags: ['light'] },
  ),
  move(
    'Staff thrust',
    { startupMs: 80, activeMs: 90, recoveryMs: 220, cancelAfterMs: 130, lunge: 220, allowedInAir: true },
    { shape: { x: 4, y: -36, w: 46, h: 22 }, damage: 16, knockback: { x: 300, y: -160 }, hitStopMs: 55, tags: ['light'] },
  ),
]

const HEAVY: AttackMove[] = [
  move(
    'Staff slam',
    { startupMs: 280, activeMs: 120, recoveryMs: 320, cancelAfterMs: 200, lunge: 80, allowedInAir: false },
    { shape: { x: -10, y: -60, w: 72, h: 60 }, damage: 30, knockback: { x: 260, y: -260 }, hitStopMs: 70, tags: ['heavy'] },
  ),
]

// A hitbox of a variant, sized in world units and scaled by the melee range where it reaches out.
function hitbox(ctx: AttackContext, shape: HitShape, activeMs: number, hit: Omit<StaffHit, 'shape'>, follow = true): void {
  ctx.combat.spawnHitbox({
    owner: ctx.player,
    shape,
    follow,
    activeMs: activeMs / ctx.player.getBuild().stats.attackSpeed,
    damage: hit.damage,
    knockback: hit.knockback,
    hitStopMs: hit.hitStopMs,
    maxTargets: Infinity,
    tags: hit.tags,
  })
}

const METEOR_SPEED = 700
// The fall hitbox lasts until the expected landing, so a plunge cut short by a hit leaves no box
// riding along for long. Without a floor below it lasts this long.
const METEOR_FALL_FALLBACK_MS = 600

// Meteor Staff: a short hang, a straight plunge with the staff below the feet, and a ring on the
// landing that throws enemies up.
const METEOR: AttackMove = {
  name: 'Meteor Staff',
  startupMs: 90,
  activeMs: 0,
  recoveryMs: 220,
  cancelAfterMs: 160,
  allowedInAir: true,
  hover: { ms: 90 },
  plunge: { speed: METEOR_SPEED },
  landingLockMs: 220,
  onActive(ctx) {
    const feet = ctx.player.position()
    const floor = groundBelow(ctx, feet.x, feet.y, 600)
    const fallMs = floor === null ? METEOR_FALL_FALLBACK_MS : ((floor - feet.y) / METEOR_SPEED) * 1000 + 40
    hitbox(ctx, { kind: 'rect', x: -12, y: -12, w: 24, h: 26 }, fallMs, {
      damage: 10,
      knockback: { x: 60, y: 200 },
      hitStopMs: 20,
      tags: ['heavy', 'plunge'],
    })
  },
  onLand(ctx) {
    const feet = ctx.player.position()
    const r = 48 * ctx.rangeScale
    hitbox(ctx, { kind: 'circle', x: 0, y: -8, r }, 110, { damage: 28, knockback: { x: 90, y: -340 }, hitStopMs: 80, tags: ['heavy', 'slam'] }, false)
    burst(ctx, feet.x, feet.y - 6, 'crit', r / 22)
    burst(ctx, feet.x, feet.y, 'dust', r / 30)
  },
}

// Staff Lunge: the dash carries a long jab. It never locks and cancels right after the hit.
const LUNGE: AttackMove = {
  name: 'Staff Lunge',
  startupMs: 40,
  activeMs: 90,
  recoveryMs: 120,
  cancelAfterMs: 0,
  allowedInAir: true,
  keepsMomentum: true,
  onActive(ctx) {
    const scale = ctx.rangeScale
    hitbox(ctx, { kind: 'rect', x: 0, y: -36, w: 52 * scale, h: 20 }, 90, { damage: 12, knockback: { x: 220, y: -60 }, hitStopMs: 40, tags: ['light'] })
  },
}

// Comet Sweep: the staff spins around the mage while the dash carries it, so it hits on both sides
// of the dash path.
const COMET: AttackMove = {
  name: 'Comet Sweep',
  startupMs: 70,
  activeMs: 160,
  recoveryMs: 220,
  cancelAfterMs: 150,
  allowedInAir: true,
  keepsMomentum: true,
  lockMs: 150,
  onActive(ctx) {
    const scale = ctx.rangeScale
    hitbox(ctx, { kind: 'rect', x: -40 * scale, y: -46, w: 80 * scale, h: 46 }, 160, {
      damage: 24,
      knockback: { x: 200, y: -240 },
      hitStopMs: 60,
      tags: ['heavy'],
    })
  },
}

// Skyward Jab: a quick poke over the head that lifts small enemies a little.
const SKYWARD: AttackMove = {
  name: 'Skyward Jab',
  startupMs: 60,
  activeMs: 80,
  recoveryMs: 140,
  cancelAfterMs: 60,
  allowedInAir: true,
  onActive(ctx) {
    const reach = 48 * ctx.rangeScale
    hitbox(ctx, { kind: 'rect', x: -12, y: -32 - reach, w: 24, h: reach }, 80, { damage: 10, knockback: { x: 30, y: -260 }, hitStopMs: 35, tags: ['light'] })
  },
}

// Lightning Rod: the staff points up and a tall strike runs from it, high enough for flyers.
const ROD: AttackMove = {
  name: 'Lightning Rod',
  startupMs: 160,
  activeMs: 100,
  recoveryMs: 200,
  cancelAfterMs: 120,
  allowedInAir: true,
  lockMs: 150,
  onActive(ctx) {
    const reach = 130 * ctx.rangeScale
    hitbox(ctx, { kind: 'rect', x: -14, y: -34 - reach, w: 28, h: reach }, 100, { damage: 26, knockback: { x: 40, y: -420 }, hitStopMs: 70, tags: ['heavy'] })
    const feet = ctx.player.position()
    streak(ctx, feet.x, feet.y - 34, feet.x + 3, feet.y - 34 - reach, 180)
    streak(ctx, feet.x - 3, feet.y - 40, feet.x, feet.y - 34 - reach, 140)
    burst(ctx, feet.x, feet.y - 34 - reach, 'hit')
  },
}

// The starting weapon in both slots. No card upgrades it, so it has no tier 2.
export const staffMoveset: WeaponMoveset = {
  id: 'staff',
  moves: (slot) => (slot === 'light' ? LIGHT : HEAVY),
  airHeavy: () => METEOR,
  dashLight: () => LUNGE,
  dashHeavy: () => COMET,
  upLight: () => SKYWARD,
  upHeavy: () => ROD,
}
