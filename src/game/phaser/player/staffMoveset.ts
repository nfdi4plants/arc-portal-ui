import type { HitShape } from '../../contracts/combat'
import type { AttackContext, AttackMove, WeaponMoveset } from '../../contracts/player'

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

// The starting weapon in both slots. Tier 2 uses the same moves.
export const staffMoveset: WeaponMoveset = {
  id: 'staff',
  moves: (slot) => (slot === 'light' ? LIGHT : HEAVY),
}
