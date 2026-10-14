import type Phaser from 'phaser'
import type { SpriteRef } from '../../contracts/art'
import { PALETTE } from '../../contracts/constants'
import { spriteFrom } from './atlas'
import { cssColor } from './palette'

// The little cloud that fishes the mage out of a pit and lowers it back onto the level. A rope
// hangs from it, and the hook at the rope's end is the sprite origin (bottom centre), so the scene
// puts the origin on top of the mage's head.

const W = 42
const H = 42
const sky = { tint: '#f4fbff', hatch: cssColor(PALETTE.blue), gap: 3.4 }

export function carrier(scene: Phaser.Scene): SpriteRef {
  return spriteFrom(scene, {
    key: 'scribble:carrier',
    width: W,
    height: H,
    anchors: { weapon: { x: 0, y: 0 }, head: { x: 0, y: -H } },
    draw(pen) {
      const x = W / 2
      pen.ellipse(x - 10, 15, 17, 14, sky)
      pen.ellipse(x + 10, 15, 17, 14, sky)
      pen.ellipse(x, 11, 22, 18, sky)
      pen.ellipse(x, 18, 34, 10, { ...sky, weight: 0.9 })
      pen.dot(x - 4, 12, 1.3)
      pen.dot(x + 4, 12, 1.3)
      pen.curve([[x - 3, 16], [x, 18], [x + 3, 16]], { weight: 0.8, rough: 0.2 })
      pen.line(x, 22, x, H - 6, { weight: 1, rough: 0.4 })
      pen.arc(x + 2, H - 5, 5, 6, 0, Math.PI, false, { weight: 1.3, rough: 0.3 })
    },
  })
}
