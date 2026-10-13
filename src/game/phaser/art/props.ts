import type Phaser from 'phaser'
import type { SpriteRef } from '../../contracts/art'
import { PALETTE } from '../../contracts/constants'
import { spriteFrom } from './atlas'
import type { Pt } from './geometry'
import { gold, stone } from './looks'
import { cssColor } from './palette'
import type { Pen } from './pen'

// Props the scenes place on their own, outside the ScribbleArt interface.

const NAVY = cssColor(PALETTE.navy)
const BLUE = cssColor(PALETTE.blue)
const YELLOW = cssColor(PALETTE.yellow)
const CREAM = cssColor(PALETTE.cream)

// A closed door outline for pen.curve: straight sides up to the spring line, then a half ellipse
// over the top. The sides and the base get extra points so the spline keeps them straight.
function archOutline(left: number, right: number, bottom: number, springY: number, top: number, steps = 9): Pt[] {
  const cx = (left + right) / 2
  const rx = (right - left) / 2
  const ry = springY - top
  const sideSteps = Math.max(1, Math.round((bottom - springY) / 8))
  const points: Pt[] = []
  for (let i = 0; i <= sideSteps; i++) points.push([left, bottom - ((bottom - springY) * i) / sideSteps])
  for (let i = 1; i < steps; i++) {
    const angle = Math.PI + (i / steps) * Math.PI
    points.push([cx + Math.cos(angle) * rx, springY + Math.sin(angle) * ry])
  }
  for (let i = 0; i <= sideSteps; i++) points.push([right, springY + ((bottom - springY) * i) / sideSteps])
  points.push([right - rx * 0.66, bottom], [left + rx * 0.66, bottom], points[0])
  return points
}

function sparkle(pen: Pen, x: number, y: number, size: number, color: string): void {
  pen.line(x - size, y, x + size, y, { line: color, weight: 0.8, rough: 0.2 })
  pen.line(x, y - size, x, y + size, { line: color, weight: 0.8, rough: 0.2 })
}

// The boss door at the end of a stretch: a stone arch around a swirling portal. The sprite stands
// on the bottom centre of the door box.
export function doorArt(scene: Phaser.Scene, width: number, height: number): SpriteRef {
  const w = Math.round(width)
  const h = Math.round(height)
  const spring = w / 2 + 2
  const frame = 5
  const midX = w / 2
  const midY = spring + (h - spring) * 0.35
  return spriteFrom(scene, {
    key: `scribble:door:${w}x${h}`,
    width: w,
    height: h,
    anchors: { weapon: { x: 0, y: -h / 2 }, head: { x: 0, y: -h } },
    draw(pen) {
      pen.curve(archOutline(0.8, w - 0.8, h - 0.8, spring, 0.8), { ...stone, gap: 3 })
      for (let y = spring + 6; y < h - 8; y += 12) {
        pen.line(1.2, y, frame, y + 0.6, { weight: 0.7, rough: 0.4 })
        pen.line(w - frame, y + 0.6, w - 1.2, y, { weight: 0.7, rough: 0.4 })
      }
      pen.curve(archOutline(frame, w - frame, h - 3, spring, frame), { tint: NAVY, hatch: BLUE, fill: 'cross-hatch', gap: 2.6, line: YELLOW, weight: 1 })
      pen.glow(midX, midY, w * 0.4, 'rgba(75, 174, 214, 0.45)')
      const swirl: Pt[] = []
      for (let i = 0; i <= 14; i++) {
        const angle = i * 0.85
        const radius = 1.5 + i * 0.85
        swirl.push([midX + Math.cos(angle) * radius, midY + Math.sin(angle) * radius * 1.1])
      }
      pen.curve(swirl, { line: YELLOW, weight: 0.9, rough: 0.5 })
      sparkle(pen, midX - w * 0.22, midY - h * 0.2, 2.6, YELLOW)
      sparkle(pen, midX + w * 0.2, midY + h * 0.14, 2, CREAM)
      pen.poly([[midX - 3.8, 0.5], [midX + 3.8, 0.5], [midX + 2.8, frame + 0.6], [midX - 2.8, frame + 0.6]], { ...gold, weight: 1, rough: 0.4 })
      pen.rect(0.4, h - 3.6, w - 0.8, 3.2, { ...stone, weight: 1, rough: 0.5 })
    },
  })
}

const SHARD_WIDTH = 14
const SHARD_HEIGHT = 16

// A broken piece of shield. The player picks it up to gain a shield charge.
export function shieldFragmentArt(scene: Phaser.Scene): SpriteRef {
  return spriteFrom(scene, {
    key: 'scribble:pickup:shieldFragment',
    width: SHARD_WIDTH,
    height: SHARD_HEIGHT,
    anchors: { weapon: { x: 0, y: -SHARD_HEIGHT / 2 }, head: { x: 0, y: -SHARD_HEIGHT } },
    draw(pen) {
      pen.glow(7, 8, 8, 'rgba(75, 174, 214, 0.35)')
      pen.poly([[1.2, 1.8], [7, 0.8], [12.8, 1.8], [11, 5.2], [13, 8], [9.6, 9.4], [7, 15.2], [3.2, 10.6], [1.2, 6]], { tint: '#cfeaf8', hatch: BLUE, gap: 1.8, weight: 0.9, rough: 0.5 })
      pen.line(7, 2, 6, 10, { weight: 0.6, rough: 0.3 })
      pen.poly([[3.4, 3.2], [6, 2.8], [5.6, 5.6], [3.6, 6]], { tint: CREAM, line: 'none' })
    },
  })
}
