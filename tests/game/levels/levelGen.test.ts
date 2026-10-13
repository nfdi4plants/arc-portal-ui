import { describe, expect, it } from 'vitest'
import type { Annotation } from '../../../src/arc/provenance/types'
import { TILE } from '../../../src/game/contracts/constants'
import type { Segment } from '../../../src/game/contracts/run'
import { JUMP_VELOCITY, MOTOR } from '../../../src/game/model/input/motor'
import { generateStretch, MAX_GAP_TILES, MAX_STEP_TILES, MIN_CHUNKS } from '../../../src/game/phaser/scenes/levelGen'
import type { StretchLayout } from '../../../src/game/phaser/scenes/levelGen'

function segmentWith(mobs: number, index = 0): Segment {
  const annotations: Annotation[] = Array.from({ length: mobs }, (_, i) => ({
    name: `parameter ${i}`,
    value: String(i),
    unit: null,
    accession: null,
    category: 'parameter',
  }))
  return {
    index,
    fromNodeId: 'a',
    toNodeId: 'b',
    processKey: 'assays/RNASeq::illumina',
    processName: 'illumina',
    datasetId: 'assays/RNASeq',
    datasetKind: 'assay',
    annotations,
    quality: Math.min(1, mobs / 8),
    telegraphMs: 80,
  }
}

const seeds = Array.from({ length: 40 }, (_, i) => `seed-${i}`)

// Base kit only: one jump at run speed, no double jump.
const maxRise = JUMP_VELOCITY ** 2 / (2 * MOTOR.gravity)
function reachAt(rise: number): number {
  const v = JUMP_VELOCITY
  const g = MOTOR.gravity
  const airtime = (v + Math.sqrt(v * v - 2 * g * Math.max(0, rise))) / g
  return MOTOR.runSpeed * airtime
}

// The moves a layout asks of the player, read from its ground and platform geometry. Holes are the
// empty spans between stretches of surface. Steps and ledges are height changes: between ground
// runs that touch, and from the ground up to a platform over it. A rise is positive when the
// landing is higher.
function movesOf(layout: StretchLayout) {
  const surfaces = [...layout.grounds, ...layout.platforms].sort((a, b) => a.x - b.x)
  const holes: { width: number; rise: number }[] = []
  let edge = surfaces[0]
  for (const next of surfaces.slice(1)) {
    if (next.x > edge.x + edge.w) holes.push({ width: next.x - (edge.x + edge.w), rise: edge.top - next.top })
    if (next.x + next.w > edge.x + edge.w) edge = next
  }

  const steps: number[] = []
  layout.grounds.forEach((ground, i) => {
    const next = layout.grounds[i + 1]
    if (next && ground.x + ground.w === next.x) steps.push(ground.top - next.top)
  })

  const ledges: number[] = []
  for (const platform of layout.platforms) {
    const under = layout.grounds.find((g) => g.x <= platform.x && platform.x + platform.w <= g.x + g.w)
    if (under) ledges.push(under.top - platform.top)
  }
  return { holes, steps, ledges }
}

describe('generateStretch', () => {
  it('gives the same layout for the same segment and seed', () => {
    const segment = segmentWith(9)
    expect(generateStretch(segment, 'abc')).toEqual(generateStretch(segment, 'abc'))
    expect(generateStretch(segment, 'abc')).not.toEqual(generateStretch(segment, 'xyz'))
  })

  it('grows with the mob count, one encounter chunk per one or two mobs', () => {
    for (const seed of seeds) {
      const small = generateStretch(segmentWith(4), seed)
      const large = generateStretch(segmentWith(20), seed)
      expect(large.chunks.length).toBeGreaterThanOrEqual(10)
      expect(large.chunks.length).toBeLessThanOrEqual(20)
      expect(large.width).toBeGreaterThan(small.width)
    }
  })

  it('makes a segment without annotations a short corridor of the minimum chunk count', () => {
    for (const seed of seeds) {
      const layout = generateStretch(segmentWith(0), seed)
      expect(layout.chunks).toHaveLength(MIN_CHUNKS)
      expect(layout.spawns).toHaveLength(0)
      expect(layout.door.x).toBeLessThan(layout.width)
    }
  })

  it('keeps every gap and step clearable with the base jump', () => {
    const seen = { holes: 0, steps: 0, ledges: 0 }
    for (const seed of seeds) {
      const { holes, steps, ledges } = movesOf(generateStretch(segmentWith(30), seed))
      seen.holes += holes.length
      seen.steps += steps.length
      seen.ledges += ledges.length
      for (const hole of holes) {
        expect(hole.width).toBeLessThanOrEqual(MAX_GAP_TILES * TILE)
        expect(hole.rise).toBeLessThan(maxRise)
        expect(hole.width).toBeLessThanOrEqual(reachAt(hole.rise))
      }
      for (const step of steps) {
        expect(Math.abs(step)).toBeLessThanOrEqual(MAX_STEP_TILES * TILE)
        expect(step).toBeLessThan(maxRise)
      }
      for (const ledge of ledges) expect(ledge).toBeLessThan(maxRise)
    }
    expect(seen.holes).toBeGreaterThan(0)
    expect(seen.steps).toBeGreaterThan(0)
    expect(seen.ledges).toBeGreaterThan(0)
  })

  it('gives every mob a spawn point on ground or on a platform', () => {
    for (const seed of seeds) {
      const layout = generateStretch(segmentWith(13, 2), seed)
      expect(layout.spawns).toHaveLength(13)
      for (const spawn of layout.spawns) {
        const surfaces = [...layout.grounds, ...layout.platforms]
        const standsOn = surfaces.some((s) => s.top === spawn.y && spawn.x >= s.x && spawn.x <= s.x + s.w)
        expect(standsOn).toBe(true)
      }
    }
  })
})
