import type Phaser from 'phaser'
import type { ScribbleArt, SpriteRef } from '../../contracts/art'
import type { MonsterSpec } from '../../contracts/content'
import { textureBytes } from './atlas'
import { boss } from './bosses'
import { finalBoss } from './finalBoss'
import { FX_KINDS, fx } from './fx'
import { frameName, TEXTURE_SCALE } from './layout'
import { monster } from './monster'
import { playerWeapon } from './playerWeapons'
import { PROJECTILE_KINDS, projectile } from './projectiles'
import { telegraph } from './telegraph'
import { tiles } from './tiles'

export { TEXTURE_SCALE, textureBytes }
export { MINION_ID_SUFFIX, minionArtSpec, releaseMonsters } from './monster'
export { monsterWeapon } from './monster'
export { carrier } from './carrier'
export type { MonsterWeaponRef } from './monster'
export { prewarmTelegraphs, releaseTelegraphs } from './telegraph'
export { CARD_HEIGHT, CARD_WIDTH, RARITY_COLOR, cardArt, doorArt, glowTexture, shieldFragmentArt } from './props'
export type { BossArt, PartRef } from './parts'

// Puts a sprite on the texture of `ref`, standing on its origin (bottom centre), sized in world
// units, and starts the boiling animation. Frame 0 is set first so the display size is computed
// from a single variant. The texture holds all variants side by side.
export function applySpriteRef(sprite: Phaser.GameObjects.Sprite, ref: SpriteRef): void {
  // Placeholder textures have a single frame and no variant frames.
  const texture = sprite.scene.textures.get(ref.textureKey)
  sprite.setTexture(ref.textureKey, texture.has(frameName(0)) ? frameName(0) : undefined)
  sprite.setOrigin(0.5, 1)
  sprite.setDisplaySize(ref.width, ref.height)
  sprite.play(ref.animKey)
}

// Draws the monsters ahead of time, for example behind a segment banner, so spawning them later
// costs a lookup. A monster takes about 2 to 3 ms, so a segment of 40 takes around 100 ms.
export function prewarm(scene: Phaser.Scene, specs: readonly MonsterSpec[]): void {
  for (const spec of specs) monster(scene, spec)
}

// Draws every effect and projectile texture, so the first hit or shot of a run does not draw its
// texture mid-fight. Textures that exist are only looked up, so calling it again is cheap.
export function prewarmEffects(scene: Phaser.Scene): void {
  for (const kind of FX_KINDS) fx(scene, kind)
  for (const kind of PROJECTILE_KINDS) projectile(scene, kind)
}

export function createScribbleArt(): ScribbleArt {
  return { pixelsPerUnit: TEXTURE_SCALE, monster, boss, finalBoss, playerWeapon, projectile, tiles, telegraph, fx }
}
