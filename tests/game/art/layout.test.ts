import { describe, expect, it } from 'vitest'
import type { BodyKind, EnemyWeaponKind, MonsterSpec, PassiveKind } from '../../../src/game/contracts/content'
import {
  BODY_ASPECT,
  ENEMY_WEAPON,
  MONSTER_HEIGHT,
  TEXTURE_SCALE,
  faceVariant,
  frameRects,
  monsterLayout,
  seedFor,
  telegraphKey,
} from '../../../src/game/phaser/art/layout'

const BODIES = Object.keys(BODY_ASPECT) as BodyKind[]
const WEAPONS = Object.keys(ENEMY_WEAPON) as EnemyWeaponKind[]
const SIZES = ['small', 'medium', 'large'] as const

function spec(body: BodyKind, weapon: EnemyWeaponKind, size: MonsterSpec['size'], scale: number, passive: PassiveKind = 'armored'): Pick<MonsterSpec, 'body' | 'size' | 'weapon' | 'passive'> {
  return {
    body,
    size,
    weapon: { kind: weapon, scale, calibrated: false, damage: 1, cooldownMs: 1000, range: 80 },
    passive: { kind: passive, variant: 0 },
  }
}

describe('frameRects', () => {
  it('lays the variants side by side in canvas pixels', () => {
    const rects = frameRects(3, 24.5, 10)
    expect(rects).toHaveLength(3)
    expect(rects[0]).toEqual({ x: 0, y: 0, w: Math.ceil(24.5 * TEXTURE_SCALE), h: 10 * TEXTURE_SCALE })
    expect(rects[2].x).toBe(rects[0].w * 2)
  })
})

describe('seedFor', () => {
  it('is stable, positive and different per variant and shape', () => {
    expect(seedFor(7, 1, 2)).toBe(seedFor(7, 1, 2))
    expect(seedFor(7, 0, 0)).not.toBe(seedFor(7, 1, 0))
    expect(seedFor(7, 0, 0)).not.toBe(seedFor(7, 0, 1))
    for (let i = 0; i < 200; i++) {
      const seed = seedFor(i * 7919, i % 3, i)
      expect(seed).toBeGreaterThanOrEqual(1 << 20)
      expect(seed).toBeLessThan(2 ** 31)
    }
  })
})

describe('monsterLayout', () => {
  it('uses the body heights 20, 30 and 44', () => {
    expect(SIZES.map((size) => monsterLayout(spec('golem', 'claw', size, 1)).body.h)).toEqual([MONSTER_HEIGHT.small, MONSTER_HEIGHT.medium, MONSTER_HEIGHT.large])
    expect(MONSTER_HEIGHT).toEqual({ small: 20, medium: 30, large: 44 })
  })

  it('keeps the hand, the weapon tip and the body inside the sprite for every combination', () => {
    for (const body of BODIES) {
      for (const weapon of WEAPONS) {
        for (const size of SIZES) {
          for (const scale of [0.75, 1.6]) {
            const layout = monsterLayout(spec(body, weapon, size, scale))
            const label = `${body} ${weapon} ${size} ${scale}`
            expect(layout.hand.x, label).toBeLessThanOrEqual(layout.width)
            expect(layout.tip.x, label).toBeLessThanOrEqual(layout.width)
            expect(layout.tip.x, label).toBeGreaterThanOrEqual(0)
            expect(layout.tip.y, label).toBeGreaterThanOrEqual(0)
            expect(layout.tip.y, label).toBeLessThanOrEqual(layout.height)
            expect(layout.body.x + layout.body.w, label).toBeLessThanOrEqual(layout.width)
          }
        }
      }
    }
  })

  it('centres the body so the sprite works mirrored', () => {
    const layout = monsterLayout(spec('beetle', 'spear', 'medium', 1.2))
    expect(layout.body.x * 2 + layout.body.w).toBe(layout.width)
  })

  it('makes room for a longer weapon and for a mark above the head', () => {
    const small = monsterLayout(spec('imp', 'whip', 'medium', 0.75))
    const big = monsterLayout(spec('imp', 'whip', 'medium', 1.6))
    expect(big.width).toBeGreaterThan(small.width)
    expect(monsterLayout(spec('imp', 'whip', 'medium', 1, 'blink')).height).toBeGreaterThan(monsterLayout(spec('imp', 'whip', 'medium', 1, 'armored')).height)
  })
})

describe('faceVariant', () => {
  it('gives sixteen different faces for variants 0 to 15', () => {
    const faces = new Set(Array.from({ length: 16 }, (_, v) => JSON.stringify(faceVariant(v))))
    expect(faces.size).toBe(16)
  })
})

describe('telegraphKey', () => {
  it('rounds the size so near-equal zones share a texture', () => {
    expect(telegraphKey('rect', 80.4, 39.6)).toBe('scribble:telegraph:rect:80x40')
    expect(telegraphKey('rect', 80.4, 39.6)).toBe(telegraphKey('rect', 80, 40))
    expect(telegraphKey('circle', 80, 40)).not.toBe(telegraphKey('rect', 80, 40))
  })
})
