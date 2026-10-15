import type { Annotation } from '../../../arc/provenance/types'
import type { HitShape } from '../../contracts/combat'
import { PLAYER_HEIGHT, TILE } from '../../contracts/constants'
import type { Rng } from '../../contracts/rng'
import { JUMP_VELOCITY, MOTOR } from '../../model/input/motor'

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

// The parts of [from, to] that no safe spot covers, with every spot widened by `margin` on both
// sides. `safe` is sorted and does not overlap.
export function openIntervals(from: number, to: number, safe: readonly Interval[], margin = 0): Interval[] {
  const open: Interval[] = []
  let cursor = from
  for (const spot of safe) {
    const spotFrom = spot.from - margin
    const spotTo = spot.to + margin
    if (spotTo <= cursor) continue
    if (spotFrom >= to) break
    if (spotFrom > cursor) open.push({ from: cursor, to: spotFrom })
    cursor = Math.max(cursor, spotTo)
  }
  if (cursor < to) open.push({ from: cursor, to })
  return open
}

export function insideAny(x: number, spots: readonly Interval[], margin: number): boolean {
  for (const spot of spots) if (x >= spot.from - margin && x <= spot.to + margin) return true
  return false
}

// A one-way platform of a boss arena. top is the walkable surface, a world y.
export interface ArenaPlatform {
  x: number
  w: number
  top: number
}

// The platforms float this high over the floor: a plain jump (JUMP_APEX, 84) clears them with room
// to spare, and the player (PLAYER_HEIGHT plus the 8 units of the platform) still fits below.
export const PLATFORM_LIFT = 60
export const PLATFORM_THICKNESS = 8
export const PLATFORM_WIDTH = 3 * TILE
// About one platform per this much floor, with this much bare floor along each wall.
const PLATFORM_PITCH = 9 * TILE
const PLATFORM_MARGIN = 2 * TILE

// Spreads the platforms evenly over the arena, snapped to the tile grid, at least two of them. Floor
// attacks spare them and platform attacks hit them, so each fight sends the player up and down.
export function arenaPlatforms(left: number, right: number, floorY: number): ArenaPlatform[] {
  const span = right - left - 2 * PLATFORM_MARGIN
  const count = Math.max(2, Math.round(span / PLATFORM_PITCH))
  const step = span / count
  const platforms: ArenaPlatform[] = []
  for (let i = 0; i < count; i++) {
    const centre = left + PLATFORM_MARGIN + step * (i + 0.5)
    const x = left + Math.round((centre - PLATFORM_WIDTH / 2 - left) / TILE) * TILE
    platforms.push({ x, w: PLATFORM_WIDTH, top: floorY - PLATFORM_LIFT })
  }
  return platforms
}

// Half the width of the mage's hurtbox (PLAYER_HURTBOX in player/Player.ts). A mage whose middle
// is this far past the end of a platform still stands on it.
export const FEET_MARGIN = 9

// The platform a body with its feet at (x, feetY) stands on, or null on the floor or in the air.
// `margin` is half the width of the body's feet.
export function platformUnder(platforms: readonly ArenaPlatform[], x: number, feetY: number, margin = 0): ArenaPlatform | null {
  for (const p of platforms) if (x >= p.x - margin && x <= p.x + p.w + margin && Math.abs(feetY - p.top) <= 2) return p
  return null
}

// The centre x of the free floor nearest to x that fits an object `width` wide, so a door does not
// stand under a platform. Falls back to x when no gap is wide enough.
export function freeFloorX(arena: { left: number; right: number; platforms: readonly ArenaPlatform[] }, x: number, width: number): number {
  let best = x
  let bestDistance = Infinity
  let from = arena.left
  for (let i = 0; i <= arena.platforms.length; i++) {
    const p = arena.platforms[i]
    const to = p ? p.x : arena.right
    if (to - from >= width + 8) {
      const centre = clamp(x, from + width / 2 + 4, to - width / 2 - 4)
      const distance = Math.abs(centre - x)
      if (distance < bestDistance) {
        best = centre
        bestDistance = distance
      }
    }
    if (p) from = Math.max(from, p.x + p.w)
  }
  return best
}

// Where a player standing on a platform has the middle of the body.
export function platformBodyY(platform: ArenaPlatform): number {
  return platform.top - PLAYER_HEIGHT / 2
}

// Time for a drop starting at speed v0 (down) under gravity g to fall `distance`.
export function fallMs(distance: number, v0: number, gravity: number): number {
  if (distance <= 0) return 0
  return ((Math.sqrt(v0 * v0 + 2 * gravity * distance) - v0) / gravity) * 1000
}

// How far the player's body can be from a weak point and still count as hitting it.
export const WEAK_REACH = 64
export const WEAK_MARGIN_Y = 16

export const JUMP_APEX = JUMP_VELOCITY ** 2 / (2 * MOTOR.gravity)

// The highest a weak point of this size can sit above the floor and still match a hit from a
// player at the top of a jump.
export function highestWeakPoint(size: number): number {
  return JUMP_APEX + size / 2 + WEAK_MARGIN_Y
}

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
