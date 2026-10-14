import type Phaser from 'phaser'
import type { BossArchetype, BossSpec } from '../../contracts/content'
import { cached, spriteFrom } from './atlas'
import { eye } from './bodies'
import { drawWeakPoint, leafPts, partFrom, WEAK_POINT_SIZE, weakPointRest } from './bossParts'
import type { PartDef } from './bossParts'
import { flipPts, ribbonPts, wavePts } from './geometry'
import { darkMetal, glass, hatched, metal, shaded, white, wood } from './looks'
import { MATERIAL, hsl, swatch } from './palette'
import type { BossArt, PartRef } from './parts'
import type { Pen } from './pen'

// Four boss archetypes. The body is drawn without its limbs and without the weak point, those are
// separate sprites the boss scene moves for attack animations.

interface BossDef {
  width: number
  height: number
  // Where attacks come from and where the head is, in frame coordinates.
  core: [number, number]
  head: [number, number]
  draw(pen: Pen): void
  parts: Record<string, PartDef>
  weakPoint: [number, number]
}

const bark = swatch(28)
const moss = swatch(108)
const leafLook = { tint: hsl(100, 55, 85), hatch: hsl(105, 50, 62), weight: 0.9 }

function leaf(pen: Pen, x: number, y: number, angle: number, size: number): void {
  pen.at(x, y, angle, () => pen.poly(leafPts(size), { ...leafLook, rough: 0.5, gap: 2 }))
}

// Root treant (source): a stump with a face, root arms and a sapling on top.
function treantArm(pen: Pen): void {
  pen.poly(ribbonPts([[17, 1], [18, 14], [17, 30], [16, 44]], 14, 8), { ...shaded(bark), angle: 80 })
  pen.trace([[17, 44], [10, 50], [6, 54]], { weight: 1.6 })
  pen.trace([[17, 44], [17, 51], [17, 55]], { weight: 1.6 })
  pen.trace([[17, 44], [24, 50], [28, 54]], { weight: 1.6 })
  leaf(pen, 6, 52, 2.4, 6)
  leaf(pen, 28, 52, 0.7, 6)
  pen.trace([[14, 12], [15, 24]], { weight: 0.8, rough: 0.3 })
}

const rootTreant: BossDef = {
  width: 124,
  height: 112,
  core: [62, 56],
  head: [62, 40],
  weakPoint: [62, 62],
  draw(pen) {
    const root: [number, number][] = [[40, 98], [22, 104], [6, 112], [34, 112], [48, 108]]
    pen.poly(root, shaded(bark))
    pen.poly(flipPts(root, 62), shaded(bark))
    pen.poly([[34, 20], [90, 20], [96, 44], [92, 70], [98, 96], [88, 110], [62, 106], [36, 110], [26, 96], [32, 70], [28, 44]], { ...hatched(bark), angle: 82, gap: 2.8 })
    for (const [x, y] of [[44, 34], [80, 36], [40, 78], [86, 82]]) pen.trace([[x, y], [x - 2, y + 14], [x + 1, y + 28]], { weight: 0.8, rough: 0.4 })
    pen.ellipse(62, 20, 62, 15, { tint: bark.light, hatch: bark.mid, gap: 3 })
    pen.ellipse(62, 20, 38, 8, { weight: 0.8, rough: 0.4 })
    pen.ellipse(62, 20, 15, 4, { weight: 0.8, rough: 0.4 })
    pen.ellipse(40, 94, 26, 9, { tint: moss.light, hatch: moss.mid, rough: 0.5, weight: 0.9 })
    pen.ellipse(88, 66, 13, 17, { tint: moss.light, hatch: moss.mid, rough: 0.5, weight: 0.9 })
    pen.line(41, 36, 56, 43, { weight: 2.2, rough: 0.5 })
    pen.line(83, 36, 68, 43, { weight: 2.2, rough: 0.5 })
    eye(pen, 50, 49, 7)
    eye(pen, 74, 49, 7)
    pen.ellipse(62, 63, 9, 12, { tint: bark.dark, hatch: MATERIAL.ink, rough: 0.5, weight: 0.9 })
    pen.poly([[46, 76], [54, 86], [62, 89], [70, 86], [78, 76], [70, 80], [62, 82], [54, 80]], { tint: MATERIAL.ink, weight: 1, rough: 0.5 })
    pen.poly([[54, 81], [56.5, 86], [59, 82]], { ...white, weight: 0.7, rough: 0.2 })
    pen.poly([[65, 82], [68, 86], [70, 81]], { ...white, weight: 0.7, rough: 0.2 })
    pen.trace([[62, 15], [61, 10], [62, 6]], { weight: 1.3, rough: 0.4 })
    leaf(pen, 61, 11, -2.3, 10)
    leaf(pen, 62, 8, -0.6, 11)
    leaf(pen, 38, 17, -2.6, 10)
    leaf(pen, 86, 17, -0.5, 10)
  },
  parts: {
    leftArm: { width: 34, height: 56, rest: { x: -40, y: -4 }, pivot: { x: 0, y: -56 }, draw: treantArm },
    rightArm: { width: 34, height: 56, rest: { x: 40, y: -4 }, pivot: { x: 0, y: -56 }, draw: (pen) => pen.mirrored(17, () => treantArm(pen)) },
  },
}

// Specimen jar (sample): glass jar with a creature inside, lid and tentacles are separate.
const pink = swatch(335)

function tentacle(pen: Pen): void {
  const spine = wavePts(15, 2, 13, 56, 6, 1.25, 12)
  pen.poly(ribbonPts(spine, 10, 3.5), hatched(pink))
  for (let i = 2; i < 11; i += 2) pen.ellipse(spine[i][0] + 1, spine[i][1], 1.8, 1.8, { tint: pink.accent, weight: 0.6, rough: 0.2 })
}

const specimenJar: BossDef = {
  width: 100,
  height: 120,
  core: [50, 78],
  head: [50, 70],
  weakPoint: [50, 78],
  draw(pen) {
    pen.ellipse(50, 114, 86, 11, darkMetal)
    pen.rect(32, 22, 36, 11, glass)
    pen.poly([[22, 30], [78, 30], [86, 40], [86, 104], [78, 112], [22, 112], [14, 104], [14, 40]], glass)
    pen.poly([[15, 54], [85, 54], [85, 104], [78, 111], [22, 111], [15, 104]], { tint: 'rgba(168, 228, 190, 0.7)', hatch: 'rgba(96, 190, 144, 0.85)', line: 'none', gap: 3 })
    pen.trace(wavePts(15, 54, 85, 54, 1.6, 4, 16), { weight: 1, rough: 0.4 })
    for (const [x1, x2] of [[40, 35], [50, 50], [60, 65]]) pen.trace(wavePts(x1, 92, x2, 108, 3, 1.5, 8), { weight: 1.4, rough: 0.4 })
    pen.ellipse(50, 80, 36, 31, hatched(pink))
    eye(pen, 43, 76, 5.6)
    eye(pen, 58, 76, 5.6)
    pen.curve([[43, 88], [50, 91], [57, 88]], { weight: 1, rough: 0.3 })
    for (const [x, y, r] of [[28, 68, 5], [73, 62, 4], [67, 92, 3]]) pen.ellipse(x, y, r, r, { tint: 'rgba(255, 255, 255, 0.7)', weight: 0.7, rough: 0.3 })
    pen.trace([[21, 42], [19, 62], [21, 88]], { line: 'rgba(255, 255, 255, 0.95)', weight: 1.6, rough: 0.4 })
    pen.rect(30, 96, 40, 12, { tint: '#fffdf6', weight: 0.9, rough: 0.5 })
    pen.line(34, 100, 66, 100, { weight: 0.7, rough: 0.5 })
    pen.line(34, 104, 56, 104, { weight: 0.7, rough: 0.5 })
  },
  parts: {
    lid: {
      width: 52,
      height: 14,
      rest: { x: 0, y: -96 },
      pivot: { x: -22, y: 0 },
      draw(pen) {
        pen.poly([[3, 4], [49, 4], [51, 13], [1, 13]], { ...metal, gap: 2.2 })
        pen.ellipse(26, 4, 46, 6, { ...metal, weight: 1 })
        pen.line(8, 9, 44, 9, { weight: 0.7, rough: 0.4 })
      },
    },
    leftTentacle: { width: 30, height: 60, rest: { x: -50, y: -42 }, pivot: { x: 0, y: -60 }, draw: tentacle },
    rightTentacle: { width: 30, height: 60, rest: { x: 50, y: -42 }, pivot: { x: 0, y: -60 }, draw: (pen) => pen.mirrored(15, () => tentacle(pen)) },
  },
}

// Reagent golem (material): flasks and beakers glued together.
const lime = 'rgba(176, 232, 120, 0.75)'
const limeHatch = 'rgba(112, 190, 60, 0.9)'
const violet = 'rgba(206, 150, 238, 0.75)'
const violetHatch = 'rgba(160, 90, 205, 0.9)'

function beaker(pen: Pen, x: number, y: number, w: number, h: number, tint: string, hatch: string): void {
  pen.poly([[x, y], [x + w, y], [x + w + 2, y + h], [x - 2, y + h]], glass)
  pen.poly([[x - 1, y + h * 0.4], [x + w + 1, y + h * 0.4], [x + w + 2, y + h - 1], [x - 2, y + h - 1]], { tint, hatch, line: 'none', gap: 2.4 })
  for (let i = 1; i < 4; i++) pen.line(x + w - 4, y + (h * i) / 4, x + w, y + (h * i) / 4, { weight: 0.7, rough: 0.2 })
}

function golemArm(pen: Pen): void {
  pen.rect(9, 3, 10, 36, glass)
  pen.rect(10, 18, 8, 20, { tint: violet, hatch: violetHatch, line: 'none', gap: 2.2 })
  pen.ellipse(14, 4, 9, 9, { ...metal, weight: 1, rough: 0.4 })
  beaker(pen, 4, 40, 20, 16, lime, limeHatch)
}

const reagentGolem: BossDef = {
  width: 104,
  height: 124,
  core: [52, 70],
  head: [52, 24],
  weakPoint: [52, 70],
  draw(pen) {
    beaker(pen, 24, 92, 22, 30, violet, violetHatch)
    beaker(pen, 58, 92, 22, 30, violet, violetHatch)
    pen.rect(40, 36, 24, 18, glass)
    pen.ellipse(52, 70, 58, 58, glass)
    pen.arc(52, 74, 54, 48, 0.12, Math.PI - 0.12, true, { tint: lime, hatch: limeHatch, line: 'none', gap: 2.4 })
    pen.trace(wavePts(26, 72, 78, 72, 1.6, 3, 14), { weight: 1, rough: 0.4 })
    for (const [x, y, r] of [[40, 82, 4], [60, 88, 5], [52, 78, 3]]) pen.ellipse(x, y, r, r, { tint: 'rgba(255, 255, 255, 0.8)', weight: 0.7, rough: 0.3 })
    pen.rect(40, 36, 24, 6, { ...metal, weight: 1 })
    pen.poly([[46, 9], [58, 9], [58, 18], [74, 40], [30, 40], [46, 18]], glass)
    pen.poly([[39, 29], [65, 29], [74, 39], [30, 39]], { tint: violet, hatch: violetHatch, line: 'none', gap: 2.4 })
    pen.rect(46, 3, 12, 7, wood)
    eye(pen, 45, 26, 4.6)
    eye(pen, 59, 26, 4.6)
    pen.trace([[44, 35], [48, 32], [52, 35], [56, 32], [60, 35]], { weight: 1, rough: 0.3 })
  },
  parts: {
    leftArm: { width: 30, height: 58, rest: { x: -40, y: -3 }, pivot: { x: 0, y: -54 }, draw: golemArm },
    rightArm: { width: 30, height: 58, rest: { x: 40, y: -3 }, pivot: { x: 0, y: -54 }, draw: (pen) => pen.mirrored(15, () => golemArm(pen)) },
  },
}

// Glitch daemon (data): a floating monitor with pixel horns and hanging cables.
const mint = { tint: '#c9f2e8', hatch: '#78d6c2', gap: 3 }
const magenta = swatch(310)

function pixelHand(pen: Pen): void {
  const look = { ...hatched(swatch(170)), rough: 0.5 }
  pen.rect(5, 12, 22, 16, look)
  for (const [x, y, w, h] of [[5, 4, 6, 10], [12, 1, 6, 13], [19, 4, 6, 10], [1, 14, 6, 8]]) pen.rect(x, y, w, h, look)
  pen.line(8, 22, 24, 22, { weight: 0.7, rough: 0.3 })
}

const glitchDaemon: BossDef = {
  width: 108,
  height: 124,
  core: [54, 42],
  head: [54, 30],
  weakPoint: [54, 42],
  draw(pen) {
    pen.ellipse(54, 118, 60, 7, { tint: 'rgba(25, 25, 25, 0.12)', line: 'none', rough: 0.3 })
    for (const [x1, x2] of [[42, 38], [54, 54], [66, 70]]) {
      pen.trace(wavePts(x1, 70, x2, 112, 4, 1.4, 12), { weight: 1.5, rough: 0.5 })
      pen.rect(x2 - 2.5, 112, 5, 6, darkMetal)
    }
    const horn: [number, number][] = [[16, 14], [16, 10], [12, 10], [12, 6], [8, 6], [8, 0], [14, 0], [14, 4], [18, 4], [18, 8], [24, 8], [24, 14]]
    pen.poly(horn, { ...hatched(magenta), rough: 0.5 })
    pen.poly(flipPts(horn, 54), { ...hatched(magenta), rough: 0.5 })
    pen.poly([[16, 14], [92, 14], [96, 20], [96, 64], [92, 70], [16, 70], [12, 64], [12, 20]], { ...darkMetal, rough: 0.7 })
    pen.rect(20, 20, 68, 44, { ...mint, rough: 0.5 })
    pen.rect(32, 28, 12, 15, { tint: MATERIAL.ink, weight: 0.8, rough: 0.3 })
    pen.rect(64, 28, 12, 15, { tint: MATERIAL.ink, weight: 0.8, rough: 0.3 })
    pen.rect(34, 30, 4, 4, { tint: '#ffffff', line: 'none' })
    pen.rect(66, 30, 4, 4, { tint: '#ffffff', line: 'none' })
    pen.trace([[34, 56], [40, 56], [40, 51], [48, 51], [48, 56], [56, 56], [56, 51], [64, 51], [64, 56], [70, 56]], { weight: 1.2, rough: 0.4 })
    pen.rect(20, 40, 68, 4, { tint: 'rgba(240, 70, 200, 0.28)', line: 'none' })
    pen.rect(24, 52, 60, 3, { tint: 'rgba(60, 210, 230, 0.35)', line: 'none' })
    pen.trace([[12, 22], [10, 40], [11, 62]], { line: '#2ad4e0', weight: 0.9, rough: 0.5 })
    pen.trace([[96, 24], [98, 42], [97, 64]], { line: '#e35bd0', weight: 0.9, rough: 0.5 })
  },
  parts: {
    leftHand: { width: 30, height: 30, rest: { x: -66, y: -70 }, pivot: { x: 0, y: -15 }, draw: pixelHand },
    rightHand: { width: 30, height: 30, rest: { x: 66, y: -70 }, pivot: { x: 0, y: -15 }, draw: (pen) => pen.mirrored(15, () => pixelHand(pen)) },
  },
}

export const BOSS_DEFS: Record<BossArchetype, BossDef> = { rootTreant, specimenJar, reagentGolem, glitchDaemon }

function weakPoint(scene: Phaser.Scene, def: BossDef): PartRef {
  const marker = partFrom(scene, 'scribble:boss:weakPoint', {
    width: WEAK_POINT_SIZE,
    height: WEAK_POINT_SIZE,
    rest: { x: 0, y: 0 },
    pivot: { x: 0, y: -WEAK_POINT_SIZE / 2 },
    draw: drawWeakPoint,
  })
  return { ...marker, rest: weakPointRest(def.width, def.height, def.weakPoint[0], def.weakPoint[1]) }
}

export function boss(scene: Phaser.Scene, spec: BossSpec): BossArt {
  const def = BOSS_DEFS[spec.archetype]
  const key = `scribble:boss:${spec.archetype}`
  return cached(scene, key, () => {
    const body = spriteFrom(scene, {
      key,
      width: def.width,
      height: def.height,
      anchors: {
        weapon: { x: def.core[0] - def.width / 2, y: def.core[1] - def.height },
        head: { x: def.head[0] - def.width / 2, y: def.head[1] - def.height },
      },
      draw: (pen) => def.draw(pen),
    })
    const parts: Record<string, PartRef> = {}
    for (const [name, part] of Object.entries(def.parts)) parts[name] = partFrom(scene, `${key}:${name}`, part)
    parts.weakPoint = weakPoint(scene, def)
    return { ...body, parts }
  })
}
