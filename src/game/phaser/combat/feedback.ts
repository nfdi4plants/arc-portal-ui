import Phaser from 'phaser'
import type { ScribbleArt } from '../../contracts/art'
import { DEPTH, PALETTE } from '../../contracts/constants'
import type { Point } from './geometry'

const NUMBER_MS = 600
const NUMBER_RISE = 22

interface FloatingNumber {
  text: Phaser.GameObjects.Text
  startY: number
  ageMs: number
}

function cssColor(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`
}

// Damage numbers and hit effects. Numbers age with the real step time (hit-stop does not freeze
// them), so they keep rising while the actors hold still.
export function createFeedback(scene: Phaser.Scene, art: ScribbleArt) {
  const numbers: FloatingNumber[] = []
  const effects = new Set<Phaser.GameObjects.Sprite>()

  function spawnNumber(point: Point, damage: number, crit: boolean) {
    const text = scene.add.text(point.x, point.y - 6, String(Math.round(damage)), {
      fontFamily: 'sans-serif',
      fontStyle: 'bold',
      fontSize: crit ? '15px' : '9px',
      color: cssColor(crit ? PALETTE.yellow : PALETTE.cream),
      stroke: cssColor(PALETTE.outline),
      strokeThickness: crit ? 3 : 2,
    })
    // The camera zooms the text up, so it is rasterised at least at that scale.
    text.setResolution(Math.max(2, Math.ceil(scene.cameras.main.zoom)))
    text.setOrigin(0.5, 1).setDepth(DEPTH.fx)
    numbers.push({ text, startY: text.y, ageMs: 0 })
  }

  function spawnEffect(point: Point, crit: boolean) {
    // The animation swaps in its own texture on the first frame.
    const sprite = scene.add.sprite(point.x, point.y, '__DEFAULT').setDepth(DEPTH.fx)
    effects.add(sprite)
    sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      effects.delete(sprite)
      sprite.destroy()
    })
    // The animation plays once. A looping one is cut to a single pass so the sprite cannot leak.
    sprite.play({ key: art.fx(scene, crit ? 'crit' : 'hit'), repeat: 0 })
  }

  return {
    hit(point: Point, damage: number, crit: boolean) {
      spawnNumber(point, damage, crit)
      spawnEffect(point, crit)
    },
    update(deltaMs: number) {
      let kept = 0
      for (const item of numbers) {
        item.ageMs += deltaMs
        const t = item.ageMs / NUMBER_MS
        if (t >= 1) {
          item.text.destroy()
          continue
        }
        item.text.setY(item.startY - NUMBER_RISE * (1 - (1 - t) * (1 - t)))
        item.text.setAlpha(1 - t * t)
        numbers[kept++] = item
      }
      numbers.length = kept
    },
    destroy() {
      for (const item of numbers) item.text.destroy()
      numbers.length = 0
      for (const sprite of effects) sprite.destroy()
      effects.clear()
    },
  }
}
