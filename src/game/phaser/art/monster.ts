import type Phaser from 'phaser'
import type { SpriteRef } from '../../contracts/art'
import type { MonsterSpec } from '../../contracts/content'
import { animKeyOf, spriteFrom } from './atlas'
import { BODIES, drawFace } from './bodies'
import { WEAPON_TIP, drawEnemyWeapon, enemyWeaponFrame, enemyWeaponLength } from './enemyWeapons'
import { ENEMY_WEAPON, faceIndexOf, monsterLayout } from './layout'
import { drawBodyMark, drawHeadMark } from './marks'
import { swatch } from './palette'

const KEY_PREFIX = 'scribble:monster:'
// A summoner's minions are drawn from the summoner's spec under this id suffix.
export const MINION_ID_SUFFIX = ':minion'
// The weapon texture of a monster sits under the monster's id plus this suffix.
const WEAPON_ID_SUFFIX = ':weapon'

// The id is a hash of the annotation, so the same annotation reuses its texture in every scene.
// The weapon is a texture of its own (monsterWeapon), drawn here too so prewarming covers it.
export function monster(scene: Phaser.Scene, spec: MonsterSpec): SpriteRef {
  const layout = monsterLayout(spec)
  const sw = swatch(spec.hue)
  const { body } = layout
  monsterWeapon(scene, spec)
  return spriteFrom(scene, {
    key: `${KEY_PREFIX}${spec.id}`,
    width: layout.width,
    height: layout.height,
    anchors: {
      // The hand that holds the weapon sprite.
      weapon: { x: layout.hand.x - layout.width / 2, y: layout.hand.y - layout.height },
      head: { x: 0, y: body.y - layout.height },
    },
    draw(pen) {
      BODIES[spec.body](pen, body, sw)
      drawBodyMark(pen, spec.passive.kind, body)
      drawFace(pen, body, spec.body, faceIndexOf(spec))
      drawHeadMark(pen, spec.passive.kind, body, sw)
    },
  })
}

export interface MonsterWeaponRef extends SpriteRef {
  // Sprite origin that puts the hand on the sprite position, so rotating the sprite swings the
  // weapon around the hand. Mirror it with a negative x scale, not flipX, to keep the hand in place.
  originX: number
  originY: number
  // World units from the hand to the weapon's business end when it points along +x.
  tip: number
  length: number
  // Resting direction in radians, 0 = forward, negative = up.
  rest: number
}

export function monsterWeapon(scene: Phaser.Scene, spec: MonsterSpec): MonsterWeaponRef {
  const { kind } = spec.weapon
  const length = enemyWeaponLength(kind, monsterLayout(spec).body.h, spec.weapon.scale)
  const frame = enemyWeaponFrame(kind, length)
  const ref = spriteFrom(scene, {
    key: `${KEY_PREFIX}${spec.id}${WEAPON_ID_SUFFIX}`,
    width: frame.width,
    height: frame.height,
    anchors: { weapon: { x: frame.handX - frame.width / 2, y: frame.handY - frame.height }, head: { x: 0, y: -frame.height } },
    draw(pen) {
      drawEnemyWeapon(pen, kind, frame, length, swatch(spec.hue))
    },
  })
  return {
    ...ref,
    originX: frame.handX / frame.width,
    originY: frame.handY / frame.height,
    tip: WEAPON_TIP[kind] * length,
    length,
    rest: ENEMY_WEAPON[kind].angle,
  }
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
// A weapon texture goes with its monster.
export function releaseMonsters(scene: Phaser.Scene, keepIds: ReadonlySet<string>): void {
  for (const key of scene.textures.getTextureKeys()) {
    if (!key.startsWith(KEY_PREFIX)) continue
    let id = key.slice(KEY_PREFIX.length)
    if (id.endsWith(WEAPON_ID_SUFFIX)) id = id.slice(0, -WEAPON_ID_SUFFIX.length)
    const base = id.endsWith(MINION_ID_SUFFIX) ? id.slice(0, -MINION_ID_SUFFIX.length) : id
    if (keepIds.has(id) || keepIds.has(base)) continue
    scene.anims.remove(animKeyOf(key))
    scene.textures.remove(key)
  }
}
