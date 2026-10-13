import type { Annotation } from '../../../arc/provenance/types'
import type { HitShape } from '../../contracts/combat'
import type { Rng } from '../../contracts/rng'

// Plain-data helpers for boss attacks. Nothing here imports Phaser.

export interface Interval {
  from: number
  to: number
}

export interface Point {
  x: number
  y: number
}

export type Facing = 1 | -1

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

// The combat world wants shapes relative to the owner and mirrored for a left-facing owner, while
// the attacks think in world space. This is the inverse of the world's resolveShape.
export function toOwnerShape(shape: HitShape, origin: Point, facing: Facing): HitShape {
  if (shape.kind === 'circle') {
    const x = shape.x - origin.x
    return { kind: 'circle', x: facing === 1 ? x : -x, y: shape.y - origin.y, r: shape.r }
  }
  const x = shape.x - origin.x
  return { kind: 'rect', x: facing === 1 ? x : -x - shape.w, y: shape.y - origin.y, w: shape.w, h: shape.h }
}

// Knockback is authored for a right-facing owner and mirrored by the combat world. This gives the
// vector that pushes the target toward worldDir (1 right, -1 left) whatever the owner faces.
export function knockback(worldDir: number, facing: Facing, speed: number, up: number): Point {
  return { x: worldDir * facing * speed, y: -up }
}

// Time until a shot flying with (vx, vy) from `from` leaves the arena through a wall, the floor or
// the ceiling, capped at maxMs. Shots that end there do not fly on under the floor.
export function flightMs(
  arena: { left: number; right: number; floorY: number },
  ceilingY: number,
  from: Point,
  vx: number,
  vy: number,
  maxMs: number,
): number {
  let seconds = maxMs / 1000
  if (vx > 0) seconds = Math.min(seconds, (arena.right - from.x) / vx)
  else if (vx < 0) seconds = Math.min(seconds, (arena.left - from.x) / vx)
  if (vy > 0) seconds = Math.min(seconds, (arena.floorY - from.y) / vy)
  else if (vy < 0) seconds = Math.min(seconds, (ceilingY - from.y) / vy)
  return Math.max(50, seconds * 1000)
}

// Spreads `count` safe spots over [left, right], one per equal slot at a random position inside it,
// so they never overlap and always sit apart from each other.
export function safeIntervals(rng: Rng, left: number, right: number, count: number, width: number): Interval[] {
  const spots: Interval[] = []
  if (count <= 0) return spots
  const slot = (right - left) / count
  const margin = Math.min(12, Math.max(0, (slot - width) / 2))
  for (let i = 0; i < count; i++) {
    const span = Math.max(0, slot - width - 2 * margin)
    const from = left + slot * i + margin + rng.next() * span
    spots.push({ from, to: from + Math.min(width, slot) })
  }
  return spots
}

// The parts of [from, to] that no safe spot covers. `safe` is sorted and does not overlap.
export function openIntervals(from: number, to: number, safe: readonly Interval[]): Interval[] {
  const open: Interval[] = []
  let cursor = from
  for (const spot of safe) {
    if (spot.to <= cursor) continue
    if (spot.from >= to) break
    if (spot.from > cursor) open.push({ from: cursor, to: spot.from })
    cursor = Math.max(cursor, spot.to)
  }
  if (cursor < to) open.push({ from: cursor, to })
  return open
}

export function insideAny(x: number, spots: readonly Interval[], margin: number): boolean {
  for (const spot of spots) if (x >= spot.from - margin && x <= spot.to + margin) return true
  return false
}

// How far the player's body can be from a weak point and still count as hitting it.
export const WEAK_REACH = 64
export const WEAK_MARGIN_Y = 16

// A weak point takes the double damage when the hitter stands within melee reach of the boss, at the
// height of the glowing spot. A rear spot only counts from behind the boss. The combat world does not
// report where a hit landed, so the attacker's body stands in for the hit position.
export function hitsWeakPoint(
  spot: Point & { size: number; rear: boolean },
  attacker: Point,
  bossX: number,
  bossHalfWidth: number,
  facing: Facing,
): boolean {
  if (Math.abs(attacker.y - spot.y) > spot.size / 2 + WEAK_MARGIN_Y) return false
  if (Math.abs(attacker.x - bossX) > bossHalfWidth + WEAK_REACH) return false
  return !spot.rear || (attacker.x - bossX) * facing < 0
}

const MAX_TELL_LENGTH = 36

// "name = value unit", dropping the parts an annotation does not have.
export function formatTell({ name, value, unit }: Annotation): string {
  if (!value) return name
  const shown = value.length > MAX_TELL_LENGTH ? `${value.slice(0, MAX_TELL_LENGTH - 1)}…` : value
  return unit ? `${name} = ${shown} ${unit}` : `${name} = ${shown}`
}
