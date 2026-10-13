import type Phaser from 'phaser'
import type { TelegraphArt } from '../../contracts/art'
import { spriteFrom } from './atlas'
import { conePts } from './geometry'
import { telegraphKey } from './layout'
import type { Look } from './pen'

// Hatched red (#e5484d) danger zones. One still frame, the boss scene scales it and fills it over
// the telegraph time. The hatching is 60 % opaque and the outline is solid, so the arena stays
// visible through the zone.

const ZONE: Look = { tint: 'rgba(229, 72, 77, 0.3)', hatch: 'rgba(229, 72, 77, 0.6)', gap: 3, angle: 45, line: '#a3262b', weight: 1.4 }
const BEAM: Look = { ...ZONE, fill: 'cross-hatch', gap: 2.4 }

export function telegraph(scene: Phaser.Scene, shape: TelegraphArt, width: number, height: number): string {
  const w = Math.max(4, Math.round(width))
  const h = Math.max(4, Math.round(height))
  const key = telegraphKey(shape, w, h)
  spriteFrom(scene, {
    key,
    width: w,
    height: h,
    variants: 1,
    anchors: { weapon: { x: 0, y: -h / 2 }, head: { x: 0, y: -h } },
    draw(pen) {
      if (shape === 'circle') pen.ellipse(w / 2, h / 2, w - 2, h - 2, ZONE)
      else if (shape === 'cone') pen.poly(conePts(w, h), ZONE)
      else if (shape === 'line') pen.rect(1, 1, w - 2, h - 2, BEAM)
      else pen.rect(1, 1, w - 2, h - 2, ZONE)
    },
  })
  return key
}
