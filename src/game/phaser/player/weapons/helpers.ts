import type { Combatant } from '../../../contracts/combat'

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
