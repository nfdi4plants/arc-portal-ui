import type Phaser from 'phaser'
import type { FxArt } from '../../contracts/art'
import { PALETTE } from '../../contracts/constants'
import { spriteFrom } from './atlas'
import { starPts } from './geometry'
import { cssColor } from './palette'
import type { Pen } from './pen'

// One-shot effects. Every frame is its own drawing, the animation plays them once.

interface FxDef {
  width: number
  height: number
  frames: number
  fps: number
  // t runs from 0 on the first frame to 1 on the last.
  draw(pen: Pen, t: number): void
}

const burst = { tint: '#fff6cf', hatch: '#f5be00', gap: 2 }
const gold = { tint: '#ffe27a', hatch: '#f5a800', gap: 2 }
const smoke = { tint: '#efe9f2', hatch: '#bdb2c9', gap: 2.2 }
const sparkle = { tint: '#c9f4ea', hatch: cssColor(PALETTE.teal), gap: 1.6 }

function fade(pen: Pen, alpha: number): void {
  pen.ctx.globalAlpha = Math.max(0, Math.min(1, alpha))
}

const DEFS: Record<FxArt, FxDef> = {
  hit: {
    width: 28,
    height: 28,
    frames: 5,
    fps: 18,
    draw(pen, t) {
      fade(pen, 1 - t * 0.55)
      const r0 = 3 + t * 5
      const r1 = 7 + t * 7
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2 + 0.3
        pen.line(14 + Math.cos(a) * r0, 14 + Math.sin(a) * r0, 14 + Math.cos(a) * r1, 14 + Math.sin(a) * r1, { weight: 1.4 - t * 0.6, rough: 0.5 })
      }
      if (t < 0.85) pen.poly(starPts(14, 14, 7 * (1 - t) + 2, 3 * (1 - t) + 1, 6), { ...burst, weight: 1, rough: 0.5 })
    },
  },
  crit: {
    width: 44,
    height: 44,
    frames: 6,
    fps: 20,
    draw(pen, t) {
      fade(pen, t < 0.6 ? 1 : 1 - (t - 0.6) * 2)
      const r = 9 + t * 11
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 + 0.15
        pen.line(22 + Math.cos(a) * r * 0.9, 22 + Math.sin(a) * r * 0.9, 22 + Math.cos(a) * Math.min(21, r * 1.3), 22 + Math.sin(a) * Math.min(21, r * 1.3), { weight: 1.3, rough: 0.5 })
      }
      pen.poly(starPts(22, 22, r, r * 0.55, 10), { ...gold, weight: 1.3, rough: 0.6 })
      pen.poly(starPts(22, 22, r * 0.5, r * 0.28, 10), { tint: '#ffffff', weight: 0.8, rough: 0.3 })
    },
  },
  dust: {
    width: 40,
    height: 22,
    frames: 5,
    fps: 16,
    draw(pen, t) {
      fade(pen, 1 - t * 0.7)
      const size = 6 + t * 5
      pen.ellipse(15 - t * 7, 16 - t * 4, size, size, { ...smoke, weight: 1, rough: 0.5 })
      pen.ellipse(25 + t * 7, 16 - t * 4, size, size, { ...smoke, weight: 1, rough: 0.5 })
      pen.ellipse(20, 14 - t * 6, size + 1.5, size + 1.5, { ...smoke, weight: 1, rough: 0.5 })
    },
  },
  levelUp: {
    width: 36,
    height: 56,
    frames: 6,
    fps: 16,
    draw(pen, t) {
      fade(pen, t < 0.6 ? 1 : 1 - (t - 0.6) * 2)
      pen.ellipse(18, 50, 12 + t * 14, 4 + t * 3, { line: cssColor(PALETTE.teal), weight: 1.3, rough: 0.5 })
      const xs = [8, 26, 16, 30, 12]
      const lifts = [0, 6, 12, 3, 18]
      xs.forEach((x, i) => {
        const y = 48 - t * 40 - lifts[i]
        pen.poly(starPts(x, y, 3.6, 1.1, 4), { ...(i % 2 === 0 ? sparkle : gold), weight: 0.8, rough: 0.2 })
      })
    },
  },
  death: {
    width: 48,
    height: 48,
    frames: 6,
    fps: 16,
    draw(pen, t) {
      fade(pen, 1 - t * 0.6)
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + 0.4
        const d = 3 + t * 11
        const size = 8 + t * 5
        pen.ellipse(24 + Math.cos(a) * d, 24 + Math.sin(a) * d, size, size, { ...smoke, weight: 1.1, rough: 0.5 })
      }
      const spiral = Array.from({ length: 9 }, (_, i): [number, number] => {
        const a = i * 0.9 + t * 2
        const r = 2 + i * (1.2 + t)
        return [24 + Math.cos(a) * r, 24 + Math.sin(a) * r]
      })
      pen.curve(spiral, { weight: 1, rough: 0.4 })
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2 + 1
        pen.poly(starPts(24 + Math.cos(a) * (6 + t * 17), 24 + Math.sin(a) * (6 + t * 17), 3.2, 1.2, 4), { ...gold, weight: 0.8, rough: 0.2 })
      }
    },
  },
  xp: {
    width: 14,
    height: 14,
    frames: 4,
    fps: 20,
    draw(pen, t) {
      fade(pen, t < 0.7 ? 1 : 0.6)
      const r = 3 + Math.sin(t * Math.PI) * 3
      pen.poly(starPts(7, 7, r, r * 0.3, 4), { ...gold, weight: 0.9, rough: 0.2 })
      pen.dot(7, 7, 0.9, '#ffffff')
    },
  },
}

export const FX_KINDS = Object.keys(DEFS) as FxArt[]

export function fx(scene: Phaser.Scene, kind: FxArt): string {
  const def = DEFS[kind]
  return spriteFrom(scene, {
    key: `scribble:fx:${kind}`,
    width: def.width,
    height: def.height,
    variants: def.frames,
    frameRate: def.fps,
    repeat: 0,
    anchors: { weapon: { x: 0, y: -def.height / 2 }, head: { x: 0, y: -def.height / 2 } },
    draw: (pen, frame) => def.draw(pen, frame / (def.frames - 1)),
  }).animKey
}
