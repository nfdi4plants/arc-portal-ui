import type Phaser from 'phaser'
import { DEPTH } from '../../contracts/constants'

// Plain sprites that the combat world moves itself. Arcade bodies are not needed for a shape that
// only has to overlap hurtboxes, and a pool avoids allocating game objects per shot.
// `scale` maps texture pixels to world units (1 / ScribbleArt.pixelsPerUnit).
export function createProjectilePool(scene: Phaser.Scene, scale: number) {
  const free: Phaser.GameObjects.Sprite[] = []
  const all = new Set<Phaser.GameObjects.Sprite>()

  return {
    acquire(textureKey: string, animKey: string | null, x: number, y: number): Phaser.GameObjects.Sprite {
      let sprite = free.pop()
      if (!sprite) {
        sprite = scene.add.sprite(x, y, textureKey).setDepth(DEPTH.projectiles)
        all.add(sprite)
      }
      sprite.stop()
      sprite.setTexture(textureKey)
      sprite.setPosition(x, y).setScale(scale).setRotation(0).setFlipX(false).setActive(true).setVisible(true)
      if (animKey && scene.anims.exists(animKey)) sprite.play(animKey)
      return sprite
    },
    release(sprite: Phaser.GameObjects.Sprite) {
      sprite.stop()
      sprite.setActive(false).setVisible(false)
      free.push(sprite)
    },
    destroy() {
      for (const sprite of all) sprite.destroy()
      all.clear()
      free.length = 0
    },
  }
}
