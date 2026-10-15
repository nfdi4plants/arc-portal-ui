import { describe, expect, it, vi } from 'vitest'
import type { HitboxSpec, HitShape } from '../../../src/game/contracts/combat'
import type { AttackContext, AttackMove, AttackVariant, WeaponMoveset } from '../../../src/game/contracts/player'
import type { PlayerWeaponId } from '../../../src/game/contracts/progression'
import { WEAPON_DEFS } from '../../../src/game/phaser/art/playerWeapons'
import { overlaps, resolveShape } from '../../../src/game/phaser/combat/geometry'
import type { AttackPhase } from '../../../src/game/phaser/player/attacks'
import { staffMoveset } from '../../../src/game/phaser/player/staffMoveset'
import { beakerMoveset, bunsenMoveset, petriMoveset } from '../../../src/game/phaser/player/weapons/heavy'
import { MELEE_BODY_HALF_WIDTH, MELEE_MARGIN, forgivingShape } from '../../../src/game/phaser/player/weapons/helpers'
import { bindScheduler } from '../../../src/game/phaser/player/weapons/kit'
import { pressMoveset } from '../../../src/game/phaser/player/weapons/legendaryMoves'
import { scalpelMoveset, whipMoveset } from '../../../src/game/phaser/player/weapons/light'
import { createScheduler } from '../../../src/game/phaser/player/weapons/scheduler'
import { holdOf, weaponPose } from '../../../src/game/phaser/player/weaponPose'
import type { WeaponHold, WeaponPose } from '../../../src/game/phaser/player/weaponPose'

// The flame cone draws sprites, which a test without a scene cannot.
vi.mock('../../../src/game/phaser/player/weapons/flame', () => ({ flameVisual: () => ({ show() {} }) }))

// The boxes a move spawns, as the move layer hands them to the combat world (with forgivingShape).
// Delayed hits (the shield bash, the later flame pulses) are included.
function boxesOf(move: AttackMove, tier: 1 | 2, hook: 'onActive' | 'onLand' = 'onActive'): HitShape[] {
  const spawned: HitboxSpec[] = []
  const scene = { physics: { overlapRect: () => [] } }
  const scheduler = createScheduler()
  const unbind = bindScheduler(scene as unknown as AttackContext['scene'], scheduler)
  const player = {
    position: () => ({ x: 0, y: 0 }),
    facing: () => 1,
    getBuild: () => ({ stats: { attackSpeed: 1 } }),
    isGrounded: () => true,
    isDead: () => false,
  }
  const ctx = {
    scene,
    art: { projectile: () => ({ textureKey: 't', animKey: 'a' }) },
    combat: {
      spawnHitbox: (spec: HitboxSpec) => {
        spawned.push(spec)
        return { cancel() {} }
      },
      spawnProjectile: () => ({ cancel() {} }),
      livingCombatants: () => [],
      cancelShots: () => 0,
    },
    player,
    aim: { x: 100, y: -20 },
    tier,
    rangeScale: 1,
    held: new Set(),
  } as unknown as AttackContext
  move[hook]?.(ctx)
  for (let i = 0; i < 5; i++) scheduler.update(5000)
  unbind()
  return spawned.map((spec) => forgivingShape(spec.shape))
}

// The mage's hurtbox (PLAYER_HURTBOX in Player.ts, which needs Phaser).
const BODY_W = MELEE_BODY_HALF_WIDTH * 2
const BODY_H = 42

// Points along the drawn weapon (centre line and the two far corners) for a right-facing mage.
// Points under the floor and inside the mage's own body are left out: no enemy stands there apart
// from the body, and contact with the body is not a weapon hit.
function weaponPoints(pose: WeaponPose, width: number, length: number, floor = true): { x: number; y: number }[] {
  const dir = { x: Math.sin(pose.angle), y: -Math.cos(pose.angle) }
  const side = { x: Math.cos(pose.angle), y: Math.sin(pose.angle) }
  const points = []
  for (let t = 0; t <= 1; t += 0.1) points.push({ x: pose.x + dir.x * length * t, y: pose.y + dir.y * length * t })
  for (const s of [-1, 1]) {
    points.push({ x: pose.x + dir.x * length + side.x * s * (width / 2), y: pose.y + dir.y * length + side.y * s * (width / 2) })
  }
  return points.filter((p) => !(floor && p.y > 0) && !(Math.abs(p.x) < BODY_W / 2 && p.y > -BODY_H && p.y < 0))
}

// A tiny enemy hurtbox at the point, so the overlap test asks whether the point is inside.
function covered(shapes: HitShape[], point: { x: number; y: number }, facing: 1 | -1): boolean {
  const probe = { x: facing * point.x - 0.5, y: point.y - 0.5, w: 1, h: 1 }
  return shapes.some((shape) => overlaps(resolveShape(shape, { x: 0, y: 0 }, facing), probe))
}

function poseOf(heavy: boolean, variant: AttackVariant, phase: AttackPhase = 'active', plunge = false, spinMs = 0, hold: WeaponHold = 'swing'): WeaponPose {
  return weaponPose({ heavy, variant, plunge, spin: false, hold }, phase, spinMs, { x: 0, y: 0, angle: 0, poke: 0, visible: true })
}

// The newest smear copy, which sits a quarter (light) or a fifth (heavy) of the way back to the
// wind-up pose on the first active frame.
function smearPose(heavy: boolean, hold: WeaponHold = 'swing'): WeaponPose {
  const strike = poseOf(heavy, 'ground', 'active', false, 0, hold)
  const windup = poseOf(heavy, 'ground', 'startup', false, 0, hold)
  const t = heavy ? 1 / 5 : 1 / 4
  return {
    x: strike.x + (windup.x - strike.x) * t,
    y: strike.y + (windup.y - strike.y) * t,
    angle: strike.angle + (windup.angle - strike.angle) * t,
    poke: 1,
    visible: true,
  }
}

function expectCovers(id: PlayerWeaponId, shapes: HitShape[], poses: WeaponPose[], tier: 1 | 2, floor = true) {
  const [width, length] = WEAPON_DEFS[id].size[tier - 1]
  expect(shapes.length).toBeGreaterThan(0)
  for (const pose of poses) {
    for (const point of weaponPoints(pose, width, length, floor)) {
      for (const facing of [1, -1] as const) {
        expect(covered(shapes, point, facing), `${id} tier ${tier} at (${point.x.toFixed(1)}, ${point.y.toFixed(1)}) facing ${facing}`).toBe(true)
      }
    }
  }
}

const TIERS = [1, 2] as const
const MELEE_LIGHTS: [PlayerWeaponId, WeaponMoveset][] = [
  ['staff', staffMoveset],
  ['scalpel', scalpelMoveset],
  ['sequenceWhip', whipMoveset],
]

describe('forgivingShape', () => {
  it('grows a forward rect by the margin and reaches back over the body', () => {
    const shape = forgivingShape({ kind: 'rect', x: 4, y: -40, w: 30, h: 20 })
    expect(shape).toEqual({ kind: 'rect', x: -9 - MELEE_MARGIN, y: -40 - MELEE_MARGIN, w: 34 + 9 + 2 * MELEE_MARGIN, h: 20 + 2 * MELEE_MARGIN })
  })

  it('keeps a rect that already spans the body centred where it was', () => {
    expect(forgivingShape({ kind: 'rect', x: -48, y: -40, w: 96, h: 40 })).toMatchObject({ x: -48 - MELEE_MARGIN, w: 96 + 2 * MELEE_MARGIN })
  })

  it('grows a circle by the margin', () => {
    expect(forgivingShape({ kind: 'circle', x: 0, y: -8, r: 48 })).toEqual({ kind: 'circle', x: 0, y: -8, r: 48 + MELEE_MARGIN })
  })
})

describe('melee hitboxes cover the drawn weapon', () => {
  for (const [id, set] of MELEE_LIGHTS) {
    for (const tier of TIERS) {
      it(`${id} tier ${tier}: every light move at the strike and its newest smear`, () => {
        for (const move of set.moves('light', tier)) expectCovers(id, boxesOf(move, tier), [poseOf(false, 'ground'), smearPose(false)], tier)
      })

      it(`${id} tier ${tier}: the up light`, () => {
        const up = set.upLight?.(tier, 0)
        if (up) expectCovers(id, boxesOf(up, tier), [poseOf(false, 'up')], tier)
      })
    }
  }

  for (const [id, set] of MELEE_LIGHTS.filter(([weapon]) => weapon !== 'sequenceWhip')) {
    // The whip's Crack snaps behind the dash by design.
    for (const tier of TIERS) {
      it(`${id} tier ${tier}: the dash light`, () => {
        const dash = set.dashLight?.(tier)
        if (dash) expectCovers(id, boxesOf(dash, tier), [poseOf(false, 'dash')], tier)
      })
    }
  }

  for (const tier of TIERS) {
    it(`staff tier ${tier}: the slam at the strike and its newest smear`, () => {
      expectCovers('staff', boxesOf(staffMoveset.moves('heavy', tier)[0], tier), [poseOf(true, 'ground'), smearPose(true)], tier)
    })

    it(`staff tier ${tier}: the dash heavy spin all the way round`, () => {
      const spin = staffMoveset.dashHeavy!(tier)!
      const poses = Array.from({ length: 24 }, (_, i) => poseOf(true, 'dash', 'active', false, (i * Math.PI * 2) / 24 / 0.03))
      expectCovers('staff', boxesOf(spin, tier), poses, tier)
    })

    it(`staff tier ${tier}: the plunge fall`, () => {
      const plunge = staffMoveset.airHeavy!(tier)!
      expectCovers('staff', boxesOf(plunge, tier), [poseOf(true, 'air', 'active', true)], tier, false)
    })
  }

  // The heavy weapons that strike in melee, drawn in the heavy slot with their own hold.
  const MELEE_HEAVIES: [PlayerWeaponId, WeaponMoveset][] = [
    ['beakerHammer', beakerMoveset],
    ['bunsenStaff', bunsenMoveset],
    ['petriShield', petriMoveset],
    ['publicationPress', pressMoveset],
  ]
  for (const [id, set] of MELEE_HEAVIES) {
    for (const tier of TIERS) {
      it(`${id} tier ${tier}: the heavy move at the strike and its newest smear`, () => {
        const hold = holdOf(id)
        expectCovers(id, boxesOf(set.moves('heavy', tier)[0], tier), [poseOf(true, 'ground', 'active', false, 0, hold), smearPose(true, hold)], tier)
      })
    }
  }

  it('hits a small mob standing right in front of the mage with a light jab', () => {
    const shapes = boxesOf(staffMoveset.moves('light', 1)[0], 1)
    // A small mob is about 14 by 17 units, touching the mage's front.
    const mob = { x: BODY_W / 2 - 2, y: -17, w: 14, h: 17 }
    expect(shapes.some((shape) => overlaps(resolveShape(shape, { x: 0, y: 0 }, 1), mob))).toBe(true)
  })
})
