import Phaser from 'phaser'
import { DEPTH } from '../../contracts/constants'

// The screen flimmer of a phantom, a monster whose annotation has no value. A few small scribbles
// rise through its hurtbox like heat haze and flicker. The sprites are made once per mob and only
// move afterwards, so a phantom costs a handful of sprite updates and no allocation per step.

const PX = 4
const COUNT = 6
const PEAK_ALPHA = 0.7
const RISE_PER_SECOND = 0.55
const FLICKER_MS = 70

interface Variant {
  key: string
  width: number
  height: number
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void
}

// Sizes are in world units. Each scribble is a light stroke over a thin dark one, so it reads on
// bright and dark backgrounds.
function wave(length: number, amplitude: number): Variant['draw'] {
  return (ctx, _w, h) => {
    ctx.moveTo(1, h / 2)
    for (let x = 1, up = true; x + 2 <= length; x += 2, up = !up) ctx.quadraticCurveTo(x + 1, h / 2 + (up ? -amplitude : amplitude), x + 2, h / 2)
  }
}

const VARIANTS: Variant[] = [
  { key: 'phantom-flimmer-long', width: 11, height: 3, draw: wave(11, 1) },
  { key: 'phantom-flimmer-short', width: 7, height: 3, draw: wave(7, 1) },
  { key: 'phantom-flimmer-tall', width: 9, height: 4, draw: wave(9, 1.6) },
]

function ensureTextures(scene: Phaser.Scene): void {
  for (const variant of VARIANTS) {
    if (scene.textures.exists(variant.key)) continue
    const w = variant.width * PX
    const h = variant.height * PX
    const texture = scene.textures.createCanvas(variant.key, w, h)
    const ctx = texture?.getContext()
    if (!texture || !ctx) continue
    ctx.scale(PX, PX)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    for (const [color, width] of [
      ['#1f2326', 1.6],
      ['#f5e6d3', 0.8],
    ] as const) {
      ctx.beginPath()
      variant.draw(ctx, variant.width, variant.height)
      ctx.strokeStyle = color
      ctx.lineWidth = width
      ctx.stroke()
    }
    texture.refresh()
  }
}

export interface Flimmer {
  // Moves the scribbles for a hurtbox centred on (x, y). `level` scales their opacity.
  update(clockMs: number, x: number, y: number, level: number): void
  setDepth(depth: number): void
  setVisible(visible: boolean): void
  destroy(): void
}

// `phase` (any number) keeps two phantoms from shimmering in step.
export function createFlimmer(scene: Phaser.Scene, width: number, height: number, phase: number): Flimmer {
  ensureTextures(scene)
  const size = Phaser.Math.Clamp(width / 24, 0.8, 1.6)
  const halfW = width / 2
  const halfH = height / 2
  const specks = Array.from({ length: COUNT }, (_, i) => {
    const variant = VARIANTS[i % VARIANTS.length]
    return scene.add
      .sprite(0, 0, variant.key)
      .setDepth(DEPTH.enemies + 1)
      .setScale(size / PX)
      .setFlipX(i % 2 === 1)
  })

  return {
    update(clockMs, x, y, level) {
      const seconds = clockMs / 1000
      const flick = Math.floor(clockMs / FLICKER_MS)
      for (let i = 0; i < COUNT; i++) {
        const lane = (i + 0.5) / COUNT
        // Each speck rises along its own lane, wobbling sideways, and fades in and out on the way.
        const rise = (seconds * RISE_PER_SECOND + i * 0.37 + phase) % 1
        const wobble = Math.sin(seconds * 5 + i * 2.1 + phase * 7) * halfW * 0.25
        const dim = (flick + i * 3) % 4 === 0 ? 0.25 : 1
        specks[i]
          .setPosition(x + (lane * 2 - 1) * halfW * 0.8 + wobble, y + halfH * (1 - 2 * rise))
          .setAlpha(Math.sin(Math.PI * rise) * PEAK_ALPHA * dim * level)
      }
    },
    setDepth(depth) {
      for (const speck of specks) speck.setDepth(depth)
    },
    setVisible(visible) {
      for (const speck of specks) speck.setVisible(visible)
    },
    destroy() {
      for (const speck of specks) speck.destroy()
    },
  }
}
