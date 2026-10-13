import { TILE } from '../../contracts/constants'

// Ledge rules for ground walkers. The Phaser side asks the static body tree whether the probe box
// touches ground, these helpers decide where to look and what to do about the answer.

export interface Box {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

// How far past the body's front edge the probe looks.
export const LEDGE_LOOKAHEAD = 10
// A drop shallower than this is a step, not a ledge.
export const LEDGE_DEPTH = 16
// Feet this close vertically count as standing on the same platform level.
export const SAME_LEVEL = TILE * 0.75

// A thin box just ahead of the front foot, reaching from the feet down to LEDGE_DEPTH. It writes
// into `out` so the per-step check does not allocate.
export function groundProbe(
  out: Box,
  centerX: number,
  feetY: number,
  dir: 1 | -1,
  halfWidth: number,
  lookAhead = LEDGE_LOOKAHEAD,
  depth = LEDGE_DEPTH,
): Box {
  const x = centerX + dir * (halfWidth + lookAhead)
  out.minX = x - 1
  out.maxX = x + 1
  out.minY = feetY - 2
  out.maxY = feetY + depth
  return out
}

export function sameLevel(feetY: number, targetFeetY: number): boolean {
  return Math.abs(feetY - targetFeetY) <= SAME_LEVEL
}

// Walkers turn at ledges. The exception is a chaser whose target stands at its own level, since
// the gap between them is then the way to the target. Crawlers never leave their platform.
export function turnsAtLedge(chasing: boolean, targetSameLevel: boolean, neverFalls: boolean): boolean {
  if (neverFalls) return true
  return !(chasing && targetSameLevel)
}

// A static body is a one-way platform when only its top side collides.
export function isOneWay(checkCollision: { up: boolean; down: boolean }): boolean {
  return checkCollision.down === false && checkCollision.up !== false
}
