import type Phaser from 'phaser'
import type { BossMarkerKind, SpriteRef } from '../../contracts/art'
import { spriteFrom } from './atlas'
import { starPts } from './geometry'
import { fire, gold, glass, metal, white } from './looks'
import { MATERIAL, swatch } from './palette'
import type { Pen } from './pen'

// Badges that float in a row over a boss, one per mechanic and one for the theme, so the slots of
// its genome show in the fight. Each is a small disc with an icon, drawn once and cached.

const SIZE = 14
const C = SIZE / 2
const red = swatch(355)
const lime = swatch(95)
const violet = swatch(275)

const ICONS: Record<BossMarkerKind, (pen: Pen) => void> = {
  armoredFront(pen) {
    pen.poly([[C - 4, 3.5], [C + 4, 3.5], [C + 4, 7.5], [C, 11], [C - 4, 7.5]], { ...metal, weight: 0.9, rough: 0.3, gap: 1.6 })
  },
  enrage(pen) {
    for (const [dx, dy] of [[-2.2, -2.2], [2.2, -2.2], [-2.2, 2.2], [2.2, 2.2]]) {
      pen.curve([[C + dx * 0.4, C + dy * 0.4], [C + dx * 1.2, C + dy * 0.7], [C + dx * 1.6, C + dy * 1.6]], { line: red.dark, weight: 1.3, rough: 0.2 })
    }
  },
  phaseShift(pen) {
    pen.poly([[C - 3.5, 3], [C + 3.5, 3], [C, C], [C + 3.5, 11], [C - 3.5, 11], [C, C]], { ...glass, weight: 0.9, rough: 0.2 })
    pen.poly([[C - 2, 10.5], [C + 2, 10.5], [C, 8.5]], { ...gold, line: 'none' })
  },
  summoner(pen) {
    pen.ellipse(C - 2.3, C + 1.5, 5, 4.4, { tint: lime.light, hatch: lime.mid, weight: 0.8, rough: 0.3 })
    pen.ellipse(C + 2.5, C + 2, 4, 3.6, { tint: lime.light, hatch: lime.mid, weight: 0.8, rough: 0.3 })
    pen.dot(C - 2.3, C + 1, 0.5)
  },
  hazard(pen) {
    pen.poly([[C, 2.5], [C + 3.2, 7.5], [C + 2.4, 10], [C, 11], [C - 2.4, 10], [C - 3.2, 7.5]], { tint: lime.mid, hatch: lime.dark, weight: 0.9, rough: 0.3, gap: 1.6 })
  },
  teleport(pen) {
    pen.arc(C, C, 8, 8, 0.3, Math.PI * 1.6, false, { line: violet.dark, weight: 1.2, rough: 0.2 })
    pen.poly([[C + 3.2, C - 3.6], [C + 4.6, C - 0.6], [C + 1.6, C - 1.2]], { tint: violet.dark, line: 'none' })
    pen.dot(C, C, 1, violet.dark)
  },
  shieldPulse(pen) {
    pen.ellipse(C, C, 8.5, 8.5, { ...glass, weight: 1, rough: 0.2 })
    pen.ellipse(C, C, 4, 4, { tint: MATERIAL.glass.hatch, line: 'none' })
  },
  reflect(pen) {
    pen.poly([[C, 2.5], [C + 4, C], [C, 11.5], [C - 4, C]], { ...glass, weight: 0.9, rough: 0.2 })
    pen.line(C - 1.5, C - 2, C + 1.5, C + 1, { line: '#ffffff', weight: 1, rough: 0.1 })
  },
  tempo(pen) {
    pen.ellipse(C, C, 8.5, 8.5, { ...white, weight: 0.9, rough: 0.2 })
    pen.trace([[C, C - 3], [C, C], [C + 2.4, C + 1.2]], { weight: 0.9, rough: 0.1 })
  },
  heat(pen) {
    pen.poly([[C, 2.5], [C + 3.6, 8], [C + 2, 11], [C - 2, 11], [C - 3.6, 8], [C - 1, 6.5]], { ...fire, weight: 0.9, rough: 0.3, gap: 1.6 })
  },
  reach(pen) {
    pen.rect(2.5, C - 1.6, SIZE - 5, 3.2, { ...gold, weight: 0.8, rough: 0.2 })
    for (let x = 4.5; x < SIZE - 3; x += 2) pen.line(x, C - 1.6, x, C, { weight: 0.5, rough: 0.1 })
  },
  dense(pen) {
    pen.poly([[C - 2, 4], [C + 2, 4], [C + 4, 11], [C - 4, 11]], { tint: MATERIAL.stone.hatch, hatch: MATERIAL.stone.dark, weight: 0.9, rough: 0.3, gap: 1.6 })
    pen.ellipse(C, 3.6, 2.6, 2, { weight: 0.8, rough: 0.2 })
  },
  precise(pen) {
    pen.ellipse(C, C, 7.5, 7.5, { weight: 0.9, rough: 0.2 })
    pen.line(C, 2.5, C, 11.5, { weight: 0.7, rough: 0.1 })
    pen.line(2.5, C, 11.5, C, { weight: 0.7, rough: 0.1 })
    pen.poly(starPts(C, C, 1.4, 0.6, 4), { tint: red.mid, line: 'none' })
  },
}

export const BOSS_MARKER_SIZE = SIZE

export function bossMarker(scene: Phaser.Scene, kind: BossMarkerKind): SpriteRef {
  return spriteFrom(scene, {
    key: `scribble:bossMarker:${kind}`,
    width: SIZE,
    height: SIZE,
    anchors: { weapon: { x: 0, y: -C }, head: { x: 0, y: -SIZE } },
    draw(pen) {
      pen.ellipse(C, C, SIZE - 1, SIZE - 1, { tint: '#fffdf6', weight: 1, rough: 0.3 })
      ICONS[kind](pen)
    },
  })
}
