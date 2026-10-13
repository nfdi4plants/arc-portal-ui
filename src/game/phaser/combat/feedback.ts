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

const CREAM = cssColor(PALETTE.cream)
const YELLOW = cssColor(PALETTE.yellow)
const OUTLINE = cssColor(PALETTE.outline)

// Damage numbers and hit effects. Numbers age with the real step time (hit-stop does not freeze
// them), so they keep rising while the actors hold still. Texts and effect sprites are pooled:
// creating a Phaser Text allocates a canvas and a texture, which is too slow to do on every hit.
export function createFeedback(scene: Phaser.Scene, art: ScribbleArt) {
  const numbers: FloatingNumber[] = []
  const freeTexts: Phaser.GameObjects.Text[] = []
  const effects = new Set<Phaser.GameObjects.Sprite>()
  const freeEffects: Phaser.GameObjects.Sprite[] = []
  const effectScale = 1 / art.pixelsPerUnit

  function takeText(): Phaser.GameObjects.Text {
    const reused = freeTexts.pop()
    if (reused) return reused.setActive(true).setVisible(true)
    return scene.add
      .text(0, 0, '', { fontFamily: 'sans-serif', fontStyle: 'bold', stroke: OUTLINE })
      .setOrigin(0.5, 1)
      .setDepth(DEPTH.fx)
  }

  function spawnNumber(point: Point, damage: number, crit: boolean) {
    const text = takeText()
    // The camera zooms the text up, so it is rasterised at least at that scale.
    text.setResolution(Math.max(2, Math.ceil(scene.cameras.main.zoom)))
    text.setFontSize(crit ? 15 : 9)
    text.setColor(crit ? YELLOW : CREAM)
    text.setStroke(OUTLINE, crit ? 3 : 2)
    text.setText(String(Math.round(damage)))
    text.setPosition(point.x, point.y - 6).setAlpha(1)
    numbers.push({ text, startY: text.y, ageMs: 0 })
  }

  function releaseEffect(sprite: Phaser.GameObjects.Sprite) {
    effects.delete(sprite)
    sprite.setActive(false).setVisible(false)
    freeEffects.push(sprite)
  }

  function spawnEffect(point: Point, crit: boolean) {
    let sprite = freeEffects.pop()
    if (!sprite) {
      // The animation swaps in its own texture on the first frame.
      const created = scene.add.sprite(0, 0, '__DEFAULT').setDepth(DEPTH.fx)
      created.on(Phaser.Animations.Events.ANIMATION_COMPLETE, () => releaseEffect(created))
      sprite = created
    }
    effects.add(sprite)
    sprite.setPosition(point.x, point.y).setScale(effectScale).setActive(true).setVisible(true)
    // The animation plays once. A looping one is cut to a single pass so the sprite returns to the pool.
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
          item.text.setActive(false).setVisible(false)
          freeTexts.push(item.text)
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
      for (const text of freeTexts) text.destroy()
      freeTexts.length = 0
      for (const sprite of effects) sprite.destroy()
      effects.clear()
      for (const sprite of freeEffects) sprite.destroy()
      freeEffects.length = 0
    },
  }
}
