import type Phaser from 'phaser'
import { DEPTH } from '../../../contracts/constants'

const PIXEL = 'loadout:pixel'
const DISC = 'loadout:disc'

// Plain white shapes, drawn once per game. They are tinted and resized per use, so they look the
// same under any ScribbleArt.
function ensureTextures(scene: Phaser.Scene): void {
  if (!scene.textures.exists(PIXEL)) {
    const g = scene.make.graphics({ x: 0, y: 0 }, false)
    g.fillStyle(0xffffff, 1)
    g.fillRect(0, 0, 2, 2)
    g.generateTexture(PIXEL, 2, 2)
    g.destroy()
  }
  if (!scene.textures.exists(DISC)) {
    const g = scene.make.graphics({ x: 0, y: 0 }, false)
    g.fillStyle(0xffffff, 1)
    g.fillCircle(16, 16, 16)
    g.generateTexture(DISC, 32, 32)
    g.destroy()
  }
}

export interface FxPool {
  // A fading line between two world points.
  line(x1: number, y1: number, x2: number, y2: number, color: number, durationMs: number): void
  // A disc whose diameter grows from 0.8 to 2 times `radius` while it fades.
  burst(x: number, y: number, radius: number, color: number, durationMs: number): void
  update(dtMs: number): void
  destroy(): void
}

const LINE_WIDTH = 2

// A fixed ring of images shared by every short effect of the loadout. When all are busy the oldest
// one is reused, so a flurry of effects never creates objects.
export function createFxPool(scene: Phaser.Scene, size = 12): FxPool {
  ensureTextures(scene)
  const images = Array.from({ length: size }, () => scene.add.image(0, 0, PIXEL).setDepth(DEPTH.fx).setVisible(false))
  const left = new Float64Array(size)
  const total = new Float64Array(size)
  const reach = new Float64Array(size)
  const burst = new Uint8Array(size)
  let next = 0

  const take = (texture: string, durationMs: number, isBurst: boolean) => {
    const i = next
    next = (next + 1) % size
    left[i] = durationMs
    total[i] = durationMs
    burst[i] = isBurst ? 1 : 0
    images[i].setTexture(texture).setVisible(true)
    return i
  }

  return {
    line(x1, y1, x2, y2, color, durationMs) {
      const i = take(PIXEL, durationMs, false)
      images[i]
        .setPosition((x1 + x2) / 2, (y1 + y2) / 2)
        .setRotation(Math.atan2(y2 - y1, x2 - x1))
        .setDisplaySize(Math.hypot(x2 - x1, y2 - y1), LINE_WIDTH)
        .setTint(color)
        .setAlpha(0.9)
    },
    burst(x, y, radius, color, durationMs) {
      const i = take(DISC, durationMs, true)
      reach[i] = radius
      images[i].setPosition(x, y).setRotation(0).setDisplaySize(radius * 0.8, radius * 0.8).setTint(color).setAlpha(0.7)
    },
    update(dtMs) {
      for (let i = 0; i < size; i++) {
        if (left[i] <= 0) continue
        left[i] -= dtMs
        if (left[i] <= 0) {
          images[i].setVisible(false)
          continue
        }
        const remaining = left[i] / total[i]
        if (burst[i]) {
          const diameter = reach[i] * (2 - remaining * 1.2)
          images[i].setDisplaySize(diameter, diameter).setAlpha(0.7 * remaining)
        } else {
          images[i].setAlpha(0.9 * remaining)
        }
      }
    },
    destroy() {
      for (const image of images) image.destroy()
      left.fill(0)
    },
  }
}
