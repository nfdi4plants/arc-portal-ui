import type Phaser from 'phaser'
import { DEPTH, PALETTE } from '../../contracts/constants'
import { cssColor } from '../color'

// Speech bubble texts for chatter mobs. Creating a Text allocates a canvas, so awake chatter mobs
// borrow one from a small per-scene pool and give it back when they sleep or die.

const pools = new WeakMap<Phaser.Scene, Phaser.GameObjects.Text[]>()

function poolOf(scene: Phaser.Scene): Phaser.GameObjects.Text[] {
  let free = pools.get(scene)
  if (!free) {
    free = []
    pools.set(scene, free)
    scene.events.once('shutdown', () => pools.delete(scene))
  }
  return free
}

export function acquireBubble(scene: Phaser.Scene): Phaser.GameObjects.Text {
  const reused = poolOf(scene).pop()
  if (reused) return reused.setActive(true)
  const text = scene.add
    .text(0, 0, '', {
      fontFamily: 'sans-serif',
      fontSize: '8px',
      color: cssColor(PALETTE.outline),
      backgroundColor: cssColor(PALETTE.cream),
      padding: { x: 3, y: 2 },
    })
    .setOrigin(0.5, 1)
    .setDepth(DEPTH.fx)
    .setVisible(false)
  // The camera zooms the text up, so it is rasterised at least at that scale.
  text.setResolution(Math.max(2, Math.ceil(scene.cameras.main.zoom)))
  return text
}

export function releaseBubble(scene: Phaser.Scene, text: Phaser.GameObjects.Text): void {
  text.setActive(false).setVisible(false)
  pools.get(scene)?.push(text)
}
