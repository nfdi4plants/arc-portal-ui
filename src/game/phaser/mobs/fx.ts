import Phaser from 'phaser'
import type { FxArt, ScribbleArt } from '../../contracts/art'
import { DEPTH } from '../../contracts/constants'

// One-shot effect sprites, pooled per scene. A death or an explosion reuses a sprite that an
// earlier effect has finished with.

const pools = new WeakMap<Phaser.Scene, Phaser.GameObjects.Sprite[]>()

function poolOf(scene: Phaser.Scene): Phaser.GameObjects.Sprite[] {
  let free = pools.get(scene)
  if (!free) {
    free = []
    pools.set(scene, free)
    // A restarted scene keeps its Scene object but loses its sprites.
    scene.events.once('shutdown', () => pools.delete(scene))
  }
  return free
}

// Plays `kind` centred on (x, y) and scales it to `size` world units wide, at `alpha` opacity. The animation key
// belongs to the art, whose textures are drawn `pixelsPerUnit` times larger than their world size.
export function playFx(scene: Phaser.Scene, art: ScribbleArt, kind: FxArt, x: number, y: number, size: number, alpha = 1): void {
  const free = poolOf(scene)
  let sprite = free.pop()
  if (!sprite) {
    const created = scene.add.sprite(x, y, '__DEFAULT').setDepth(DEPTH.fx)
    created.on(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      created.setActive(false).setVisible(false)
      pools.get(scene)?.push(created)
    })
    sprite = created
  }
  sprite.setPosition(x, y).setActive(true).setVisible(true).setAlpha(alpha)
  // Playing swaps in the animation's texture, so the width read afterwards is the frame's.
  sprite.play({ key: art.fx(scene, kind), repeat: 0 })
  sprite.setScale(size / sprite.width)
}
