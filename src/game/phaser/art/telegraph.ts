import type Phaser from 'phaser'
import type { TelegraphArt } from '../../contracts/art'
import { animKeyOf, spriteFrom } from './atlas'
import { conePts, telegraphSize } from './geometry'
import { TEXTURE_SCALE, telegraphKey } from './layout'
import type { Look, Pen } from './pen'

// Hatched red (#e5484d) danger zones and teal (#22c3a6) safe spots. One still frame, the boss scene
// scales it and fills it over the telegraph time. Each zone has a solid wash, a bold hatch and a
// solid outline, so even a thin strip along the floor reads as an area and not as a dashed line.
// The safe spots hatch the other way, so the two never look alike where they overlap.
//
// Sizes snap up to powers of two (16 to 1024), so a fight draws a handful of textures and the
// prewarm below can cover the usual ones. The hatch is a tiny tile that fills the shape as a canvas
// pattern, so a wide zone needs one fill and a few outline strokes.

const KEY_PREFIX = 'scribble:telegraph:'

interface HatchLook {
  // Distance between the lines in world units.
  gap: number
  crossed: boolean
  color: string
  // Line width in world units.
  width: number
  // Lines fall to the right instead of rising.
  flip?: boolean
}

const EDGE: Look = { tint: 'rgba(229, 72, 77, 0.38)', line: '#a3262b', weight: 1.8 }
const ZONE_HATCH: HatchLook = { gap: 3.2, crossed: false, color: 'rgba(196, 44, 50, 0.85)', width: 1 }
const BEAM_HATCH: HatchLook = { gap: 2.6, crossed: true, color: 'rgba(196, 44, 50, 0.85)', width: 0.8 }
const SAFE_EDGE: Look = { tint: 'rgba(34, 195, 166, 0.34)', line: '#127a68', weight: 1.8, rough: 0.6 }
const SAFE_HATCH: HatchLook = { gap: 4, crossed: false, color: 'rgba(75, 174, 214, 0.75)', width: 1, flip: true }

const tiles = new Map<string, HTMLCanvasElement>()

// A square of 45 degree lines that repeats without a seam, so its side is a whole number of
// pixels. That rounds the gap a little (3 becomes 2.8 world units).
function hatchTile({ gap, crossed, color, width, flip }: HatchLook): HTMLCanvasElement {
  const side = Math.max(2, Math.round(gap * Math.SQRT2 * TEXTURE_SCALE))
  const id = `${side}:${crossed}:${color}:${width}:${!!flip}`
  const hit = tiles.get(id)
  if (hit) return hit
  const tile = document.createElement('canvas')
  tile.width = side
  tile.height = side
  const ctx = tile.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D is not available')
  ctx.strokeStyle = color
  ctx.lineWidth = width * TEXTURE_SCALE
  if (flip) {
    ctx.translate(side, 0)
    ctx.scale(-1, 1)
  }
  ctx.beginPath()
  // Each line runs past the tile, so the corners are covered like the rest.
  for (let k = -1; k <= 1; k++) {
    ctx.moveTo(k * side - side, -side)
    ctx.lineTo(k * side + 2 * side, 2 * side)
    if (crossed) {
      ctx.moveTo((k + 1) * side + side, -side)
      ctx.lineTo((k + 1) * side - 2 * side, 2 * side)
    }
  }
  ctx.stroke()
  tiles.set(id, tile)
  return tile
}

// Fills the path with the hatch. The pattern transform undoes the pen's scale, so every tile pixel
// lands on one texture pixel.
function hatch(pen: Pen, look: HatchLook, trace: (ctx: CanvasRenderingContext2D) => void): void {
  const { ctx } = pen
  const pattern = ctx.createPattern(hatchTile(look), 'repeat')
  if (!pattern) return
  pattern.setTransform(ctx.getTransform().inverse())
  ctx.fillStyle = pattern
  ctx.beginPath()
  trace(ctx)
  ctx.fill()
}

export function telegraph(scene: Phaser.Scene, shape: TelegraphArt, width: number, height: number): string {
  const w = telegraphSize(width)
  const h = telegraphSize(height)
  const key = telegraphKey(shape, w, h)
  spriteFrom(scene, {
    key,
    width: w,
    height: h,
    variants: 1,
    anchors: { weapon: { x: 0, y: -h / 2 }, head: { x: 0, y: -h } },
    draw(pen) {
      // The hatch goes first, so the outline lies on top of it.
      if (shape === 'safe') {
        hatch(pen, SAFE_HATCH, (ctx) => ctx.rect(1.5, 1.5, w - 3, h - 3))
        pen.rect(1.5, 1.5, w - 3, h - 3, SAFE_EDGE)
      } else if (shape === 'circle') {
        hatch(pen, ZONE_HATCH, (ctx) => ctx.ellipse(w / 2, h / 2, (w - 2) / 2, (h - 2) / 2, 0, 0, Math.PI * 2))
        pen.ellipse(w / 2, h / 2, w - 2, h - 2, EDGE)
      } else if (shape === 'cone') {
        const points = conePts(w, h)
        hatch(pen, ZONE_HATCH, (ctx) => {
          ctx.moveTo(points[0][0], points[0][1])
          for (const [x, y] of points.slice(1)) ctx.lineTo(x, y)
        })
        pen.poly(points, EDGE)
      } else {
        hatch(pen, shape === 'line' ? BEAM_HATCH : ZONE_HATCH, (ctx) => ctx.rect(1, 1, w - 2, h - 2))
        pen.rect(1, 1, w - 2, h - 2, EDGE)
      }
    },
  })
  return key
}

// The zones the usual boss attacks show, drawn ahead of a fight. These are the sizes that the
// attacks in bosses/attacks.ts snap to.
const COMMON: readonly (readonly [TelegraphArt, number, number])[] = [
  ['rect', 1024, 64],
  ['rect', 512, 64],
  ['rect', 256, 64],
  ['rect', 256, 32],
  ['rect', 128, 32],
  ['rect', 64, 64],
  ['rect', 64, 128],
  ['rect', 512, 16],
  ['rect', 128, 16],
  ['rect', 64, 16],
  ['rect', 32, 64],
  ['rect', 32, 128],
  ['circle', 128, 128],
  ['cone', 256, 128],
  ['line', 512, 16],
  ['line', 256, 16],
  ['line', 128, 16],
  ['line', 1024, 16],
  ['rect', 128, 64],
  ['safe', 1024, 32],
  ['safe', 128, 32],
  ['safe', 128, 64],
  ['safe', 64, 32],
  ['safe', 64, 64],
]

export function prewarmTelegraphs(scene: Phaser.Scene): void {
  for (const [shape, w, h] of COMMON) telegraph(scene, shape, w, h)
}

// A zone texture takes up to a few MB, so a boss scene drops them when it ends. The animation goes
// first because removing it stops any sprite still playing it.
export function releaseTelegraphs(scene: Phaser.Scene): void {
  for (const key of scene.textures.getTextureKeys()) {
    if (!key.startsWith(KEY_PREFIX)) continue
    scene.anims.remove(animKeyOf(key))
    scene.textures.remove(key)
  }
}
