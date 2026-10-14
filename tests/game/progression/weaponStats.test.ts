import { describe, expect, it, vi } from 'vitest'
import type { AttackContext, AttackMove, WeaponMoveset } from '../../../src/game/contracts/player'
import type { PlayerWeaponId, WeaponSlot } from '../../../src/game/contracts/progression'
import { createBuild } from '../../../src/game/model/progression/build'
import { CARDS } from '../../../src/game/model/progression/catalog'
import { weaponRelation, weaponStats } from '../../../src/game/model/progression/weaponStats'
import { staffMoveset } from '../../../src/game/phaser/player/staffMoveset'
import { beakerMoveset, bunsenMoveset, discMoveset, petriMoveset } from '../../../src/game/phaser/player/weapons/heavy'
import { bindScheduler, heavyOf } from '../../../src/game/phaser/player/weapons/kit'
import { pipetteMoveset, scalpelMoveset, wandMoveset, whipMoveset } from '../../../src/game/phaser/player/weapons/light'
import { createScheduler } from '../../../src/game/phaser/player/weapons/scheduler'

// The flame cone draws sprites, which a test without a scene cannot.
vi.mock('../../../src/game/phaser/player/weapons/flame', () => ({ flameVisual: () => ({ show() {} }) }))

const MOVESETS: Record<PlayerWeaponId, WeaponMoveset> = {
  staff: staffMoveset,
  wand: wandMoveset,
  pipettePistol: pipetteMoveset,
  scalpel: scalpelMoveset,
  sequenceWhip: whipMoveset,
  centrifugeDisc: discMoveset,
  beakerHammer: beakerMoveset,
  bunsenStaff: bunsenMoveset,
  petriShield: petriMoveset,
}

interface Captured {
  damage: number
  // Forward extent of a melee box, null for a shot.
  reach: number | null
}

interface Box {
  damage: number
  shape: { kind: string; x: number; w?: number; r?: number }
}

// Runs a move against a fake world and returns the damaging hits it spawns, the delayed ones included.
function fire(move: AttackMove, tier: 1 | 2): Captured[] {
  const hits: Captured[] = []
  const scene = {} as AttackContext['scene']
  const scheduler = createScheduler()
  const unbind = bindScheduler(scene, scheduler)
  const ctx = {
    scene,
    tier,
    rangeScale: 1,
    aim: { x: 100, y: -20 },
    held: new Set(),
    art: { projectile: () => ({ textureKey: 't', animKey: 'a' }) },
    player: {
      getBuild: () => ({ stats: { attackSpeed: 1 } }),
      position: () => ({ x: 0, y: 0 }),
      facing: () => 1,
      isDead: () => false,
    },
    combat: {
      spawnHitbox(box: Box) {
        const { shape } = box
        hits.push({ damage: box.damage, reach: shape.x + (shape.kind === 'rect' ? (shape.w ?? 0) : (shape.r ?? 0)) })
      },
      spawnProjectile(shot: { damage: number }) {
        hits.push({ damage: shot.damage, reach: null })
      },
    },
  } as unknown as AttackContext
  move.onActive(ctx)
  for (let i = 0; i < 5; i++) scheduler.update(5000)
  unbind()
  return hits.filter((hit) => hit.damage > 0)
}

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0)
const ascending = (values: number[]) => [...values].sort((a, b) => a - b)

const COMBOS: { id: PlayerWeaponId; slot: WeaponSlot; tier: 1 | 2 }[] = [
  { id: 'staff', slot: 'light', tier: 1 },
  { id: 'staff', slot: 'heavy', tier: 1 },
  ...CARDS.flatMap((card) =>
    card.kind === 'weapon' && card.slot
      ? ([1, 2] as const).map((tier) => ({ id: card.id.replace('weapon.', '') as PlayerWeaponId, slot: card.slot as WeaponSlot, tier }))
      : [],
  ),
]

// The disc and the beaker spawn more shots than one target takes (a second disc, a wave to each
// side), so for them the table must only be contained in what the world spawns.
const SPLIT_TARGETS: PlayerWeaponId[] = ['centrifugeDisc', 'beakerHammer']

describe('weaponStats table against the real movesets', () => {
  it('covers every weapon card at both tiers', () => {
    expect(COMBOS.length).toBe(2 + 8 * 2)
  })

  it.each(COMBOS)('$id $slot tier $tier', ({ id, slot, tier }) => {
    const stats = weaponStats(id, slot, tier)
    const real = MOVESETS[id].moves(slot, tier)
    expect(stats.moves.map((m) => m.name)).toEqual(real.map((m) => m.name))
    real.forEach((move, i) => {
      const row = stats.moves[i]
      // The next move may cancel after startup, active and cancelAfterMs of the recovery.
      expect(row.timeMs, move.name).toBe(move.startupMs + move.activeMs + move.cancelAfterMs)
      const hits = fire(move, tier)
      const damages = ascending(hits.map((hit) => hit.damage))
      if (SPLIT_TARGETS.includes(id)) {
        const spawned = [...damages]
        for (const damage of row.damages) {
          const at = spawned.indexOf(damage)
          expect(at, `${move.name} ${damage}`).toBeGreaterThanOrEqual(0)
          spawned.splice(at, 1)
        }
      } else {
        expect(damages, move.name).toEqual(ascending(row.damages))
      }
      const melee = hits.flatMap((hit) => (hit.reach === null ? [] : [hit.reach]))
      if (row.reach === 'ranged') expect(melee, move.name).toEqual([])
      else expect(Math.max(...melee), move.name).toBe(row.reach)
      const declared = heavyOf(move)
      if (declared) expect([row.damages[0], sum(row.damages)], move.name).toContain(declared.damage)
    })
  })

  it('derives the per-second numbers from the moves', () => {
    const wand = weaponStats('wand', 'light', 1)
    expect(wand.attacksPerSecond).toBeCloseTo(3000 / 620)
    expect(wand.damagePerHit).toBeCloseTo((9 + 9 + 14) / 3)
    const petri = weaponStats('petriShield', 'heavy', 2)
    expect(petri.attacksPerSecond).toBeCloseTo(1000 / 1050)
    expect(petri.reach).toBe(60)
  })

  it('names tier 2 as the catalog announces it', () => {
    expect(weaponStats('scalpel', 'light', 2).name).toBe('Dual Scalpels')
    expect(weaponStats('bunsenStaff', 'heavy', 2).name).toBe('Overclocked Bunsen Staff')
    expect(weaponStats('staff', 'heavy', 1).name).toBe('Staff')
  })

  it('rejects a weapon in the wrong slot', () => {
    expect(() => weaponStats('wand', 'heavy', 1)).toThrow()
  })
})

describe('weaponRelation', () => {
  const build = createBuild()
  const withLight = (id: 'wand', tier: 1 | 2) => ({ ...build, weapons: { ...build.weapons, light: { id, tier } } })

  it('replaces the staff and other weapons', () => {
    expect(weaponRelation(build, { id: 'weapon.wand', slot: 'light' })).toEqual({ kind: 'replace', slot: 'light', currentName: 'Staff' })
    expect(weaponRelation(withLight('wand', 1), { id: 'weapon.scalpel', slot: 'light' })).toEqual({ kind: 'replace', slot: 'light', currentName: 'Wand' })
  })

  it('upgrades the same weapon at tier 1', () => {
    expect(weaponRelation(withLight('wand', 1), { id: 'weapon.wand', slot: 'light' })).toEqual({ kind: 'upgrade', slot: 'light', currentName: 'Wand' })
  })

  it('does nothing at tier 2 and for other cards', () => {
    expect(weaponRelation(withLight('wand', 2), { id: 'weapon.wand', slot: 'light' }).kind).toBe('none')
    expect(weaponRelation(build, { id: 'stat.sharpened' }).kind).toBe('none')
  })
})
