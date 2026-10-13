import rough from 'roughjs'
import type { RoughCanvas } from 'roughjs/bin/canvas'
import type { Drawable, Options } from 'roughjs/bin/core'
import type { RoughGenerator } from 'roughjs/bin/generator'
import { boundsOf } from './geometry'
import type { Bounds, Pt } from './geometry'
import { seedFor } from './layout'
import type { FrameRect } from './layout'
import { OUTLINE } from './palette'

// A thin wrapper around rough.canvas. Shapes are given in world units, the context is scaled to
// canvas pixels, and every shape gets its own seed so equal shapes do not wobble alike.

export const ROUGHNESS = 1.4
export const STROKE_WIDTH = 1.2
export const HATCHURE_GAP = 2.5

export interface Look {
  // Solid paper wash under the hatching.
  tint?: string
  // Hatch colour. Without it the shape is not hatched.
  hatch?: string
  fill?: 'hachure' | 'cross-hatch' | 'zigzag' | 'dots'
  // Distance between hatch lines in world units.
  gap?: number
  // Hatch angle in degrees.
  angle?: number
  // Outline colour. 'none' draws no outline.
  line?: string
  // Outline width in world units.
  weight?: number
  // Multiplier on the roughness.
  rough?: number
}

export class Pen {
  readonly ctx: CanvasRenderingContext2D
  private readonly rc: RoughCanvas
  private shapeIndex = 0
  private seedBase = 1
  private variant = 0
  private wrapWidth = 0
  private wrapMargin = 2

  private readonly scale: number

  constructor(canvas: HTMLCanvasElement, scale: number) {
    this.scale = scale
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas 2D is not available')
    this.ctx = ctx
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    this.rc = rough.canvas(canvas)
  }

  // Starts a frame. Shapes drawn until end() are clipped to the frame and measured in world units
  // from its top left corner. Equal seedBase and variant give equal jitter.
  begin(frame: FrameRect, seedBase: number, variant: number, wrapWidth = 0): void {
    const { ctx } = this
    ctx.save()
    ctx.beginPath()
    ctx.rect(frame.x, frame.y, frame.w, frame.h)
    ctx.clip()
    ctx.setTransform(this.scale, 0, 0, this.scale, frame.x, frame.y)
    this.seedBase = seedBase
    this.variant = variant
    this.shapeIndex = 0
    this.wrapWidth = wrapWidth
  }

  end(): void {
    this.ctx.restore()
  }

  // Draws with a local origin and rotation. Tile wrapping does not apply inside.
  at(x: number, y: number, angle: number, draw: () => void): void {
    const { ctx } = this
    const saved = this.wrapWidth
    this.wrapWidth = 0
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(angle)
    draw()
    ctx.restore()
    this.wrapWidth = saved
  }

  // Draws mirrored around the vertical line x = axisX.
  mirrored(axisX: number, draw: () => void): void {
    const { ctx } = this
    ctx.save()
    ctx.translate(axisX * 2, 0)
    ctx.scale(-1, 1)
    draw()
    ctx.restore()
  }

  poly(points: readonly Pt[], look: Look = {}): void {
    this.emit(boundsOf(points), look, (gen, o) => gen.polygon(points as Pt[], o), true)
  }

  rect(x: number, y: number, w: number, h: number, look: Look = {}): void {
    this.poly(
      [
        [x, y],
        [x + w, y],
        [x + w, y + h],
        [x, y + h],
      ],
      look,
    )
  }

  ellipse(cx: number, cy: number, w: number, h: number, look: Look = {}): void {
    this.emit({ minX: cx - w / 2, minY: cy - h / 2, maxX: cx + w / 2, maxY: cy + h / 2 }, look, (gen, o) => gen.ellipse(cx, cy, w, h, o), true)
  }

  arc(cx: number, cy: number, w: number, h: number, start: number, stop: number, closed: boolean, look: Look = {}): void {
    this.emit({ minX: cx - w / 2, minY: cy - h / 2, maxX: cx + w / 2, maxY: cy + h / 2 }, look, (gen, o) => gen.arc(cx, cy, w, h, start, stop, closed, o), closed)
  }

  line(x1: number, y1: number, x2: number, y2: number, look: Look = {}): void {
    this.emit({ minX: Math.min(x1, x2), minY: Math.min(y1, y2), maxX: Math.max(x1, x2), maxY: Math.max(y1, y2) }, look, (gen, o) => gen.line(x1, y1, x2, y2, o), false)
  }

  // An open polyline.
  trace(points: readonly Pt[], look: Look = {}): void {
    this.emit(boundsOf(points), look, (gen, o) => gen.linearPath(points as Pt[], o), false)
  }

  // An open smooth curve through the points. With a tint or hatch it also fills the region the
  // curve encloses, so repeat the first point at the end for a closed blob.
  curve(points: readonly Pt[], look: Look = {}): void {
    this.emit(boundsOf(points), look, (gen, o) => gen.curve(points as Pt[], o), look.tint !== undefined || look.hatch !== undefined)
  }

  // Plain filled circle without jitter, for pupils and rivets.
  dot(cx: number, cy: number, r: number, color: string = OUTLINE): void {
    const { ctx } = this
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fill()
  }

  // Soft glow, used for the overclocked weapons and the weak point.
  glow(cx: number, cy: number, r: number, color: string): void {
    const { ctx } = this
    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
    gradient.addColorStop(0, color)
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')
    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fill()
  }

  // Lettering in a rounded font. Lines are centred on (cx, cy) and shrunk to fit maxWidth. Each
  // line is drawn twice with a small offset so the ink looks like marker.
  text(lines: readonly string[], cx: number, cy: number, size: number, maxWidth: number, angle: number, color: string = OUTLINE): void {
    const { ctx } = this
    const family = '"Varela Round", Nunito, "Arial Rounded MT Bold", "Segoe UI", "Comic Sans MS", system-ui, sans-serif'
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(angle)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = color
    ctx.strokeStyle = color
    ctx.lineWidth = size * 0.07
    let fit = size
    ctx.font = `bold ${fit}px ${family}`
    for (const line of lines) {
      const width = ctx.measureText(line).width
      if (width > maxWidth) fit = Math.min(fit, (fit * maxWidth) / width)
    }
    ctx.font = `bold ${fit}px ${family}`
    const lineHeight = fit * 1.12
    lines.forEach((line, i) => {
      const y = (i - (lines.length - 1) / 2) * lineHeight
      ctx.fillText(line, 0, y)
      ctx.strokeText(line, 0.3, y + 0.25)
    })
    ctx.restore()
  }

  private options(look: Look, size: number): Options {
    // Small parts get less jitter, otherwise an eye would be all wobble.
    const detail = Math.min(1, Math.max(0.25, size / 40))
    return {
      seed: seedFor(this.seedBase, this.variant, this.shapeIndex++),
      roughness: ROUGHNESS * (look.rough ?? 1) * detail,
      bowing: 1,
      // The outline path is generated even for line 'none', the wash needs its shape.
      stroke: look.line && look.line !== 'none' ? look.line : OUTLINE,
      strokeWidth: look.weight ?? STROKE_WIDTH,
      fill: look.hatch,
      fillStyle: look.fill ?? 'hachure',
      fillWeight: 0.6,
      hachureGap: look.gap ?? HATCHURE_GAP,
      hachureAngle: look.angle ?? -41,
      disableMultiStroke: size < 10,
      disableMultiStrokeFill: true,
    }
  }

  private emit(bounds: Bounds, look: Look, build: (gen: RoughGenerator, o: Options) => Drawable, closed: boolean): void {
    const { ctx } = this
    const size = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY)
    const drawable = build(this.rc.generator, this.options(look, size))
    const shifts = this.wrapShifts(bounds)
    for (const dx of shifts) {
      ctx.save()
      if (dx !== 0) ctx.translate(dx, 0)
      if (look.tint && closed) this.washOutline(drawable, look.tint)
      if (look.line !== 'none' || look.hatch) this.rc.draw(look.line === 'none' ? { ...drawable, sets: drawable.sets.filter((s) => s.type !== 'path') } : drawable)
      ctx.restore()
    }
  }

  // Copies of a shape that crosses a side of the tile, drawn on the opposite side so the tile
  // repeats without a seam.
  private wrapShifts(bounds: Bounds): number[] {
    const width = this.wrapWidth
    if (width <= 0) return [0]
    const shifts = [0]
    if (bounds.minX - this.wrapMargin < 0) shifts.push(width)
    if (bounds.maxX + this.wrapMargin > width) shifts.push(-width)
    return shifts
  }

  // Fills the area inside the jittered outline, so the wash and the lines agree. A polygon outline
  // is one move op per side. Each of those would start a subpath with no area, so only the first
  // move starts the path and the later ones join it with a line.
  private washOutline(drawable: Drawable, color: string): void {
    const { ctx } = this
    const outline = drawable.sets.find((set) => set.type === 'path')
    if (!outline) return
    ctx.fillStyle = color
    ctx.beginPath()
    let started = false
    for (const item of outline.ops) {
      const d = item.data
      if (item.op === 'move') {
        if (started) ctx.lineTo(d[0], d[1])
        else ctx.moveTo(d[0], d[1])
        started = true
      } else if (item.op === 'bcurveTo') ctx.bezierCurveTo(d[0], d[1], d[2], d[3], d[4], d[5])
      else ctx.lineTo(d[0], d[1])
    }
    ctx.fill()
  }
}
