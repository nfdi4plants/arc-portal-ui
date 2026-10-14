import { describe, expect, it } from 'vitest'
import { PLAYER_HEIGHT, TILE, WORLD_MAX_ASPECT, WORLD_MIN_VIEW_WIDTH, WORLD_VIEW_HEIGHT } from '../../../src/game/contracts/constants'
import {
  arenaPlatforms,
  fallMs,
  freeFloorX,
  JUMP_APEX,
  PLATFORM_THICKNESS,
  platformBodyY,
  platformUnder,
} from '../../../src/game/phaser/bosses/zones'

// scenes/arena.ts makes the arena 1.6 view widths wide, rounded to whole tiles.
const arenaWidth = (viewWidth: number) => Math.round((1.6 * viewWidth) / TILE) * TILE
const WIDTHS = [arenaWidth(WORLD_MIN_VIEW_WIDTH), arenaWidth(640), arenaWidth(WORLD_VIEW_HEIGHT * WORLD_MAX_ASPECT)]

describe('arenaPlatforms', () => {
  it.each(WIDTHS)('puts platforms a plain jump reaches and the player fits under (width %i)', (width) => {
    for (const p of arenaPlatforms(0, width, 0)) {
      const lift = -p.top
      expect(lift).toBeLessThan(JUMP_APEX - 12)
      expect(lift - PLATFORM_THICKNESS).toBeGreaterThan(PLAYER_HEIGHT)
    }
  })

  it.each(WIDTHS)('spreads them inside the walls without overlaps, on the tile grid (width %i)', (width) => {
    const platforms = arenaPlatforms(0, width, 0)
    expect(platforms.length).toBeGreaterThanOrEqual(2)
    expect(platforms[0].x).toBeGreaterThan(0)
    expect(platforms[platforms.length - 1].x + platforms[platforms.length - 1].w).toBeLessThan(width)
    for (let i = 1; i < platforms.length; i++) {
      // Wide enough gaps to stand between them on the floor.
      expect(platforms[i].x - (platforms[i - 1].x + platforms[i - 1].w)).toBeGreaterThanOrEqual(4 * TILE)
    }
    for (const p of platforms) expect(p.x % TILE).toBe(0)
  })

  it('keeps every spot of the floor within a short run of a platform', () => {
    const width = WIDTHS[2]
    const platforms = arenaPlatforms(0, width, 0)
    for (let x = 0; x <= width; x += 8) {
      const nearest = Math.min(...platforms.map((p) => (x < p.x ? p.x - x : x > p.x + p.w ? x - p.x - p.w : 0)))
      expect(nearest).toBeLessThanOrEqual(5 * TILE)
    }
  })
})

describe('platformUnder', () => {
  const platforms = arenaPlatforms(0, WIDTHS[0], 0)
  const p = platforms[1]

  it('finds the platform the feet stand on', () => {
    expect(platformUnder(platforms, p.x + p.w / 2, p.top)).toBe(p)
  })

  it('is null on the floor, in the air and beside a platform', () => {
    expect(platformUnder(platforms, p.x + p.w / 2, 0)).toBeNull()
    expect(platformUnder(platforms, p.x + p.w / 2, p.top - 20)).toBeNull()
    expect(platformUnder(platforms, p.x - 10, p.top)).toBeNull()
  })

  it('puts a body on a platform at its middle', () => {
    expect(platformBodyY(p)).toBe(p.top - PLAYER_HEIGHT / 2)
  })
})

describe('freeFloorX', () => {
  const arena = { left: 0, right: WIDTHS[0], platforms: arenaPlatforms(0, WIDTHS[0], 0) }

  it('keeps a spot that is already free', () => {
    const [a, b] = arena.platforms
    const gapMiddle = (a.x + a.w + b.x) / 2
    expect(freeFloorX(arena, gapMiddle, 2 * TILE)).toBe(gapMiddle)
  })

  it('moves a door out from under a platform to the nearest free floor', () => {
    const p = arena.platforms[1]
    const x = freeFloorX(arena, p.x + p.w / 2, 2 * TILE)
    for (const q of arena.platforms) expect(x + TILE <= q.x || x - TILE >= q.x + q.w).toBe(true)
    expect(Math.abs(x - (p.x + p.w / 2))).toBeLessThan(p.w / 2 + 2 * TILE)
  })
})

describe('fallMs', () => {
  it('matches the time a drop takes to fall the distance', () => {
    const t = fallMs(240, 60, 760) / 1000
    expect(60 * t + 0.5 * 760 * t * t).toBeCloseTo(240, 5)
  })

  it('is 0 for no distance', () => {
    expect(fallMs(0, 60, 760)).toBe(0)
  })
})
