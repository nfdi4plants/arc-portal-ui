import type Phaser from 'phaser'
import type { Theme, TileArt } from '../../contracts/art'
import { TILE } from '../../contracts/constants'
import { cached, spriteFrom } from './atlas'
import { ellipsePts, wavePts } from './geometry'
import { glass, wood } from './looks'
import { THEME_HUE, backdropInk, hsl } from './palette'
import type { Pen } from './pen'

// Tiles and backgrounds for the three themes. Every texture here is a single still frame, which a
// Phaser TileSprite can repeat, and none of them boils. Tiles repeat horizontally without a seam
// because shapes that cross a side are drawn again on the other side. A theme is only generated
// when a scene asks for it.

export const BACKGROUND_WIDTH = 240
export const BACKGROUND_HEIGHT = 360

type Draw = (pen: Pen) => void

interface ThemeDraws {
  ground: Draw
  platform: Draw
  wall: Draw
  background: [Draw, Draw, Draw]
}

const leafLook = (hue: number) => ({ tint: hsl(hue, 55, 82), hatch: hsl(hue, 50, 60), weight: 1, rough: 0.6 })

const study: ThemeDraws = {
  ground(pen) {
    pen.rect(0.5, 5, 23, 18.5, { tint: '#ecdcc0', hatch: '#c9a574', gap: 3 })
    pen.ellipse(6, 15, 4.5, 3.2, { tint: '#f6efe0', weight: 0.8, rough: 0.3 })
    pen.ellipse(17, 18, 3.4, 2.6, { tint: '#f6efe0', weight: 0.8, rough: 0.3 })
    pen.poly(
      [[0.5, 6.5], [0.5, 3], [3, 4.6], [5.5, 1.2], [8, 4.6], [11, 1.6], [13, 4.6], [16, 1.2], [18.5, 4.6], [21, 2], [23.5, 3], [23.5, 6.5]],
      { tint: '#cfe9b4', hatch: '#79b857', gap: 2.4, rough: 0.6 },
    )
  },
  platform(pen) {
    pen.rect(0.5, 0.8, 23, 6.4, { ...wood, gap: 2.4 })
    pen.line(0.5, 3.2, 23.5, 3.2, { weight: 0.6, rough: 0.5 })
    pen.ellipse(15, 4.8, 3, 2, { weight: 0.7, rough: 0.2 })
  },
  wall(pen) {
    pen.rect(0.5, 0.5, 23, 23, { ...wood, gap: 3 })
    pen.rect(3.5, 3.5, 17, 17, { ...glass, rough: 0.5, weight: 0.9 })
    pen.line(5, 17, 11, 6, { line: 'rgba(255, 255, 255, 0.9)', weight: 1.2, rough: 0.3 })
  },
  background: [
    (pen) => {
      const ink = backdropInk(THEME_HUE.study, 0)
      const line = { line: ink.line, weight: 1.1, rough: 0.5 }
      pen.ellipse(70, 150, 70, 130, { tint: hsl(115, 22, 90), hatch: hsl(115, 24, 82), line: 'none', gap: 5 })
      pen.ellipse(180, 120, 56, 110, { tint: hsl(125, 20, 91), hatch: hsl(125, 22, 84), line: 'none', gap: 5 })
      for (const x of [0, 60, 120, 180]) pen.line(x, 0, x, 260, line)
      for (const y of [48, 108, 168, 228]) pen.line(0, y, 240, y, line)
      for (const [x, y] of [[0, 0], [120, 0], [60, 120], [180, 120]]) pen.line(x, y, x + 60, y + 60, { ...line, weight: 0.8 })
      for (const [x, y] of [[3, 51], [123, 51], [63, 171], [183, 111], [63, 51]]) pen.rect(x, y, 54, 54, { tint: ink.tint, hatch: ink.hatch, line: 'none', gap: 5, rough: 0.4 })
      pen.line(0, 262, 240, 262, { ...line, weight: 1.5 })
    },
    (pen) => {
      const ink = backdropInk(THEME_HUE.study, 1)
      const body = { tint: ink.tint, hatch: ink.hatch, line: ink.line, weight: 1.1, rough: 0.8, gap: 4 }
      pen.rect(-2, 262, 244, 10, body)
      for (const x of [14, 114, 214]) pen.rect(x, 272, 6, 70, body)
      pen.rect(-2, 170, 244, 5, body)
      for (const x of [42, 152]) {
        pen.poly([[x - 9, 243], [x + 9, 243], [x + 6, 262], [x - 6, 262]], { tint: '#f1ddd0', hatch: '#dcb7a0', line: ink.line, weight: 1, rough: 0.5, gap: 3 })
        for (const [dx, dy, a] of [[-4, 238, -2.4], [0, 236, -1.57], [4, 238, -0.7], [-1, 242, -1.9]] as const) pen.at(x + dx, dy, a, () => pen.poly([[0, 0], [8, -3], [16, 0], [8, 3]], { ...leafLook(120), line: ink.line }))
      }
      for (const x of [30, 110, 190]) {
        pen.line(x - 8, 175, x - 5, 192, { line: ink.line, weight: 0.8, rough: 0.3 })
        pen.line(x + 8, 175, x + 5, 192, { line: ink.line, weight: 0.8, rough: 0.3 })
        pen.poly([[x - 8, 192], [x + 8, 192], [x + 5, 206], [x - 5, 206]], { tint: '#f1ddd0', hatch: '#dcb7a0', line: ink.line, weight: 1, rough: 0.5, gap: 3 })
        pen.trace(wavePts(x, 192, x + 6, 232, 5, 1.2, 8), { line: ink.line, weight: 1, rough: 0.5 })
      }
    },
    (pen) => {
      const ink = backdropInk(THEME_HUE.study, 2)
      const frond = (x: number, y: number, flip: number) => {
        const spine = wavePts(x, y, x + 30 * flip, y + 96, 12 * flip, 0.7, 9)
        pen.trace(spine, { line: ink.line, weight: 1.2, rough: 0.5 })
        spine.forEach(([sx, sy], i) => {
          if (i < 1) return
          pen.at(sx, sy, 0.6 + (i % 2) * 1.9, () => pen.poly([[0, 0], [12, -4], [24, 0], [12, 4]], { ...leafLook(125), tint: ink.tint, hatch: ink.hatch, line: ink.line, weight: 0.9 }))
        })
      }
      frond(24, -6, 1)
      frond(150, -6, -1)
      for (const x of [76, 196]) {
        pen.poly([[x - 14, 330], [x + 14, 330], [x + 11, 360], [x - 11, 360]], { tint: '#f1ddd0', hatch: '#dcb7a0', line: ink.line, weight: 1.1, rough: 0.6, gap: 3.5 })
        for (const a of [-2.3, -1.57, -0.8]) pen.at(x, 328, a, () => pen.poly([[0, 0], [16, -6], [32, 0], [16, 6]], { ...leafLook(120), tint: ink.tint, hatch: ink.hatch, line: ink.line }))
      }
    },
  ],
}

const assay: ThemeDraws = {
  ground(pen) {
    pen.rect(0.5, 1, 23, 22.5, { tint: '#e3eef3', hatch: '#b5ccd8', gap: 3.2 })
    pen.rect(0.5, 1, 23, 4, { tint: '#f6fbfd', weight: 0.9, rough: 0.4 })
    pen.line(0.5, 14, 23.5, 14, { weight: 0.8, rough: 0.5 })
    pen.line(12, 5, 12, 23.5, { weight: 0.8, rough: 0.5 })
  },
  platform(pen) {
    pen.rect(0.5, 0.8, 23, 6.4, { tint: '#e7edf2', hatch: '#aab8c4', gap: 2.4 })
    pen.dot(3.5, 4, 0.9, '#6b7480')
    pen.dot(20.5, 4, 0.9, '#6b7480')
    pen.line(6, 2.4, 18, 2.4, { line: '#ffffff', weight: 0.9, rough: 0.2 })
  },
  wall(pen) {
    pen.rect(0.5, 0.5, 23, 23, { tint: '#f1f6f8', hatch: '#c4d6df', gap: 4 })
    for (const y of [8, 16]) pen.line(0.5, y, 23.5, y, { weight: 0.8, rough: 0.5 })
    pen.line(12, 0.5, 12, 8, { weight: 0.8, rough: 0.4 })
    pen.line(6, 8, 6, 16, { weight: 0.8, rough: 0.4 })
    pen.line(18, 8, 18, 16, { weight: 0.8, rough: 0.4 })
    pen.line(12, 16, 12, 23.5, { weight: 0.8, rough: 0.4 })
  },
  background: [
    (pen) => {
      const ink = backdropInk(THEME_HUE.assay, 0)
      const line = { line: ink.line, weight: 1.1, rough: 0.5 }
      for (const x of [14, 134]) {
        pen.rect(x, 50, 84, 120, { tint: ink.tint, hatch: ink.hatch, line: ink.line, weight: 1.2, rough: 0.6, gap: 5 })
        pen.line(x + 42, 50, x + 42, 170, line)
        pen.line(x, 110, x + 84, 110, line)
      }
      pen.line(0, 250, 240, 250, { ...line, weight: 1.5 })
      for (const y of [30, 80, 130, 200]) pen.line(0, y, 12, y, { ...line, weight: 0.6 })
      for (const y of [30, 80, 130, 200]) pen.line(108, y, 130, y, { ...line, weight: 0.6 })
      pen.rect(100, 20, 40, 18, { tint: ink.tint, line: ink.line, weight: 1, rough: 0.5 })
    },
    (pen) => {
      const ink = backdropInk(THEME_HUE.assay, 1)
      const body = { tint: ink.tint, hatch: ink.hatch, line: ink.line, weight: 1.1, rough: 0.8, gap: 4 }
      pen.rect(-2, 250, 244, 12, body)
      pen.rect(-2, 262, 244, 98, body)
      for (const x of [58, 118, 178]) {
        pen.line(x, 262, x, 360, { line: ink.line, weight: 1, rough: 0.4 })
        pen.line(x - 6, 290, x - 6, 304, { line: ink.line, weight: 1.4, rough: 0.2 })
      }
      pen.rect(-2, 150, 244, 5, body)
      const bottle = (x: number, h: number, w: number) => {
        pen.rect(x - w / 2, 150 - h, w, h, { ...glass, line: ink.line, weight: 1, rough: 0.5 })
        pen.rect(x - w / 4, 150 - h - 5, w / 2, 5, { tint: ink.tint, line: ink.line, weight: 0.9, rough: 0.3 })
      }
      for (const [x, h, w] of [[22, 26, 12], [46, 20, 10], [72, 32, 14], [100, 22, 10], [128, 28, 12], [158, 24, 14], [184, 32, 10], [210, 20, 12]] as const) bottle(x, h, w)
      pen.poly([[30, 250], [42, 250], [40, 232], [34, 218], [32, 232]], { ...glass, line: ink.line, weight: 1, rough: 0.5 })
      pen.poly([[34, 218], [38, 218], [38, 206], [34, 206]], { ...glass, line: ink.line, weight: 1, rough: 0.5 })
      pen.ellipse(86, 234, 30, 30, { ...glass, line: ink.line, weight: 1, rough: 0.5 })
      pen.rect(82, 208, 8, 12, { ...glass, line: ink.line, weight: 1, rough: 0.5 })
      pen.poly([[120, 250], [150, 250], [152, 220], [118, 220]], { ...glass, line: ink.line, weight: 1, rough: 0.5 })
      for (const x of [176, 186, 196, 206]) pen.rect(x, 224, 6, 26, { ...glass, line: ink.line, weight: 0.9, rough: 0.4 })
    },
    (pen) => {
      const ink = backdropInk(THEME_HUE.assay, 2)
      for (const x of [60, 180]) {
        pen.line(x, -4, x, 28, { line: ink.line, weight: 1, rough: 0.3 })
        pen.glow(x, 52, 46, 'rgba(255, 244, 200, 0.45)')
        pen.poly([[x - 18, 44], [x + 18, 44], [x + 8, 28], [x - 8, 28]], { tint: ink.tint, hatch: ink.hatch, line: ink.line, weight: 1.1, rough: 0.5, gap: 4 })
      }
      for (const [x, y, w, h] of [[110, 320, 54, 70], [232, 330, 44, 60]] as const) {
        pen.ellipse(x, y, w, h, { ...glass, line: ink.line, weight: 1.2, rough: 0.7 })
        pen.rect(x - 8, y - h / 2 - 16, 16, 20, { ...glass, line: ink.line, weight: 1.2, rough: 0.5 })
      }
    },
  ],
}

const run: ThemeDraws = {
  ground(pen) {
    pen.rect(0.5, 1, 23, 22.5, { tint: '#e6e1f0', hatch: '#b3a9cf', gap: 3.2, fill: 'cross-hatch' })
    pen.rect(0.5, 1, 23, 3.4, { tint: '#f6f3fb', weight: 0.9, rough: 0.4 })
    for (const y of [11, 14, 17]) pen.line(6, y, 18, y, { weight: 0.8, rough: 0.3 })
    for (const [x, y] of [[3.5, 7], [20.5, 7], [3.5, 20.5], [20.5, 20.5]]) pen.dot(x, y, 0.9, '#6b6780')
  },
  platform(pen) {
    pen.rect(0.5, 0.8, 23, 6.4, { tint: '#dcd6ea', hatch: '#8f86b0', gap: 2 })
    for (const x of [4, 8, 12, 16, 20]) pen.line(x, 1.8, x, 6.2, { weight: 0.8, rough: 0.2 })
  },
  wall(pen) {
    pen.rect(0.5, 0.5, 23, 23, { tint: '#d9d3e8', hatch: '#9a8fc0', gap: 3.2, fill: 'cross-hatch' })
    for (const y of [6, 10, 14]) pen.line(4, y, 20, y, { weight: 0.9, rough: 0.3 })
    pen.dot(5, 19.5, 1, '#4fbf7a')
    pen.dot(9, 19.5, 1, '#f0a53c')
    pen.ellipse(18, 19, 5, 5, { tint: '#f3f0fa', weight: 0.8, rough: 0.2 })
  },
  background: [
    (pen) => {
      const ink = backdropInk(THEME_HUE.run, 0)
      const line = { line: ink.line, weight: 1.1, rough: 0.5 }
      for (const x of [5, 65, 125, 185]) {
        pen.rect(x, 60, 50, 300, { tint: ink.tint, hatch: ink.hatch, line: ink.line, weight: 1.1, rough: 0.7, gap: 5 })
        for (let y = 80; y < 350; y += 22) pen.line(x + 5, y, x + 45, y, { ...line, weight: 0.7 })
      }
      pen.rect(-2, 26, 244, 10, { tint: ink.tint, line: ink.line, weight: 1.1, rough: 0.5 })
      for (const x of [30, 90, 150, 210]) pen.line(x, 36, x, 60, { ...line, weight: 1.4 })
    },
    (pen) => {
      const ink = backdropInk(THEME_HUE.run, 1)
      const body = { tint: ink.tint, hatch: ink.hatch, line: ink.line, weight: 1.1, rough: 0.8, gap: 4 }
      for (const x of [10, 130]) {
        pen.rect(x, 110, 100, 250, body)
        for (let i = 0; i < 9; i++) {
          const y = 126 + i * 24
          pen.line(x + 4, y, x + 96, y, { line: ink.line, weight: 0.8, rough: 0.3 })
          pen.dot(x + 10, y + 8, 1.2, i % 3 === 0 ? '#9fdcb4' : '#f2c88a')
          pen.dot(x + 17, y + 8, 1.2, '#cfc9e4')
          pen.line(x + 50, y + 8, x + 90, y + 8, { line: ink.line, weight: 0.8, rough: 0.2 })
        }
      }
      pen.curve([[110, 120], [120, 150], [130, 120]], { line: ink.line, weight: 1.6, rough: 0.5 })
      pen.curve([[230, 120], [240, 150], [250, 120]], { line: ink.line, weight: 1.6, rough: 0.5 })
    },
    (pen) => {
      const ink = backdropInk(THEME_HUE.run, 2)
      // Cables hang between hooks on the tile edges and the middle, so the tile repeats cleanly.
      for (const [y, dy, weight] of [[12, 44, 1.8], [6, 62, 1.2]] as const) {
        pen.curve([[0, y], [60, y + dy], [120, y]], { line: ink.line, weight, rough: 0.6 })
        pen.curve([[120, y], [180, y + dy], [240, y]], { line: ink.line, weight, rough: 0.6 })
      }
      pen.curve([[0, 348], [60, 330], [120, 348]], { line: ink.line, weight: 1.6, rough: 0.6 })
      pen.curve([[120, 348], [180, 330], [240, 348]], { line: ink.line, weight: 1.6, rough: 0.6 })
      for (const x of [70, 190]) {
        pen.ellipse(x, 322, 46, 46, { tint: ink.tint, hatch: ink.hatch, line: ink.line, weight: 1.1, rough: 0.6, gap: 4 })
        pen.ellipse(x, 322, 10, 10, { tint: '#ffffff', line: ink.line, weight: 1, rough: 0.3 })
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2
          pen.poly(ellipsePts(x + Math.cos(a) * 12, 322 + Math.sin(a) * 12, 6, 3, 8), { tint: ink.tint, line: ink.line, weight: 0.8, rough: 0.3 })
        }
      }
    },
  ],
}

const DRAWS: Record<Theme, ThemeDraws> = { study, assay, run }

const small = { weapon: { x: 0, y: -TILE / 2 }, head: { x: 0, y: -TILE } }

export function tiles(scene: Phaser.Scene, theme: Theme): TileArt {
  const prefix = `scribble:tile:${theme}`
  return cached(scene, `${prefix}:ground`, () => {
    const draws = DRAWS[theme]
    const still = (key: string, width: number, height: number, draw: Draw): string =>
      spriteFrom(scene, { key, width, height, variants: 1, tileable: true, anchors: small, draw: (pen) => draw(pen) }).textureKey
    return {
      ground: still(`${prefix}:ground`, TILE, TILE, draws.ground),
      platform: still(`${prefix}:platform`, TILE, 8, draws.platform),
      wall: still(`${prefix}:wall`, TILE, TILE, draws.wall),
      background: draws.background.map((draw, i) => still(`scribble:bg:${theme}:${i}`, BACKGROUND_WIDTH, BACKGROUND_HEIGHT, draw)),
    }
  })
}
