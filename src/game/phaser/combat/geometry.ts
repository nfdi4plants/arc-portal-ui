import type { HitShape } from '../../contracts/combat'

// Plain-data geometry for the combat world. Nothing here imports Phaser, so it runs in jsdom tests.

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface Point {
  x: number
  y: number
}

export type Facing = 1 | -1

// Turns a shape given relative to its owner into a world-space shape. A left-facing owner mirrors
// the x offsets: a rect keeps its far edge, so its left edge moves to -x - w, and a circle's
// centre moves to -x.
export function resolveShape(shape: HitShape, origin: Point, facing: Facing): HitShape {
  if (shape.kind === 'circle') {
    const x = facing === 1 ? shape.x : -shape.x
    return { kind: 'circle', x: origin.x + x, y: origin.y + shape.y, r: shape.r }
  }
  const x = facing === 1 ? shape.x : -shape.x - shape.w
  return { kind: 'rect', x: origin.x + x, y: origin.y + shape.y, w: shape.w, h: shape.h }
}

export function boundsOf(shape: HitShape): Rect {
  if (shape.kind === 'circle') return { x: shape.x - shape.r, y: shape.y - shape.r, w: shape.r * 2, h: shape.r * 2 }
  return { x: shape.x, y: shape.y, w: shape.w, h: shape.h }
}

// Shapes that only touch along an edge (or at a tangent point) do not overlap. A mob standing on
// the ground or next to a wall must not be hit by a box that merely rests against it.
export function overlaps(shape: HitShape, rect: Rect): boolean {
  if (shape.kind === 'rect') {
    return shape.x < rect.x + rect.w && shape.x + shape.w > rect.x && shape.y < rect.y + rect.h && shape.y + shape.h > rect.y
  }
  const nearestX = Math.min(Math.max(shape.x, rect.x), rect.x + rect.w)
  const nearestY = Math.min(Math.max(shape.y, rect.y), rect.y + rect.h)
  const dx = shape.x - nearestX
  const dy = shape.y - nearestY
  return dx * dx + dy * dy < shape.r * shape.r
}

// Centre of the area both boxes cover, used as the spot for hit effects. Circles use their bounding
// box, which is close enough for feedback.
export function hitPoint(shape: HitShape, rect: Rect): Point {
  const box = boundsOf(shape)
  const left = Math.max(box.x, rect.x)
  const right = Math.min(box.x + box.w, rect.x + rect.w)
  const top = Math.max(box.y, rect.y)
  const bottom = Math.min(box.y + box.h, rect.y + rect.h)
  return { x: (left + right) / 2, y: (top + bottom) / 2 }
}

// Knockback is authored for a right-facing attacker.
export function mirrorKnockback(knockback: Point, facing: Facing): Point {
  return { x: knockback.x * facing, y: knockback.y }
}

// Projectiles face where they fly. A projectile with no horizontal speed keeps the given facing.
export function facingOfVelocity(vx: number, fallback: Facing): Facing {
  if (vx > 0) return 1
  if (vx < 0) return -1
  return fallback
}
