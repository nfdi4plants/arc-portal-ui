import type Phaser from 'phaser'
import type { FinalBossSpec } from '../../contracts/content'
import { hashString } from '../../contracts/rng'
import { cached, spriteFrom } from './atlas'
import { drawWeakPoint, partFrom, WEAK_POINT_SIZE, weakPointRest } from './bossParts'
import { flipPts, wavePts, wrapTitle } from './geometry'
import type { Pt } from './geometry'
import { metal, paper, white, wood } from './looks'
import { MATERIAL, swatch } from './palette'
import type { BossArt, PartRef } from './parts'
import type { Pen } from './pen'

// The ARC itself: an open RO-Crate box with the investigation title on its label.

const WIDTH = 176
const HEIGHT = 156
const dark = { tint: '#d9c6a4', hatch: '#7a6446', fill: 'cross-hatch', gap: 3 } as const
const blue = swatch(205)
const rose = swatch(350)

// The label tilts a little differently in each variant, so the lettering wobbles with the lines.
const LABEL_ANGLE = [-0.035, 0.022, -0.012]

function sheet(pen: Pen, x: number, y: number, angle: number, w: number, h: number, look: typeof paper): void {
  pen.at(x, y, angle, () => {
    pen.rect(-w / 2, -h, w, h, look)
    for (let i = 0; i < 3; i++) pen.trace(wavePts(-w / 2 + 4, -h + 6 + i * 6, w / 2 - 4, -h + 6 + i * 6, 0.8, 4, 8), { weight: 0.6, rough: 0.3 })
  })
}

function drawBody(pen: Pen, variant: number, title: string): void {
  pen.rect(8, 150, 26, 6, wood)
  pen.rect(142, 150, 26, 6, wood)
  pen.poly([[12, 62], [164, 62], [154, 44], [22, 44]], dark)
  sheet(pen, 52, 50, -0.1, 34, 26, paper)
  sheet(pen, 92, 50, 0.08, 36, 28, { tint: blue.light })
  sheet(pen, 128, 50, -0.04, 32, 24, { tint: rose.light })
  pen.poly([[12, 62], [164, 62], [164, 152], [12, 152]], { ...wood, angle: 0, gap: 3 })
  pen.rect(12, 62, 152, 8, { ...wood, hatch: MATERIAL.wood.dark, gap: 2 })
  for (const y of [90, 116]) pen.line(12, y, 164, y, { weight: 0.9, rough: 0.6 })
  for (const x of [30, 146]) pen.line(x, 70, x, 152, { weight: 0.8, rough: 0.6 })
  const corner: Pt[] = [[12, 62], [38, 62], [38, 69], [19, 69], [19, 90], [12, 90]]
  pen.poly(corner, { ...metal, rough: 0.5 })
  pen.poly(flipPts(corner, 88), { ...metal, rough: 0.5 })
  pen.poly(corner.map(([x, y]): Pt => [x, 214 - y]), { ...metal, rough: 0.5 })
  pen.poly(flipPts(corner, 88).map(([x, y]): Pt => [x, 214 - y]), { ...metal, rough: 0.5 })
  for (const [x, y] of [[16, 66], [160, 66], [16, 148], [160, 148]]) pen.dot(x, y, 1, MATERIAL.metal.dark)

  const angle = LABEL_ANGLE[variant % LABEL_ANGLE.length]
  pen.at(88, 108, angle, () => {
    pen.rect(-56, -28, 112, 56, paper)
    pen.rect(-60, -31, 14, 6, { tint: 'rgba(250, 214, 90, 0.7)', line: 'none' })
    pen.rect(46, -31, 14, 6, { tint: 'rgba(250, 214, 90, 0.7)', line: 'none' })
  })
  pen.text(['RO-CRATE'], 88, 88, 6.5, 64, angle, '#b3413f')
  pen.text(wrapTitle(title, 16, 3), 88, 113, 11, 98, angle)

  pen.rect(80, 138, 16, 12, { ...metal, rough: 0.5 })
  pen.ellipse(88, 144, 4, 4, { tint: MATERIAL.ink, line: 'none' })
}

function drawLid(pen: Pen): void {
  pen.poly([[12, 2], [144, 2], [154, 18], [2, 18]], { ...wood, angle: 0, gap: 3 })
  pen.line(6, 10, 150, 10, { weight: 0.9, rough: 0.6 })
  pen.rect(22, 12, 14, 6, metal)
  pen.rect(120, 12, 14, 6, metal)
}

function drawGlove(pen: Pen): void {
  const look = { ...white, hatch: blue.mid, gap: 3 }
  for (const [x, y, w, h] of [[11, 12, 7, 15], [18.5, 8, 7, 18], [26, 8, 7, 18], [33, 13, 7, 15]]) pen.ellipse(x, y + h / 2 - 2, w, h, look)
  pen.ellipse(22, 30, 28, 22, look)
  pen.ellipse(8, 28, 10, 15, look)
  pen.rect(11, 38, 22, 6, { tint: rose.mid, hatch: rose.dark })
  pen.trace([[16, 22], [18, 30]], { weight: 0.7, rough: 0.3 })
}

export function finalBoss(scene: Phaser.Scene, spec: FinalBossSpec): BossArt {
  const key = `scribble:finalBoss:${hashString(spec.title)}`
  return cached(scene, key, () => {
    const body = spriteFrom(scene, {
      key,
      width: WIDTH,
      height: HEIGHT,
      anchors: { weapon: { x: 0, y: -HEIGHT * 0.45 }, head: { x: 0, y: -HEIGHT + 30 } },
      draw: (pen, variant) => drawBody(pen, variant, spec.title),
    })
    const part = (name: string, def: Parameters<typeof partFrom>[2]): PartRef => partFrom(scene, `scribble:finalBoss:part:${name}`, def)
    const hand = { width: 44, height: 44, pivot: { x: 0, y: -4 } }
    const marker = partFrom(scene, 'scribble:boss:weakPoint', {
      width: WEAK_POINT_SIZE,
      height: WEAK_POINT_SIZE,
      rest: { x: 0, y: 0 },
      pivot: { x: 0, y: -WEAK_POINT_SIZE / 2 },
      draw: drawWeakPoint,
    })
    return {
      ...body,
      parts: {
        lid: part('lid', { width: 156, height: 20, rest: { x: 0, y: -130 }, pivot: { x: 0, y: 0 }, draw: drawLid }),
        leftHand: part('leftHand', { ...hand, rest: { x: -108, y: -54 }, draw: drawGlove }),
        rightHand: part('rightHand', { ...hand, rest: { x: 108, y: -54 }, draw: (pen) => pen.mirrored(22, () => drawGlove(pen)) }),
        weakPoint: { ...marker, rest: weakPointRest(WIDTH, HEIGHT, 88, 144) },
      },
    }
  })
}
