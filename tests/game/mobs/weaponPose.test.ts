import { describe, expect, it } from 'vitest'
import type { EnemyWeaponKind } from '../../../src/game/contracts/content'
import { MAX_LUNGE, meleeLunge, poseWeapon } from '../../../src/game/phaser/mobs/weaponPose'
import type { WeaponPose, WeaponPoseInput, WeaponStage } from '../../../src/game/phaser/mobs/weaponPose'

function pose(kind: EnemyWeaponKind, stage: WeaponStage, t: number, extra: Partial<WeaponPoseInput> = {}): WeaponPose {
  const out: WeaponPose = { angle: 0, dx: 0, dy: 0, scale: 1, visible: true }
  return { ...poseWeapon(out, { kind, stage, t, length: 30, rest: -0.2, aim: 0, lunge: 10, sway: 0, ...extra }) }
}

describe('poseWeapon', () => {
  it('rears a claw up during the windup and rakes it down through the front on the strike', () => {
    const back = pose('claw', 'windup', 1)
    expect(back.angle).toBeLessThan(-1.5)
    expect(pose('claw', 'strike', 0).angle).toBeCloseTo(back.angle)
    expect(pose('claw', 'strike', 1).angle).toBeGreaterThan(0.5)
  })

  it('pushes a melee strike forward by the lunge and holds it while the hitbox is live', () => {
    expect(pose('spear', 'windup', 1).dx).toBeLessThan(0)
    expect(pose('spear', 'strike', 0.5).dx).toBeCloseTo(10)
    expect(pose('spear', 'strike', 1).dx).toBeCloseTo(10)
  })

  it('returns to rest at the end of the recovery, from where the strike ended', () => {
    for (const kind of ['claw', 'spear', 'whip', 'shield', 'bow', 'wand'] as const) {
      expect(pose(kind, 'recover', 0, { aim: 0.3 }).angle).toBeCloseTo(pose(kind, 'strike', 1, { aim: 0.3 }).angle)
      const end = pose(kind, 'recover', 1, { aim: 0.3 })
      expect(end.angle).toBeCloseTo(-0.2)
      expect(end.dx).toBeCloseTo(0)
    }
  })

  it('starts the windup from rest, so an attack does not jump', () => {
    for (const kind of ['claw', 'spear', 'whip', 'shield', 'bow', 'wand', 'bomb', 'flask'] as const) {
      const start = pose(kind, 'windup', 0)
      expect(start.angle).toBeCloseTo(-0.2)
      expect(start.dx).toBeCloseTo(0)
    }
  })

  it('points a bow at the target and kicks it back on the shot', () => {
    expect(pose('bow', 'windup', 1, { aim: 0.4 }).angle).toBeCloseTo(0.4)
    expect(pose('bow', 'strike', 0, { aim: 0.4 }).dx).toBeLessThan(0)
  })

  it('hides a thrown bomb on the shot and grows a new one back during the recovery', () => {
    expect(pose('bomb', 'strike', 0.5).visible).toBe(false)
    expect(pose('bomb', 'recover', 0).scale).toBeCloseTo(0)
    expect(pose('bomb', 'recover', 1)).toMatchObject({ visible: true, scale: 1 })
  })
})

describe('meleeLunge', () => {
  it('closes the gap between the weapon tip and the far end of the hitbox, up to a limit', () => {
    expect(meleeLunge(60, 15, 30, 40)).toBe(15)
    expect(meleeLunge(40, 15, 30, 40)).toBe(0)
    expect(meleeLunge(200, 15, 30, 40)).toBe(MAX_LUNGE * 40)
  })
})
