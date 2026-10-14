import type Phaser from 'phaser'
import { spriteFrom } from './atlas'
import type { Pt } from './geometry'
import type { PartRef } from './parts'
import type { Pen } from './pen'

export interface PartDef {
  width: number
  height: number
  // Origin (bottom centre) of the part relative to the origin of the boss body at rest.
  rest: { x: number; y: number }
  // Joint the part swings around, relative to the part's own origin.
  pivot: { x: number; y: number }
  draw(pen: Pen): void
}

export function partFrom(scene: Phaser.Scene, key: string, def: PartDef): PartRef {
  const ref = spriteFrom(scene, {
    key,
    width: def.width,
    height: def.height,
    // For a part, "weapon" is the free end and "head" the top of the sprite.
    anchors: { weapon: { x: 0, y: 0 }, head: { x: 0, y: -def.height } },
    draw: (pen) => def.draw(pen),
  })
  return { ...ref, rest: def.rest, pivot: def.pivot }
}

export const WEAK_POINT_SIZE = 16

// The glowing target. It is drawn once and placed per boss.
export function drawWeakPoint(pen: Pen): void {
  const c = WEAK_POINT_SIZE / 2
  pen.glow(c, c, c, 'rgba(255, 214, 64, 0.85)')
  pen.ellipse(c, c, 11, 11, { tint: 'rgba(255, 255, 255, 0.85)', weight: 1, rough: 0.5 })
  pen.ellipse(c, c, 4.5, 4.5, { tint: '#e5484d', weight: 0.8, rough: 0.3 })
  for (const [x1, y1, x2, y2] of [
    [c, 0.4, c, 2.6],
    [c, WEAK_POINT_SIZE - 0.4, c, WEAK_POINT_SIZE - 2.6],
    [0.4, c, 2.6, c],
    [WEAK_POINT_SIZE - 0.4, c, WEAK_POINT_SIZE - 2.6, c],
  ]) {
    pen.line(x1, y1, x2, y2, { weight: 0.9, rough: 0.2 })
  }
}

// Rest position of a weak point whose centre sits at (cx, cy) in a body frame of the given size.
export function weakPointRest(bodyWidth: number, bodyHeight: number, cx: number, cy: number): { x: number; y: number } {
  return { x: cx - bodyWidth / 2, y: -(bodyHeight - cy) + WEAK_POINT_SIZE / 2 }
}

export function leafPts(size: number): Pt[] {
  return [
    [0, 0],
    [size * 0.45, -size * 0.32],
    [size, 0],
    [size * 0.45, size * 0.32],
  ]
}
