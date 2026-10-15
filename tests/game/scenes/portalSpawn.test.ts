import { describe, expect, it } from 'vitest'
import {
  createPortalFrame,
  PORTAL_ARCH_FROM_MS,
  PORTAL_ARCH_MS,
  PORTAL_FLASH_MS,
  PORTAL_LABEL_MS,
  PORTAL_SPARKS,
  PORTAL_SPAWN_MS,
  portalAt,
  portalSparkAt,
} from '../../../src/game/phaser/scenes/portalSpawn'

const at = (ms: number) => ({ ...portalAt(createPortalFrame(), ms) })

describe('portalAt', () => {
  it('takes about three seconds to open', () => {
    expect(PORTAL_SPAWN_MS).toBeGreaterThanOrEqual(2500)
    expect(PORTAL_SPAWN_MS).toBeLessThanOrEqual(3500)
    expect(PORTAL_ARCH_FROM_MS + PORTAL_ARCH_MS).toBeLessThan(PORTAL_SPAWN_MS)
  })

  it('cannot be entered while it forms, and can from the moment it is whole', () => {
    for (let ms = 0; ms < PORTAL_SPAWN_MS; ms += 50) expect(at(ms).ready).toBe(false)
    expect(at(PORTAL_SPAWN_MS).ready).toBe(true)
    expect(at(PORTAL_SPAWN_MS + 10_000).ready).toBe(true)
  })

  it('grows the swirl from a point and draws the arch in from nothing', () => {
    expect(at(0).swirlScale).toBe(0)
    expect(at(0).arch).toBe(0)
    let previous = -1
    for (let ms = 0; ms <= PORTAL_ARCH_FROM_MS + PORTAL_ARCH_MS; ms += 50) {
      const { arch } = at(ms)
      expect(arch).toBeGreaterThanOrEqual(previous)
      previous = arch
    }
    expect(at(PORTAL_ARCH_FROM_MS + PORTAL_ARCH_MS).arch).toBe(1)
  })

  it('stays dim and flickers until it is open, then shows at full strength', () => {
    const alphas = new Set<number>()
    for (let ms = 0; ms < PORTAL_SPAWN_MS; ms += 37) {
      const { archAlpha } = at(ms)
      expect(archAlpha).toBeLessThan(0.55)
      alphas.add(Math.round(archAlpha * 100))
    }
    expect(alphas.size).toBeGreaterThan(5)
    expect(at(PORTAL_SPAWN_MS).archAlpha).toBe(1)
  })

  it('flashes and shows the sign at the moment it opens, not before', () => {
    expect(at(PORTAL_SPAWN_MS - 1).flash).toBe(0)
    expect(at(PORTAL_SPAWN_MS - 1).label).toBe(0)
    expect(at(PORTAL_SPAWN_MS).flash).toBe(1)
    expect(at(PORTAL_SPAWN_MS + PORTAL_FLASH_MS).flash).toBe(0)
    expect(at(PORTAL_SPAWN_MS + PORTAL_LABEL_MS).label).toBe(1)
    expect(at(PORTAL_SPAWN_MS + PORTAL_FLASH_MS / 2).swirlScale).toBeGreaterThan(1.2)
  })

  it('sends sparks in only while it forms', () => {
    expect(at(PORTAL_SPAWN_MS / 2).sparks).toBe(true)
    expect(at(PORTAL_SPAWN_MS).sparks).toBe(false)
    const spark = { dx: 0, dy: 0, alpha: 0 }
    let seen = 0
    for (let i = 0; i < PORTAL_SPARKS; i++) if (portalSparkAt(spark, PORTAL_SPAWN_MS / 2, i).alpha > 0) seen++
    expect(seen).toBeGreaterThan(PORTAL_SPARKS / 2)
    for (let i = 0; i < PORTAL_SPARKS; i++) expect(portalSparkAt(spark, PORTAL_SPAWN_MS, i).alpha).toBe(0)
  })
})
