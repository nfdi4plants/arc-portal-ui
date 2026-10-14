import type Phaser from 'phaser'
import type { ScribbleArt, TelegraphArt } from '../../contracts/art'
import { DEPTH } from '../../contracts/constants'

// How a zone fills while the wind-up runs. The anchor (x, y) of a ZoneSpec depends on it:
//   radial  centre, grows in both directions
//   wide    centre, grows left and right
//   right   left edge, grows to the right (turned by `rotation`, so it also draws diagonal lines)
//   left    right edge, grows to the left
//   up      bottom centre, grows upward
export type FillMode = 'radial' | 'wide' | 'right' | 'left' | 'up'

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
  // 0 to 1. Progress is shown by cropping or scaling the zone image, nothing is redrawn.
  setProgress(progress: number): void
  // The wind-up is over and the zone hits. Shows it in full.
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

const WARN = { base: 0.4, fill: 0.75 }
const LIVE = { base: 0.6, fill: 0.95 }
// Safe spots breathe between these alphas, about once a second, so they stand out from the danger.
const SAFE_ALPHA = { min: 0.65, max: 0.95 }
const SAFE_PULSE_MS = 160
const MIN_PROGRESS = 0.001

interface Slot extends Zone {
  base: Phaser.GameObjects.Image
  fillImage: Phaser.GameObjects.Image
  mode: FillMode
  safe: boolean
  used: boolean
}

export interface TelegraphPool {
  show(spec: ZoneSpec): Zone
  // Pulses the safe spots. Call once per rendered frame with the scene time.
  update(now: number): void
  destroy(): void
}

// Danger zones and safe spots share a pool of image pairs: a dim image of the whole zone and a
// bright copy on top that grows over the telegraph time.
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
      setProgress(progress) {
        if (slot.safe) return
        const k = Math.min(1, Math.max(MIN_PROGRESS, progress))
        const image = slot.fillImage
        if (slot.mode === 'radial') {
          image.setScale(slot.base.scaleX * k, slot.base.scaleY * k)
          return
        }
        const frame = image.frame
        const w = frame.realWidth
        const h = frame.realHeight
        if (slot.mode === 'right') image.setCrop(0, 0, w * k, h)
        else if (slot.mode === 'left') image.setCrop(w * (1 - k), 0, w * k, h)
        else if (slot.mode === 'wide') image.setCrop((w * (1 - k)) / 2, 0, w * k, h)
        else image.setCrop(0, h * (1 - k), w, h * k)
      },
      activate() {
        if (slot.safe) return
        slot.base.setAlpha(LIVE.base)
        slot.fillImage.setAlpha(LIVE.fill)
        slot.setProgress(1)
      },
      release() {
        if (!slot.used) return
        slot.used = false
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
      slot.base.setAlpha(slot.safe ? SAFE_ALPHA.max : WARN.base).setVisible(true)
      slot.fillImage.setAlpha(WARN.fill).setVisible(!slot.safe)
      if (!slot.safe) slot.setProgress(0)
      return slot
    },
    update(now) {
      const k = 0.5 + 0.5 * Math.sin(now / SAFE_PULSE_MS)
      const alpha = SAFE_ALPHA.min + (SAFE_ALPHA.max - SAFE_ALPHA.min) * k
      for (const slot of slots) if (slot.used && slot.safe) slot.base.setAlpha(alpha)
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
