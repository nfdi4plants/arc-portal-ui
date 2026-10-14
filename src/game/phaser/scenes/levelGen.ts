import type { Theme } from '../../contracts/art'
import { TILE } from '../../contracts/constants'
import { createRng, type Rng } from '../../contracts/rng'
import type { Segment } from '../../contracts/run'

// Pure level layout for one stretch. Units are world units, y grows downwards and the start
// ground surface is y = 0.

export type ChunkKind = 'flat' | 'stepUp' | 'stepDown' | 'gap' | 'platforms' | 'pit'

// Solid ground from `top` down to the layout's groundBottom.
export interface Ground {
  x: number
  w: number
  top: number
}

// A one-way platform, 8 units thick.
export interface Ledge {
  x: number
  w: number
  top: number
}

// A move the player has to make to get on. `rise` is positive when the landing is higher.
export interface Jump {
  x: number
  width: number
  rise: number
}

export interface Chunk {
  kind: ChunkKind
  x: number
  w: number
  mobs: number
}

export interface StretchLayout {
  theme: Theme
  width: number
  // Highest ground or platform surface, for the camera bounds.
  top: number
  groundBottom: number
  // Feet below this line fell into a pit.
  pitY: number
  // Merged: neighbouring ground at the same height is one entry, so one static body.
  grounds: Ground[]
  platforms: Ledge[]
  chunks: Chunk[]
  jumps: Jump[]
  // One per annotation of the segment, in annotation order. Feet position.
  spawns: { x: number; y: number }[]
  start: { x: number; y: number }
  door: { x: number; y: number; w: number; h: number }
}

export const MAX_GAP_TILES = 3
export const MAX_STEP_TILES = 2
export const MIN_CHUNKS = 2
const MAX_LEVEL = 4
const PLATFORM_RISE_TILES = 3
const START_TILES = 8
const END_TILES = 10

const KINDS: readonly ChunkKind[] = ['flat', 'flat', 'stepUp', 'stepDown', 'gap', 'gap', 'platforms', 'pit']

export function generateStretch(segment: Segment, seed: string): StretchLayout {
  const rng = createRng(`${seed}/${segment.processKey}/${segment.index}`)
  const T = TILE

  // Group the mobs into encounter chunks of one or two.
  const groups: number[] = []
  for (let left = segment.annotations.length; left > 0; ) {
    const n = Math.min(left, rng.int(1, 2))
    groups.push(n)
    left -= n
  }
  while (groups.length < MIN_CHUNKS) groups.push(0)

  const grounds: Ground[] = []
  const platforms: Ledge[] = []
  const chunks: Chunk[] = []
  const jumps: Jump[] = []
  const spawns: { x: number; y: number }[] = []
  let x = 0
  let level = 0

  const surface = () => -level * T
  const ground = (tiles: number) => {
    const run = { x, w: tiles * T, top: surface() }
    grounds.push(run)
    x += run.w
    return run
  }
  const spread = (count: number, from: number, to: number, y: number) => {
    for (let i = 0; i < count; i++) spawns.push({ x: Math.round(from + ((to - from) * (i + 1)) / (count + 1)), y })
  }
  const onRun = (count: number, run: Ground) => spread(count, run.x + T, run.x + run.w - T, run.top)

  ground(START_TILES)

  for (const mobs of groups) {
    const kind = pickKind(rng, level)
    const from = x
    switch (kind) {
      case 'flat': {
        onRun(mobs, ground(rng.int(10, 14)))
        break
      }
      case 'stepUp':
      case 'stepDown': {
        ground(rng.int(4, 6))
        const room = kind === 'stepUp' ? MAX_LEVEL - level : level
        const d = Math.min(room, rng.int(1, MAX_STEP_TILES))
        level += kind === 'stepUp' ? d : -d
        jumps.push({ x, width: 0, rise: kind === 'stepUp' ? d * T : -d * T })
        onRun(mobs, ground(rng.int(6, 9)))
        break
      }
      case 'gap': {
        ground(rng.int(4, 5))
        const gap = rng.int(2, MAX_GAP_TILES) * T
        jumps.push({ x, width: gap, rise: 0 })
        x += gap
        onRun(mobs, ground(rng.int(6, 9)))
        break
      }
      case 'platforms': {
        const count = rng.int(1, 2)
        const w = rng.int(3, 4) * T
        // The ground reaches past the last platform, so no platform hangs over the next chunk.
        const run = ground(Math.max(rng.int(12, 16), 5 + count * (w / T + 2)))
        const top = run.top - PLATFORM_RISE_TILES * T
        for (let i = 0; i < count; i++) {
          const px = run.x + 3 * T + i * (w + 2 * T)
          platforms.push({ x: px, w, top })
          jumps.push({ x: px, width: 0, rise: PLATFORM_RISE_TILES * T })
        }
        // The first mob waits on the first platform, the second on the ground.
        if (mobs > 0) spread(1, platforms[platforms.length - count].x, platforms[platforms.length - count].x + w, top)
        if (mobs > 1) spread(mobs - 1, run.x + run.w / 2, run.x + run.w - T, run.top)
        break
      }
      case 'pit': {
        ground(rng.int(4, 5))
        const side = rng.int(2, 3) * T
        const stone = rng.int(2, 3) * T
        const top = surface() - T
        platforms.push({ x: x + side, w: stone, top })
        jumps.push({ x, width: side, rise: T })
        jumps.push({ x: x + side + stone, width: side, rise: -T })
        x += 2 * side + stone
        onRun(mobs, ground(rng.int(6, 8)))
        break
      }
    }
    chunks.push({ kind, x: from, w: x - from, mobs })
  }

  const end = ground(END_TILES)
  const door = { x: end.x + end.w - 4 * T, y: end.top - 3 * T, w: 2 * T, h: 3 * T }
  const merged = mergeGrounds(grounds)
  let top = 0
  for (const g of merged) top = Math.min(top, g.top)
  for (const p of platforms) top = Math.min(top, p.top)

  return {
    theme: segment.datasetKind,
    width: x,
    top,
    groundBottom: 5 * T,
    pitY: 5 * T,
    grounds: merged,
    platforms,
    chunks,
    jumps,
    spawns,
    start: { x: 2 * T, y: 0 },
    door,
  }
}

function pickKind(rng: Rng, level: number): ChunkKind {
  const allowed = KINDS.filter((kind) => (kind === 'stepUp' ? level < MAX_LEVEL : kind === 'stepDown' ? level > 0 : true))
  return rng.pick(allowed)
}

function mergeGrounds(grounds: Ground[]): Ground[] {
  const merged: Ground[] = []
  for (const g of grounds) {
    const last = merged[merged.length - 1]
    if (last && last.top === g.top && last.x + last.w === g.x) last.w += g.w
    else merged.push({ ...g })
  }
  return merged
}
