import type { Combatant, HitShape } from '../../../contracts/combat'

// Pure helpers of the loadout. Nothing here imports Phaser, so they run in jsdom tests.

export interface Point {
  x: number
  y: number
}

export interface Snapshot {
  x: number
  y: number
  hp: number
}

export interface RingBuffer {
  push(x: number, y: number, hp: number): void
  // The oldest stored snapshot, or null when empty. The object is reused by the next call.
  oldest(): Readonly<Snapshot> | null
  size(): number
  clear(): void
}

// A fixed-size history. Once full, each push overwrites the oldest entry. Storage is allocated
// once, so recording a snapshot never allocates.
export function createRingBuffer(capacity: number): RingBuffer {
  const xs = new Float64Array(capacity)
  const ys = new Float64Array(capacity)
  const hps = new Float64Array(capacity)
  const out: Snapshot = { x: 0, y: 0, hp: 0 }
  let next = 0
  let count = 0

  return {
    push(x, y, hp) {
      xs[next] = x
      ys[next] = y
      hps[next] = hp
      next = (next + 1) % capacity
      if (count < capacity) count++
    },
    oldest() {
      if (count === 0) return null
      const index = (next - count + capacity) % capacity
      out.x = xs[index]
      out.y = ys[index]
      out.hp = hps[index]
      return out
    },
    size: () => count,
    clear() {
      next = 0
      count = 0
    },
  }
}

// The closest item to `from` within `maxDistance` that `accept` allows. The first one wins a tie.
export function nearest<T extends { position(): Point }>(
  from: Point,
  items: readonly T[],
  maxDistance: number,
  accept?: (item: T) => boolean,
): T | null {
  const limit = maxDistance * maxDistance
  let best: T | null = null
  let bestSq = Infinity
  for (const item of items) {
    if (accept && !accept(item)) continue
    const p = item.position()
    const dx = p.x - from.x
    const dy = p.y - from.y
    const sq = dx * dx + dy * dy
    if (sq > limit || sq >= bestSq) continue
    best = item
    bestSq = sq
  }
  return best
}

type Living = { position(): Point; isDead(): boolean }

// The middle of a combatant's hurtbox, where shots aim.
export function centerOf(combatant: { hurtbox(): { x: number; y: number; width: number; height: number } }): Point {
  const box = combatant.hurtbox()
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

// The nearest living enemy other than `source` that carries a tag, for the Ontology chain.
export function pickChainTarget<T extends Living>(
  source: T,
  enemies: readonly T[],
  tagged: { has(item: T): boolean },
  maxDistance: number,
): T | null {
  return nearest(source.position(), enemies, maxDistance, (enemy) => enemy !== source && !enemy.isDead() && tagged.has(enemy))
}

// The nearest living enemy within range.
export function nearestLiving<T extends Living>(from: Point, enemies: readonly T[], maxDistance: number): T | null {
  return nearest(from, enemies, maxDistance, (enemy) => !enemy.isDead())
}

// True when `point` lies in the cone that opens from `origin` towards `facing`: no further than
// `range` and no more than `halfAngle` radians off the facing line. `slack` widens the cone on
// every side, so a body whose middle sits just outside but overlaps the edge still counts.
export function inCone(origin: Point, facing: 1 | -1, point: Point, range: number, halfAngle: number, slack = 0): boolean {
  const ahead = (point.x - origin.x) * facing
  const side = Math.abs(point.y - origin.y)
  if (ahead < -slack || Math.hypot(ahead, side) - slack > range) return false
  return side <= Math.max(0, ahead) * Math.tan(halfAngle) + slack
}

// The nearest living enemy ahead of `from` within range, or null. `behind` lets an enemy that
// overlaps the mage count as ahead.
export function nearestAhead<T extends Living>(from: Point, facing: 1 | -1, enemies: readonly T[], maxDistance: number, behind = 12): T | null {
  return nearest(from, enemies, maxDistance, (enemy) => !enemy.isDead() && (enemy.position().x - from.x) * facing >= -behind)
}

export interface Mark<T> {
  // Marks a target for `ms`. A new mark replaces the old one.
  set(target: T, ms: number): void
  tick(dtMs: number): void
  clear(): void
  // The marked target, or null once the mark ran out.
  target(): T | null
  // The extra damage a hit of `damage` on `target` deals: `share` of it on the marked target, else 0.
  bonus(target: T, damage: number): number
}

// One mark at a time, for Citation Needed.
export function createMark<T>(share: number): Mark<T> {
  let marked: T | null = null
  let leftMs = 0
  return {
    set(target, ms) {
      marked = target
      leftMs = ms
    },
    tick(dtMs) {
      if (leftMs <= 0) return
      leftMs = Math.max(0, leftMs - dtMs)
      if (leftMs <= 0) marked = null
    },
    clear() {
      marked = null
      leftMs = 0
    },
    target: () => marked,
    bonus: (target, damage) => (marked !== null && target === marked ? damage * share : 0),
  }
}

// A velocity of length `speed` from `from` towards `to`, turned by `spread` radians. Aiming at
// the origin point itself falls back to the facing direction.
export function aimedVelocity(from: Point, to: Point, speed: number, fallbackDir: 1 | -1, spread = 0): Point {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const angle = dx * dx + dy * dy < 1 ? (fallbackDir === 1 ? 0 : Math.PI) : Math.atan2(dy, dx)
  return { x: Math.cos(angle + spread) * speed, y: Math.sin(angle + spread) * speed }
}

export interface DamageState {
  // Stat multiplier times any passive bonus such as the F letter.
  multiplier: number
  critChance: number
  critMultiplier: number
}

export const FAIR_DAMAGE_BONUS = 1.2

export function damageMultiplier(damageStat: number, fairF: boolean): number {
  return damageStat * (fairF ? FAIR_DAMAGE_BONUS : 1)
}

// `roll` is a draw in [0, 1). Below the crit chance the hit crits.
export function rollHit(base: number, state: DamageState, roll: number): { damage: number; crit: boolean } {
  const crit = roll < state.critChance
  return { damage: base * state.multiplier * (crit ? state.critMultiplier : 1), crit }
}

// Attacks owned by `owner` use the build's multiplier and crit. Everything else, including
// hits the loadout spawns with a final damage, passes through unchanged. The state object is
// read on every call, so the loadout updates it in place.
export function createDamageModifier(
  owner: Combatant,
  state: DamageState,
  roll: () => number,
): (attacker: Combatant, base: number) => { damage: number; crit: boolean } {
  return (attacker, base) => (attacker === owner ? rollHit(base, state, roll()) : { damage: base, crit: false })
}

// Up attacks without moves of their own turn their hitboxes to point overhead. The box starts a
// little below the top of the head, so a mob standing on the mage is still hit.
const OVERHEAD_BASE_Y = -30
// A thin forward box (the whip lash) would make a thread above the head that is hard to land.
const OVERHEAD_MIN_WIDTH = 20
const UPWARD_MIN_LIFT = 160
const UPWARD_FORWARD_SHARE = 0.25

// Maps a shape authored for a forward attack (relative to the feet, facing right) to one centred
// over the mage. A rect swaps width and height, so the reach goes up. A circle moves its forward
// offset upwards.
export function overheadShape(shape: HitShape): HitShape {
  if (shape.kind === 'circle') {
    return { kind: 'circle', x: 0, y: Math.min(shape.y, OVERHEAD_BASE_Y) - Math.abs(shape.x), r: shape.r }
  }
  const width = Math.max(OVERHEAD_MIN_WIDTH, shape.h)
  return { kind: 'rect', x: -width / 2, y: OVERHEAD_BASE_Y - shape.w, w: width, h: shape.w + Math.max(0, shape.x) }
}

// Knockback for an overhead hit: mostly up, with a small part of the forward push left.
export function upwardKnockback(knockback: Point): Point {
  if (knockback.x === 0 && knockback.y === 0) return knockback
  const lift = Math.max(UPWARD_MIN_LIFT, Math.abs(knockback.y), Math.abs(knockback.x) * 0.9)
  return { x: knockback.x * UPWARD_FORWARD_SHARE, y: -lift }
}

// Every hitbox of a player move grows by this much on each side, so a swing that visibly grazes an
// enemy hits it.
export const MELEE_MARGIN = 4
// Half the mage's hurtbox width. A rect reaches over the mage's own body at least, so an enemy
// pressed against or inside the mage is hit by a forward swing too.
export const MELEE_BODY_HALF_WIDTH = 9

// The shape a player move's hitbox really gets, relative to the feet and facing right.
export function forgivingShape(shape: HitShape): HitShape {
  if (shape.kind === 'circle') return { kind: 'circle', x: shape.x, y: shape.y, r: shape.r + MELEE_MARGIN }
  const left = Math.min(shape.x, -MELEE_BODY_HALF_WIDTH) - MELEE_MARGIN
  const right = Math.max(shape.x + shape.w, MELEE_BODY_HALF_WIDTH) + MELEE_MARGIN
  return { kind: 'rect', x: left, y: shape.y - MELEE_MARGIN, w: right - left, h: shape.h + 2 * MELEE_MARGIN }
}
