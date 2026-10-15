import type { BossAttackKind } from '../../contracts/content'
import { clamp, FEET_MARGIN, platformUnder } from './zones'
import type { ArenaPlatform } from './zones'

// How a boss gets at a player who stays up on the platforms. Plain data, nothing here imports Phaser.
//
// A platform is a dodge, not a hiding place. The floor attacks miss a player up there, and for the
// first CAMP_MS the boss fights as always. After that the boss picks the attacks that reach the
// platforms (CAMP_WEIGHT), plays their platform variants and stops picking its floor-only ones.
// Its minions hop up after the player, slower than the player moves.

// Time on the platforms before the boss starts to go for them.
export const CAMP_MS = 2000
// Each ms on the floor takes this many ms off the time up there, so a short drop does not reset it.
const FLOOR_DECAY = 2

export interface PerchWatch {
  // The platform the player last stood on, kept while the player jumps, or null after landing on
  // the floor.
  ledge: ArenaPlatform | null
  // Time spent up there, see CAMP_MS.
  campMs: number
}

export function createPerchWatch(): PerchWatch {
  return { ledge: null, campMs: 0 }
}

// Once per step with the player's feet. The ledge only changes on a landing, so a jump on a
// platform still counts as time up there.
export function watchPerch(
  watch: PerchWatch,
  platforms: readonly ArenaPlatform[],
  x: number,
  feetY: number,
  grounded: boolean,
  dtMs: number,
): void {
  if (grounded) watch.ledge = platformUnder(platforms, x, feetY, FEET_MARGIN)
  if (watch.ledge) watch.campMs += dtMs
  else watch.campMs = Math.max(0, watch.campMs - dtMs * FLOOR_DECAY)
}

export function isCamping(watch: PerchWatch): boolean {
  return watch.ledge !== null && watch.campMs >= CAMP_MS
}

// How likely each kind is picked while the player camps. The kinds made for the platforms (the leap
// or root arm, the platform rain, the high or aimed beam) weigh most. Sweep and charge rise to
// platform height then, the pillars under a platform burst through it and the minions hop up, so
// they reach too. The shockwave and the flood stay on the floor, which is the dodge, so the boss
// does not pick them at all while the player camps.
export const CAMP_WEIGHT: Record<BossAttackKind, number> = {
  slam: 3,
  rain: 3,
  beam: 3,
  pillars: 2,
  projectileFan: 2,
  sweep: 1,
  charge: 1,
  summon: 1,
  shockwave: 0,
}

export function campWeight(attack: { kind: BossAttackKind }): number {
  return CAMP_WEIGHT[attack.kind]
}

// Boss minions. They walk at ADD_SPEED, a quarter of the player's run, and get onto a platform with
// a crouch and a hop from just beside it. A minion up on a platform the player has left walks to
// the edge and drops down.
export const ADD_SPEED = 54
// The crouch before a hop shows that the minion is about to jump.
export const ADD_CROUCH_MS = 380
export const ADD_HOP_MS = 560
// How high a hop rises over the higher of its two ends.
const HOP_PEAK = 22
// A minion hops from this far beside the platform and lands this far in from its edge.
const HOP_FROM = 30
const HOP_INTO = 12
// A drop steps this far off the edge.
const DROP_OUT = 14

export interface AddMotion {
  x: number
  // Height of the feet above the floor.
  lift: number
  // What the minion stands on, null for the floor. During a hop it is the surface it left.
  ledge: ArenaPlatform | null
  // -1 while walking, otherwise the time since the hop began (the crouch comes first).
  hopMs: number
  fromX: number
  toX: number
  fromLift: number
  toLift: number
  // Where the hop lands, null for the floor.
  landing: ArenaPlatform | null
}

export function createAddMotion(x: number): AddMotion {
  return { x, lift: 0, ledge: null, hopMs: -1, fromX: x, toX: x, fromLift: 0, toLift: 0, landing: null }
}

// True while the minion crouches before a hop, for the squash of its sprite.
export function addCrouching(m: AddMotion): boolean {
  return m.hopMs >= 0 && m.hopMs < ADD_CROUCH_MS
}

function startHop(m: AddMotion, toX: number, landing: ArenaPlatform | null, floorY: number, crouch: boolean): void {
  m.hopMs = crouch ? 0 : ADD_CROUCH_MS
  m.fromX = m.x
  m.toX = toX
  m.fromLift = m.lift
  m.toLift = landing ? floorY - landing.top : 0
  m.landing = landing
}

// Walks `m` toward x at `speed` units per second.
function walk(m: AddMotion, x: number, speed: number, dtMs: number): void {
  const dx = x - m.x
  const step = speed * (dtMs / 1000)
  m.x = Math.abs(dx) <= step ? x : m.x + Math.sign(dx) * step
}

// One step of a minion chasing the player. `target` is the platform the player stands on (the
// PerchWatch ledge) or null for the floor. dtMs is already scaled by any slow.
export function stepAdd(
  m: AddMotion,
  playerX: number,
  target: ArenaPlatform | null,
  arena: { left: number; right: number; floorY: number },
  margin: number,
  dtMs: number,
): void {
  if (m.hopMs >= 0) {
    m.hopMs += dtMs
    if (m.hopMs < ADD_CROUCH_MS) return
    const u = Math.min(1, (m.hopMs - ADD_CROUCH_MS) / ADD_HOP_MS)
    const peak = Math.max(m.fromLift, m.toLift) + HOP_PEAK
    // A parabola through both ends that tops out at `peak`.
    const top = peak - (m.fromLift + m.toLift) / 2
    m.x = m.fromX + (m.toX - m.fromX) * u
    m.lift = m.fromLift + (m.toLift - m.fromLift) * u + 4 * u * (1 - u) * top
    if (u >= 1) {
      m.lift = m.toLift
      m.ledge = m.landing
      m.hopMs = -1
    }
    return
  }
  const left = arena.left + margin
  const right = arena.right - margin
  if (m.ledge === target) {
    // Same surface: walk at the player, and on a platform stay on it.
    walk(m, m.ledge ? clamp(playerX, m.ledge.x + 4, m.ledge.x + m.ledge.w - 4) : playerX, ADD_SPEED, dtMs)
  } else if (m.ledge) {
    // The player left this platform: walk off the edge on the player's side and drop.
    const p = m.ledge
    const edge = playerX < p.x + p.w / 2 ? p.x : p.x + p.w
    walk(m, edge, ADD_SPEED, dtMs)
    if (m.x === edge) startHop(m, clamp(edge + Math.sign(edge - (p.x + p.w / 2)) * DROP_OUT, left, right), null, arena.floorY, false)
  } else if (target) {
    // Up to the player's platform, from the side the minion is on.
    const fromLeft = m.x < target.x + target.w / 2
    const takeoff = clamp(fromLeft ? target.x - HOP_FROM : target.x + target.w + HOP_FROM, left, right)
    walk(m, takeoff, ADD_SPEED, dtMs)
    if (m.x === takeoff) startHop(m, fromLeft ? target.x + HOP_INTO : target.x + target.w - HOP_INTO, target, arena.floorY, true)
  }
  m.x = clamp(m.x, left, right)
}
