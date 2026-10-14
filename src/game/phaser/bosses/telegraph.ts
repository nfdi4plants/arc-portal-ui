import Phaser from 'phaser'
import type { ScribbleArt, TelegraphArt } from '../../contracts/art'
import { DEPTH } from '../../contracts/constants'
import { fillCrop, impactFlash, type FillCrop, type FillMode } from './fill'

export type { FillMode } from './fill'

export interface ZoneSpec {
  shape: TelegraphArt
  x: number
  y: number
  w: number
  h: number
  rotation?: number
  fill: FillMode
  // A teal spot where the attack does not hit. It is drawn with the 'safe' art whatever the shape.
  safe?: boolean
}

export interface Zone {
  // 0 to 1, the share of the wind-up that has passed. Progress is shown by cropping or scaling the
  // fill layer, nothing is redrawn.
  setProgress(progress: number): void
  // The wind-up is over and the zone hits. Shows it in full with a short flash.
  activate(): void
  release(): void
}

const ORIGIN: Record<FillMode, readonly [number, number]> = {
  radial: [0.5, 0.5],
  wide: [0.5, 0.5],
  right: [0, 0.5],
  left: [1, 0.5],
  up: [0.5, 1],
}

// The base shows the whole zone, outline included, from the first frame. The fill layer on top is
// the same image painted solid red, so the part that has filled stands out clearly from the rest.
const WARN = { base: 0.45, fill: 0.8 }
const LIVE = { base: 0.6, fill: 0.95 }
const FILL_TINT = 0xd8343a
const FLASH_TINT = 0xffffff
// How much the base grows at the impact flash.
const FLASH_POP = 0.08
// Safe spots breathe between these alphas, about once a second, so they stand out from the danger.
const SAFE_ALPHA = { min: 0.65, max: 0.95 }
const SAFE_PULSE_MS = 160

interface Slot extends Zone {
  base: Phaser.GameObjects.Image
  fillImage: Phaser.GameObjects.Image
  mode: FillMode
  safe: boolean
  used: boolean
  scaleX: number
  scaleY: number
  // Scene time of the impact, or -1 when no flash runs.
  flashAt: number
}

const crop: FillCrop = { x: 0, y: 0, w: 0, h: 0, scale: 1 }

export interface TelegraphPool {
  show(spec: ZoneSpec): Zone
  // Pulses the safe spots and plays the impact flashes. Call once per rendered frame with the scene time.
  update(now: number): void
  destroy(): void
}

// Danger zones and safe spots share a pool of image pairs: a dim image of the whole zone and a
// solid red copy on top that fills up over the telegraph time and is full when the attack hits.
export function createTelegraphPool(scene: Phaser.Scene, art: ScribbleArt): TelegraphPool {
  const slots: Slot[] = []
  const free: Slot[] = []

  function create(): Slot {
    const base = scene.add.image(0, 0, '__DEFAULT').setVisible(false)
    const fillImage = scene.add.image(0, 0, '__DEFAULT').setVisible(false)
    const slot: Slot = {
      base,
      fillImage,
      mode: 'right',
      safe: false,
      used: false,
      scaleX: 1,
      scaleY: 1,
      flashAt: -1,
      setProgress(progress) {
        if (slot.safe) return
        const image = slot.fillImage
        const frame = image.frame
        fillCrop(slot.mode, progress, frame.realWidth, frame.realHeight, crop)
        if (slot.mode === 'radial') image.setScale(slot.scaleX * crop.scale, slot.scaleY * crop.scale)
        else image.setCrop(crop.x, crop.y, crop.w, crop.h)
      },
      activate() {
        if (slot.safe) return
        slot.base.setAlpha(LIVE.base)
        slot.fillImage.setAlpha(LIVE.fill).setTint(FLASH_TINT)
        slot.setProgress(1)
        slot.flashAt = scene.time.now
      },
      release() {
        if (!slot.used) return
        slot.used = false
        slot.flashAt = -1
        slot.base.setVisible(false)
        slot.fillImage.setVisible(false)
        free.push(slot)
      },
    }
    slots.push(slot)
    return slot
  }

  return {
    show(spec) {
      const slot = free.pop() ?? create()
      // The art snaps the size to a few cached textures. The images are stretched to the zone below.
      const texture = art.telegraph(scene, spec.safe ? 'safe' : spec.shape, spec.w, spec.h)
      const [ox, oy] = ORIGIN[spec.fill]
      const depth = spec.safe ? DEPTH.telegraphs + 1 : DEPTH.telegraphs
      slot.used = true
      slot.mode = spec.fill
      slot.safe = !!spec.safe
      slot.flashAt = -1
      for (const image of [slot.base, slot.fillImage]) {
        image
          .setTexture(texture)
          .setOrigin(ox, oy)
          .setPosition(spec.x, spec.y)
          .setRotation(spec.rotation ?? 0)
          .setDisplaySize(spec.w, spec.h)
          .setDepth(depth)
          .setCrop()
      }
      slot.scaleX = slot.base.scaleX
      slot.scaleY = slot.base.scaleY
      slot.base.setAlpha(slot.safe ? SAFE_ALPHA.max : WARN.base).setVisible(true)
      slot.fillImage.setAlpha(WARN.fill).setTint(FILL_TINT).setTintMode(Phaser.TintModes.FILL).setVisible(!slot.safe)
      if (!slot.safe) slot.setProgress(0)
      return slot
    },
    update(now) {
      const k = 0.5 + 0.5 * Math.sin(now / SAFE_PULSE_MS)
      const alpha = SAFE_ALPHA.min + (SAFE_ALPHA.max - SAFE_ALPHA.min) * k
      for (const slot of slots) {
        if (!slot.used) continue
        if (slot.safe) {
          slot.base.setAlpha(alpha)
          continue
        }
        if (slot.flashAt < 0) continue
        // The zone pops and flashes white at the impact, then settles in solid red.
        const flash = impactFlash(now - slot.flashAt)
        slot.base.setScale(slot.scaleX * (1 + FLASH_POP * flash), slot.scaleY * (1 + FLASH_POP * flash))
        if (flash > 0) continue
        slot.flashAt = -1
        slot.fillImage.setTint(FILL_TINT)
      }
    },
    destroy() {
      for (const slot of slots) {
        slot.base.destroy()
        slot.fillImage.destroy()
      }
      slots.length = 0
      free.length = 0
    },
  }
}

export interface TextPool {
  acquire(): Phaser.GameObjects.Text
  release(text: Phaser.GameObjects.Text): void
  destroy(): void
}

// A few reusable texts. Creating a Phaser Text allocates a canvas, so this never makes more than
// the number held at once.
export function createTextPool(scene: Phaser.Scene, style: Phaser.Types.GameObjects.Text.TextStyle): TextPool {
  const all: Phaser.GameObjects.Text[] = []
  const free: Phaser.GameObjects.Text[] = []
  return {
    acquire() {
      const text = free.pop() ?? scene.add.text(0, 0, '', style).setOrigin(0.5, 1).setDepth(DEPTH.telegraphs + 2)
      if (!all.includes(text)) all.push(text)
      // The camera zooms the text up, so it is rasterised at least at that scale.
      return text.setResolution(Math.max(2, Math.ceil(scene.cameras.main.zoom))).setActive(true).setVisible(true)
    },
    release(text) {
      text.setActive(false).setVisible(false)
      free.push(text)
    },
    destroy() {
      for (const text of all) text.destroy()
      all.length = 0
      free.length = 0
    },
  }
}
