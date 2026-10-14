import { describe, expect, it } from 'vitest'
import type { EnemyWeaponKind } from '../../../src/game/contracts/content'
import { PLAYER_HEIGHT } from '../../../src/game/contracts/constants'
import { WEAPON_TIP, enemyWeaponFrame, enemyWeaponLength } from '../../../src/game/phaser/art/enemyWeapons'
import { ENEMY_WEAPON, MONSTER_HEIGHT, weaponLength } from '../../../src/game/phaser/art/layout'

const WEAPONS = Object.keys(ENEMY_WEAPON) as EnemyWeaponKind[]

describe('enemyWeaponLength', () => {
  it('is clearly larger than the weapon that used to be baked into the body', () => {
    for (const kind of WEAPONS) {
      for (const h of Object.values(MONSTER_HEIGHT)) {
        expect(enemyWeaponLength(kind, h, 1)).toBeGreaterThan(weaponLength(kind, h, 1) * 1.5)
      }
    }
  })

  it('reads next to the body without dwarfing the mage', () => {
    for (const kind of WEAPONS) {
      expect(enemyWeaponLength(kind, MONSTER_HEIGHT.small, 0.75)).toBeGreaterThanOrEqual(MONSTER_HEIGHT.small * 0.5)
      expect(enemyWeaponLength(kind, MONSTER_HEIGHT.large, 1.6)).toBeLessThan(PLAYER_HEIGHT * 1.4)
    }
  })

  it('grows with the body and with the weapon scale', () => {
    expect(enemyWeaponLength('spear', MONSTER_HEIGHT.large, 1)).toBeGreaterThan(enemyWeaponLength('spear', MONSTER_HEIGHT.small, 1))
    expect(enemyWeaponLength('spear', MONSTER_HEIGHT.medium, 1.6)).toBeGreaterThan(enemyWeaponLength('spear', MONSTER_HEIGHT.medium, 1))
  })
})

describe('enemyWeaponFrame', () => {
  it('holds the hand and the business end inside the frame', () => {
    for (const kind of WEAPONS) {
      const length = enemyWeaponLength(kind, MONSTER_HEIGHT.medium, 1)
      const frame = enemyWeaponFrame(kind, length)
      expect(frame.handX).toBeGreaterThan(0)
      expect(frame.handY).toBeGreaterThan(0)
      expect(frame.handY).toBeLessThan(frame.height)
      expect(frame.handX + WEAPON_TIP[kind] * length).toBeLessThan(frame.width)
    }
  })
})
