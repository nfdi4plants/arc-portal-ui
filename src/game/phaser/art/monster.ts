import type Phaser from 'phaser'
import type { SpriteRef } from '../../contracts/art'
import type { MonsterSpec } from '../../contracts/content'
import { spriteFrom } from './atlas'
import { BODIES, drawFace } from './bodies'
import { drawEnemyWeapon } from './enemyWeapons'
import { monsterLayout } from './layout'
import { drawBodyMark, drawHeadMark } from './marks'
import { swatch } from './palette'

// The id is a hash of the annotation, so the same annotation reuses its texture in every scene.
export function monster(scene: Phaser.Scene, spec: MonsterSpec): SpriteRef {
  const layout = monsterLayout(spec)
  const sw = swatch(spec.hue)
  const { body } = layout
  return spriteFrom(scene, {
    key: `scribble:monster:${spec.id}`,
    width: layout.width,
    height: layout.height,
    anchors: {
      weapon: { x: layout.tip.x - layout.width / 2, y: layout.tip.y - layout.height },
      head: { x: 0, y: body.y - layout.height },
    },
    draw(pen) {
      BODIES[spec.body](pen, body, sw)
      drawBodyMark(pen, spec.passive.kind, body)
      drawFace(pen, body, spec.body, spec.passive.variant)
      drawEnemyWeapon(pen, spec.weapon.kind, layout.hand, layout.weaponLength, sw)
      drawHeadMark(pen, spec.passive.kind, body, sw)
    },
  })
}
