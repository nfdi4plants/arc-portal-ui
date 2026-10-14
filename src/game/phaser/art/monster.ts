import type Phaser from 'phaser'
import type { SpriteRef } from '../../contracts/art'
import type { MonsterSpec } from '../../contracts/content'
import { animKeyOf, spriteFrom } from './atlas'
import { BODIES, drawFace } from './bodies'
import { drawEnemyWeapon } from './enemyWeapons'
import { faceIndexOf, monsterLayout } from './layout'
import { drawBodyMark, drawHeadMark } from './marks'
import { swatch } from './palette'

const KEY_PREFIX = 'scribble:monster:'
// A summoner's minions are drawn from the summoner's spec under this id suffix.
export const MINION_ID_SUFFIX = ':minion'

// The id is a hash of the annotation, so the same annotation reuses its texture in every scene.
export function monster(scene: Phaser.Scene, spec: MonsterSpec): SpriteRef {
  const layout = monsterLayout(spec)
  const sw = swatch(spec.hue)
  const { body } = layout
  return spriteFrom(scene, {
    key: `${KEY_PREFIX}${spec.id}`,
    width: layout.width,
    height: layout.height,
    anchors: {
      weapon: { x: layout.tip.x - layout.width / 2, y: layout.tip.y - layout.height },
      head: { x: 0, y: body.y - layout.height },
    },
    draw(pen) {
      BODIES[spec.body](pen, body, sw)
      drawBodyMark(pen, spec.passive.kind, body)
      drawFace(pen, body, spec.body, faceIndexOf(spec))
      drawEnemyWeapon(pen, spec.weapon.kind, layout.hand, layout.weaponLength, sw)
      drawHeadMark(pen, spec.passive.kind, body, sw)
    },
  })
}

// The spec a summoner's minions are drawn from: a small slime that keeps the summoner's hue, weapon
// and passive. mobs/mob.ts builds the same look, so drawing this ahead of time fills the cache.
export function minionArtSpec(spec: MonsterSpec): MonsterSpec {
  return { ...spec, id: `${spec.id}${MINION_ID_SUFFIX}`, body: 'slime', size: 'small' }
}

// Monster textures live as long as the game, so a long path would collect one per annotation it
// ever met. This drops the ones whose spec id is not in `keepIds`, and the animations over them.
// The animation goes first: removing it stops any sprite still playing it, so no sprite is left
// pointing at a destroyed frame. The memoised SpriteRef sits on the texture, so it goes with it.
export function releaseMonsters(scene: Phaser.Scene, keepIds: ReadonlySet<string>): void {
  for (const key of scene.textures.getTextureKeys()) {
    if (!key.startsWith(KEY_PREFIX)) continue
    const id = key.slice(KEY_PREFIX.length)
    const base = id.endsWith(MINION_ID_SUFFIX) ? id.slice(0, -MINION_ID_SUFFIX.length) : id
    if (keepIds.has(id) || keepIds.has(base)) continue
    scene.anims.remove(animKeyOf(key))
    scene.textures.remove(key)
  }
}
