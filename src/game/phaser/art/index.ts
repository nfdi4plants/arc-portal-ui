import type Phaser from 'phaser'
import type { ScribbleArt, SpriteRef } from '../../contracts/art'
import type { MonsterSpec } from '../../contracts/content'
import { textureBytes } from './atlas'
import { boss } from './bosses'
import { finalBoss } from './finalBoss'
import { fx } from './fx'
import { frameName, TEXTURE_SCALE } from './layout'
import { monster } from './monster'
import { playerWeapon } from './playerWeapons'
import { projectile } from './projectiles'
import { telegraph } from './telegraph'
import { tiles } from './tiles'

export { TEXTURE_SCALE, textureBytes }
export type { BossArt, PartRef } from './parts'

// Puts a sprite on the texture of `ref`, standing on its origin (bottom centre), sized in world
// units, and starts the boiling animation. Frame 0 is set first so the display size is computed
// from a single variant instead of the whole strip.
export function applySpriteRef(sprite: Phaser.GameObjects.Sprite, ref: SpriteRef): void {
  sprite.setTexture(ref.textureKey, frameName(0))
  sprite.setOrigin(0.5, 1)
  sprite.setDisplaySize(ref.width, ref.height)
  sprite.play(ref.animKey)
}

// Draws the monsters ahead of time, for example behind a segment banner, so spawning them later
// costs a lookup. A monster takes about 2 to 3 ms, so a segment of 40 takes around 100 ms.
export function prewarm(scene: Phaser.Scene, specs: readonly MonsterSpec[]): void {
  for (const spec of specs) monster(scene, spec)
}

export function createScribbleArt(): ScribbleArt {
  return { pixelsPerUnit: TEXTURE_SCALE, monster, boss, finalBoss, playerWeapon, projectile, tiles, telegraph, fx }
}
