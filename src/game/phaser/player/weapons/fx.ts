import Phaser from 'phaser'
import type { FxArt, ScribbleArt } from '../../../contracts/art'
import { DEPTH, PALETTE } from '../../../contracts/constants'

export interface FxPool {
  // A teal line between two world points that fades out. The line wobbles a little.
  line(x1: number, y1: number, x2: number, y2: number, durationMs: number): void
  // Plays an art effect once, centred on a world point. `size` multiplies its natural size.
  burst(x: number, y: number, kind: FxArt, size?: number): void
  update(dtMs: number): void
  destroy(): void
}

const LINE_WIDTH = 2
const LINE_SEGMENTS = 4
// How far a bend of the line strays from the straight path, in world units.
const LINE_JITTER = 2.5
const LINE_ALPHA = 0.9

// Fixed rings of sprites and graphics shared by every short effect of the loadout. When all are
// busy the oldest one is reused, so a flurry of effects never creates objects.
export function createFxPool(scene: Phaser.Scene, art: ScribbleArt, burstCount = 12, lineCount = 4): FxPool {
  const unit = 1 / art.pixelsPerUnit
  const sprites = Array.from({ length: burstCount }, () => {
    const sprite = scene.add.sprite(0, 0, '__DEFAULT').setDepth(DEPTH.fx).setVisible(false)
    sprite.on(Phaser.Animations.Events.ANIMATION_COMPLETE, () => sprite.setVisible(false))
    return sprite
  })
  const lines = Array.from({ length: lineCount }, () => scene.add.graphics().setDepth(DEPTH.fx).setVisible(false))
  const left = new Float64Array(lineCount)
  const total = new Float64Array(lineCount)
  const animKeys: Partial<Record<FxArt, string>> = {}
  let nextSprite = 0
  let nextLine = 0
  // The wobble only has to look uneven. A small generator keeps it free of Math.random.
  let seed = 1

  const wobble = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return (seed / 0x100000000 - 0.5) * 2 * LINE_JITTER
  }

  return {
    line(x1, y1, x2, y2, durationMs) {
      const i = nextLine
      nextLine = (nextLine + 1) % lineCount
      left[i] = durationMs
      total[i] = durationMs
      const dx = x2 - x1
      const dy = y2 - y1
      const length = Math.hypot(dx, dy) || 1
      const nx = -dy / length
      const ny = dx / length
      const g = lines[i].clear().lineStyle(LINE_WIDTH, PALETTE.teal, 1).setAlpha(LINE_ALPHA).setVisible(true)
      let px = x1
      let py = y1
      for (let k = 1; k <= LINE_SEGMENTS; k++) {
        const t = k / LINE_SEGMENTS
        const bend = k === LINE_SEGMENTS ? 0 : wobble()
        const qx = x1 + dx * t + nx * bend
        const qy = y1 + dy * t + ny * bend
        g.lineBetween(px, py, qx, qy)
        px = qx
        py = qy
      }
    },
    burst(x, y, kind, size = 1) {
      const sprite = sprites[nextSprite]
      nextSprite = (nextSprite + 1) % burstCount
      const key = (animKeys[kind] ??= art.fx(scene, kind))
      sprite.setPosition(x, y).setScale(unit * size).setVisible(true)
      sprite.play({ key, repeat: 0 })
    },
    update(dtMs) {
      for (let i = 0; i < lineCount; i++) {
        if (left[i] <= 0) continue
        left[i] -= dtMs
        if (left[i] <= 0) lines[i].setVisible(false)
        else lines[i].setAlpha(LINE_ALPHA * (left[i] / total[i]))
      }
    },
    destroy() {
      for (const sprite of sprites) sprite.destroy()
      for (const line of lines) line.destroy()
      left.fill(0)
    },
  }
}
