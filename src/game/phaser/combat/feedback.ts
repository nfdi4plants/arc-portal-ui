import Phaser from 'phaser'
import type { ScribbleArt } from '../../contracts/art'
import { DEPTH, PALETTE } from '../../contracts/constants'
import { cssColor } from '../color'
import type { Point } from './geometry'

const NUMBER_MS = 600
const NUMBER_RISE = 22

interface FloatingNumber {
  text: Phaser.GameObjects.Text
  crit: boolean
  startY: number
  ageMs: number
}

const OUTLINE = cssColor(PALETTE.outline)
const NORMAL_LOOK = { fontSize: '9px', color: cssColor(PALETTE.cream), strokeThickness: 2 }
const CRIT_LOOK = { fontSize: '15px', color: cssColor(PALETTE.yellow), strokeThickness: 3 }

// The camera zooms the text up, so it is rasterised at least at that scale.
function resolutionFor(zoom: number): number {
  return Math.max(2, Math.ceil(zoom))
}

// Damage numbers and hit effects. Numbers age with the real step time (hit-stop does not freeze
// them), so they keep rising while the actors hold still. Texts and effect sprites are pooled:
// creating a Phaser Text allocates a canvas and a texture, which is too slow to do on every hit.
// Normal and crit numbers have separate pools, so a reused Text keeps its style and a hit only
// sets its string, position and alpha. Every style or resolution change would render the Text again.
export function createFeedback(scene: Phaser.Scene, art: ScribbleArt) {
  const numbers: FloatingNumber[] = []
  const freeNormal: Phaser.GameObjects.Text[] = []
  const freeCrit: Phaser.GameObjects.Text[] = []
  // The camera zoom that the texts were rasterised for.
  let zoom = scene.cameras.main.zoom
  const effects = new Set<Phaser.GameObjects.Sprite>()
  const freeEffects: Phaser.GameObjects.Sprite[] = []
  const effectScale = 1 / art.pixelsPerUnit

  function syncResolution() {
    const current = scene.cameras.main.zoom
    if (current === zoom) return
    zoom = current
    const resolution = resolutionFor(zoom)
    const retune = (text: Phaser.GameObjects.Text) => {
      if (text.style.resolution !== resolution) text.setResolution(resolution)
    }
    for (const item of numbers) retune(item.text)
    for (const text of freeNormal) retune(text)
    for (const text of freeCrit) retune(text)
  }

  function takeText(crit: boolean): Phaser.GameObjects.Text {
    const reused = (crit ? freeCrit : freeNormal).pop()
    if (reused) return reused.setActive(true).setVisible(true)
    return scene.add
      .text(0, 0, '', {
        fontFamily: 'sans-serif',
        fontStyle: 'bold',
        stroke: OUTLINE,
        resolution: resolutionFor(zoom),
        ...(crit ? CRIT_LOOK : NORMAL_LOOK),
      })
      .setOrigin(0.5, 1)
      .setDepth(DEPTH.fx)
  }

  function spawnNumber(point: Point, damage: number, crit: boolean) {
    syncResolution()
    const text = takeText(crit)
    text.setText(String(Math.round(damage)))
    text.setPosition(point.x, point.y - 6).setAlpha(1)
    numbers.push({ text, crit, startY: text.y, ageMs: 0 })
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
          const free = item.crit ? freeCrit : freeNormal
          free.push(item.text)
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
      for (const text of freeNormal) text.destroy()
      freeNormal.length = 0
      for (const text of freeCrit) text.destroy()
      freeCrit.length = 0
      for (const sprite of effects) sprite.destroy()
      effects.clear()
      for (const sprite of freeEffects) sprite.destroy()
      freeEffects.length = 0
    },
  }
}
