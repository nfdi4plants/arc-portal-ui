import type Phaser from 'phaser'
import type { SpriteRef } from '../../contracts/art'
import { PALETTE } from '../../contracts/constants'
import type { PowerUpKind, Rarity } from '../../contracts/progression'
import { cached, spriteFrom } from './atlas'
import { artContext } from './canvas'
import { gearPts, starPts, wavePts } from './geometry'
import type { Pt } from './geometry'
import { gold, metal, stone, wood } from './looks'
import { cssColor } from './palette'
import type { Pen } from './pen'

// Props the scenes place on their own, outside the ScribbleArt interface.

const NAVY = cssColor(PALETTE.navy)
const BLUE = cssColor(PALETTE.blue)
const YELLOW = cssColor(PALETTE.yellow)
const CREAM = cssColor(PALETTE.cream)
const TEAL = cssColor(PALETTE.teal)

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

const PORTAL_SWIRL_SIZE = 30

// The swirl of a forming portal, drawn on its own so the boss arena can grow and spin it in front
// of the arch. The sprite turns around its centre.
export function portalSwirlArt(scene: Phaser.Scene): SpriteRef {
  const s = PORTAL_SWIRL_SIZE
  const c = s / 2
  return spriteFrom(scene, {
    key: 'scribble:portal:swirl',
    width: s,
    height: s,
    anchors: { weapon: { x: 0, y: -c }, head: { x: 0, y: -s } },
    draw(pen) {
      pen.glow(c, c, c, 'rgba(75, 174, 214, 0.5)')
      for (let arm = 0; arm < 2; arm++) {
        const swirl: Pt[] = []
        for (let i = 0; i <= 12; i++) {
          const angle = i * 0.62 + arm * Math.PI
          const radius = 1 + i * 1.05
          swirl.push([c + Math.cos(angle) * radius, c + Math.sin(angle) * radius])
        }
        pen.curve(swirl, { line: arm === 0 ? YELLOW : CREAM, weight: 1, rough: 0.4 })
      }
      pen.dot(c, c, 1.4, CREAM)
    },
  })
}

// A spark that spirals into a forming portal.
export function portalSparkArt(scene: Phaser.Scene): SpriteRef {
  return spriteFrom(scene, {
    key: 'scribble:portal:spark',
    width: 7,
    height: 7,
    anchors: { weapon: { x: 0, y: -3.5 }, head: { x: 0, y: -7 } },
    draw(pen) {
      pen.glow(3.5, 3.5, 3.5, 'rgba(245, 190, 0, 0.45)')
      sparkle(pen, 3.5, 3.5, 2.6, YELLOW)
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

export const FRAGMENT_SIZE = 11

// The shard of a broken ontology, glassy gold with three linked terms on it, one edge cut off at
// the break. Mobs and bosses drop Ontology Fragments, the FAIR trader collects them.
export function fragmentArt(scene: Phaser.Scene): SpriteRef {
  const s = FRAGMENT_SIZE
  const edge = { line: NAVY, weight: 0.6, rough: 0.15 }
  const term = { tint: TEAL, weight: 0.5, rough: 0.1 }
  return spriteFrom(scene, {
    key: 'scribble:pickup:ontologyFragment',
    width: s,
    height: s,
    anchors: { weapon: { x: 0, y: -s / 2 }, head: { x: 0, y: -s } },
    draw(pen) {
      pen.glow(s / 2, s / 2, s / 2 + 1, 'rgba(245, 190, 0, 0.35)')
      pen.poly([[1, 3.4], [4.4, 0.8], [6.4, 2.2], [10.2, 1], [9.4, 5], [10.4, 8.8], [6.8, 10.3], [5.6, 8.9], [2.6, 10], [0.7, 6.8]], { tint: '#fff3c4', hatch: YELLOW, gap: 1.7, weight: 0.8, rough: 0.4 })
      pen.line(3.3, 4.2, 7.6, 3.6, edge)
      pen.line(3.3, 4.2, 4.8, 7.6, edge)
      pen.line(4.8, 7.6, 9.6, 7.2, edge)
      pen.ellipse(3.3, 4.2, 2.6, 2.6, term)
      pen.ellipse(7.6, 3.6, 2.2, 2.2, term)
      pen.ellipse(4.8, 7.6, 2.2, 2.2, term)
    },
  })
}

// The FAIR trader behind a market stall: a striped awning, a counter with a "FAIR trade" sign,
// a heap of Ontology Fragments, a card and a flask on top. The sprite stands on the bottom centre of
// the stall. The stall without him is drawn on its own (stallArt), and so is the trader as a fighter
// with a full body (traderFighterArt).
export const TRADER_WIDTH = 72
export const TRADER_HEIGHT = 72
const SKIN = '#f6d7b8'
const ROBE = { tint: '#9ad8c9', hatch: '#22c3a6' }
const HAT = { tint: '#7a5a3a', hatch: '#5a3f26' }

function stallBack(pen: Pen, w: number, h: number): void {
  pen.rect(5, 12, 3, h - 13, { ...wood, weight: 0.8, rough: 0.4 })
  pen.rect(w - 8, 12, 3, h - 13, { ...wood, weight: 0.8, rough: 0.4 })
}

// Robe, head, hat and a big moustache, with the hands on the counter.
function traderBehind(pen: Pen, mid: number): void {
  pen.poly([[mid - 11, 50], [mid - 8, 36], [mid + 8, 36], [mid + 11, 50]], { ...ROBE, gap: 2.2, weight: 1, rough: 0.5 })
  pen.poly([[mid - 3, 36], [mid, 41], [mid + 3, 36]], { tint: YELLOW, weight: 0.7, rough: 0.3 })
  pen.ellipse(mid, 29, 14, 14, { tint: SKIN, weight: 1, rough: 0.4 })
  pen.ellipse(mid, 23, 22, 4.5, { ...HAT, weight: 0.9, rough: 0.4 })
  pen.poly([[mid - 6, 22.5], [mid - 5, 15], [mid + 5, 15], [mid + 6, 22.5]], { ...HAT, fill: 'cross-hatch', gap: 2, weight: 0.9, rough: 0.4 })
  pen.line(mid - 5.6, 21, mid + 5.6, 21, { line: YELLOW, weight: 1.1, rough: 0.2 })
  pen.dot(mid - 2.6, 28.4, 0.9)
  pen.dot(mid + 2.6, 28.4, 0.9)
  pen.curve([[mid - 5, 32.6], [mid - 2.4, 31.4], [mid, 32], [mid + 2.4, 31.4], [mid + 5, 32.6]], { weight: 1.1, rough: 0.2 })
  pen.arc(mid, 33.4, 4, 2.4, 0.2, Math.PI - 0.2, false, { weight: 0.6, rough: 0.2 })
  pen.ellipse(mid - 9, 47, 4, 3, { tint: SKIN, weight: 0.7, rough: 0.3 })
  pen.ellipse(mid + 9, 47, 4, 3, { tint: SKIN, weight: 0.7, rough: 0.3 })
}

// Awning, counter and its sign, and the goods on top unless the stall is closed.
function stallFront(pen: Pen, w: number, h: number, sign: string, goods: boolean): void {
  const mid = w / 2
  pen.poly([[1, 4], [w - 1, 4], [w - 1, 14], [1, 14]], { ...wood, tint: CREAM, weight: 1.1, rough: 0.5 })
  for (let x = 1; x < w - 2; x += 14) pen.rect(x, 4, 7, 10, { tint: goods ? '#22c3a6' : '#9db3ad', line: 'none' })
  for (let x = 1; x < w - 2; x += 7) pen.arc(x + 3.5, 14, 7, 5, 0, Math.PI, false, { weight: 0.8, rough: 0.3 })
  pen.rect(7, 47, w - 14, h - 48, { ...wood, weight: 1.1, rough: 0.5 })
  pen.rect(13, 53, w - 26, 13, { tint: '#fffdf6', weight: 0.9, rough: 0.4 })
  pen.text([sign], mid, 59.6, 7.4, w - 30, -0.03, NAVY)
  if (!goods) return
  pen.poly([[11, 46.6], [13, 41.6], [16, 43], [17.6, 40.4], [21, 46.6]], { tint: '#fff3c4', hatch: YELLOW, gap: 1.5, weight: 0.6, rough: 0.3 })
  pen.line(13.6, 44.6, 17.4, 43.4, { line: NAVY, weight: 0.5, rough: 0.1 })
  pen.dot(13.6, 44.6, 0.9, TEAL)
  pen.dot(17.4, 43.4, 0.9, TEAL)
  pen.poly([[w - 22, 46], [w - 21, 38], [w - 15, 38.6], [w - 16, 46.6]], { tint: '#dbe8fd', hatch: BLUE, gap: 1.6, weight: 0.7, rough: 0.3 })
  pen.poly([[w - 12, 46], [w - 13.5, 42], [w - 11.6, 38.5], [w - 11.6, 36.5], [w - 9.4, 36.5], [w - 9.4, 38.5], [w - 7.5, 42], [w - 9, 46]], { tint: '#dcf1e2', hatch: '#2da44e', gap: 1.4, weight: 0.7, rough: 0.3 })
}

export function traderArt(scene: Phaser.Scene): SpriteRef {
  const w = TRADER_WIDTH
  const h = TRADER_HEIGHT
  return spriteFrom(scene, {
    key: 'scribble:trader',
    width: w,
    height: h,
    anchors: { weapon: { x: 0, y: -h / 2 }, head: { x: 0, y: -h + 6 } },
    draw(pen) {
      stallBack(pen, w, h)
      traderBehind(pen, w / 2)
      stallFront(pen, w, h, 'FAIR trade', true)
    },
  })
}

// The stall without the trader. 'empty' once he has vaulted over the counter, with the goods still
// on it. 'closed' in every later waystation of the run: no goods, a faded awning, a plank nailed
// across and cobwebs in the corners. The note on it is a Text of the scene.
export function stallArt(scene: Phaser.Scene, state: 'empty' | 'closed'): SpriteRef {
  const w = TRADER_WIDTH
  const h = TRADER_HEIGHT
  return spriteFrom(scene, {
    key: `scribble:stall:${state}`,
    width: w,
    height: h,
    anchors: { weapon: { x: 0, y: -h / 2 }, head: { x: 0, y: -h + 6 } },
    draw(pen) {
      stallBack(pen, w, h)
      if (state === 'empty') {
        stallFront(pen, w, h, 'FAIR trade', true)
        return
      }
      stallFront(pen, w, h, 'CLOSED', false)
      pen.poly([[6, 40], [w - 6, 30], [w - 6, 35], [6, 45]], { ...wood, weight: 1, rough: 0.5 })
      pen.dot(9, 42.4, 0.9)
      pen.dot(w - 9, 32.4, 0.9)
      pen.curve([[8.5, 15], [12, 19], [16, 15.5]], { line: '#9aa0a6', weight: 0.5, rough: 0.3 })
      pen.line(8.5, 15, 13.5, 21, { line: '#9aa0a6', weight: 0.4, rough: 0.2 })
      pen.curve([[w - 16, 15.5], [w - 12, 19], [w - 8.5, 15]], { line: '#9aa0a6', weight: 0.5, rough: 0.3 })
      pen.line(w - 8.5, 15, w - 13.5, 21, { line: '#9aa0a6', weight: 0.4, rough: 0.2 })
    },
  })
}

// The trader as a fighter: a full standing body in the proportions of the mage sprite, so the same
// player body, squash, lean and weapon poses fit him. Hat with its gold band, face and moustache
// turned right, a teal robe under a cream merchant apron with a fragment in its pocket, a belt and
// boots. One frame, drawn once.
export const TRADER_FIGHTER = { width: 30, height: 50 }

export function traderFighterArt(scene: Phaser.Scene): SpriteRef {
  const { width: w, height: h } = TRADER_FIGHTER
  const mid = w / 2
  return spriteFrom(scene, {
    key: 'scribble:trader:fighter',
    width: w,
    height: h,
    variants: 1,
    anchors: { weapon: { x: 6, y: -24 }, head: { x: 0, y: -h } },
    draw(pen) {
      // Boots and legs.
      pen.rect(mid - 6.5, 40, 4.6, 7.5, { tint: '#3b4a5c', weight: 0.8, rough: 0.3 })
      pen.rect(mid + 1.4, 40, 4.6, 7.5, { tint: '#3b4a5c', weight: 0.8, rough: 0.3 })
      pen.ellipse(mid - 3.6, 48, 7, 3.4, { tint: '#5a3f26', weight: 0.8, rough: 0.3 })
      pen.ellipse(mid + 4.6, 48, 7, 3.4, { tint: '#5a3f26', weight: 0.8, rough: 0.3 })
      // Robe, the apron over it, its straps and the pocket with a fragment.
      pen.poly([[mid - 9, 41.5], [mid - 7, 22], [mid + 7, 22], [mid + 9.5, 41.5]], { ...ROBE, gap: 2.2, weight: 1, rough: 0.5 })
      pen.poly([[mid - 5.5, 26], [mid + 6, 26], [mid + 7, 40.5], [mid - 6.5, 40.5]], { tint: CREAM, hatch: '#d9c3a5', gap: 2.6, weight: 0.9, rough: 0.4 })
      pen.line(mid - 5.5, 26, mid - 3, 22, { weight: 0.6, rough: 0.2 })
      pen.line(mid + 6, 26, mid + 3.5, 22, { weight: 0.6, rough: 0.2 })
      pen.rect(mid - 1.5, 31.5, 6.5, 5, { tint: '#fff3c4', weight: 0.6, rough: 0.2 })
      pen.poly([[mid + 0.4, 35.4], [mid + 1.4, 32.6], [mid + 2.8, 33.6], [mid + 3.8, 32.4], [mid + 3.4, 35.4]], { tint: '#fff3c4', hatch: YELLOW, gap: 1.2, weight: 0.5, rough: 0.2 })
      pen.line(mid - 7.2, 28.5, mid + 7.4, 28.5, { line: '#5a3f26', weight: 1, rough: 0.2 })
      pen.rect(mid - 1.2, 27.4, 2.6, 2.4, { tint: YELLOW, weight: 0.5, rough: 0.1 })
      // The back arm. The front hand holds the weapon, which the player body draws.
      pen.line(mid - 8, 23.5, mid - 10, 33, { line: TEAL, weight: 2.2, rough: 0.2 })
      pen.ellipse(mid - 10.2, 34, 3.4, 3.4, { tint: SKIN, weight: 0.6, rough: 0.2 })
      // Head, eyes, brows and the moustache, turned right.
      pen.ellipse(mid + 0.5, 15.5, 13, 13, { tint: SKIN, weight: 1, rough: 0.4 })
      pen.dot(mid + 2.4, 14.6, 0.9)
      pen.dot(mid + 5.6, 14.6, 0.9)
      pen.line(mid + 1.2, 12.2, mid + 3.6, 11.4, { weight: 0.7, rough: 0.2 })
      pen.line(mid + 4.6, 11.4, mid + 7, 12.2, { weight: 0.7, rough: 0.2 })
      pen.curve([[mid - 0.4, 18.6], [mid + 2, 17.4], [mid + 4, 18], [mid + 6, 17.4], [mid + 8.2, 18.6]], { weight: 1.2, rough: 0.2 })
      pen.arc(mid + 4, 19.6, 3.6, 2, 0.2, Math.PI - 0.2, false, { weight: 0.6, rough: 0.2 })
      // The hat: brim, crown and its gold band.
      pen.ellipse(mid + 0.5, 9.6, 21, 4.4, { ...HAT, weight: 0.9, rough: 0.4 })
      pen.poly([[mid - 5, 9.2], [mid - 4, 1.6], [mid + 5, 1.6], [mid + 6, 9.2]], { ...HAT, fill: 'cross-hatch', gap: 2, weight: 0.9, rough: 0.4 })
      pen.line(mid - 4.6, 7.6, mid + 5.6, 7.6, { line: YELLOW, weight: 1.1, rough: 0.2 })
    },
  })
}

// The ISA blocks of the ARCitect weapon: an Assay, a Study and an Investigation, each larger. A
// wooden crate with a coloured label and the letter on it. The sprite stands on the bottom centre.
export type IsaKind = 'assay' | 'study' | 'investigation'
export const ISA_BLOCKS: Record<IsaKind, { w: number; h: number; letter: string; tint: string; hatch: string }> = {
  assay: { w: 24, h: 14, letter: 'A', tint: '#cdf3ea', hatch: '#22c3a6' },
  study: { w: 30, h: 22, letter: 'S', tint: '#d3ecf7', hatch: '#4baed6' },
  investigation: { w: 36, h: 30, letter: 'I', tint: '#fff3c4', hatch: '#e5b92e' },
}

export function isaBlockArt(scene: Phaser.Scene, kind: IsaKind): SpriteRef {
  const { w, h, letter, tint, hatch } = ISA_BLOCKS[kind]
  return spriteFrom(scene, {
    key: `scribble:isa:${kind}`,
    width: w,
    height: h,
    anchors: { weapon: { x: 0, y: -h / 2 }, head: { x: 0, y: -h } },
    draw(pen) {
      pen.rect(0.8, 0.8, w - 1.6, h - 1.6, { ...wood, weight: 1.2, rough: 0.5 })
      pen.line(0.8, 0.8, w - 0.8, h - 0.8, { line: '#8a6238', weight: 0.7, rough: 0.3 })
      const lw = Math.min(w - 8, 16)
      const lh = Math.min(h - 6, 11)
      pen.rect(w / 2 - lw / 2, h / 2 - lh / 2, lw, lh, { tint, hatch, gap: 2, weight: 0.9, rough: 0.3 })
      pen.text([letter], w / 2, h / 2 + 0.4, Math.min(9, lh - 1), lw - 2, 0, NAVY)
    },
  })
}

export const CARD_WIDTH = 100
export const CARD_HEIGHT = 136

export const RARITY_COLOR: Record<Rarity, number> = {
  common: 0x9aa0a6,
  uncommon: 0x2da44e,
  rare: 0x3b82f6,
  legendary: PALETTE.yellow,
}

const RARITY_TINT: Record<Rarity, string> = {
  common: '#eceef0',
  uncommon: '#dcf1e2',
  rare: '#dbe8fd',
  legendary: '#fff0b3',
}

const CARD_OUTLINE: Pt[] = [
  [7, 1.5], [93, 1.5], [98.5, 7], [98.5, 129], [93, 134.5], [7, 134.5], [1.5, 129], [1.5, 7],
]

// The round sticker in the middle of a card, centred on (50, 47).
function stickerIcon(pen: Pen, kind: PowerUpKind, hatch: string): void {
  if (kind === 'stat') {
    pen.rect(46, 34, 8, 3.4, { ...wood, weight: 0.8, rough: 0.3 })
    pen.poly([[47.2, 37.4], [52.8, 37.4], [52.8, 43], [60, 56], [40, 56], [47.2, 43]], { tint: 'rgba(214, 238, 248, 0.9)', weight: 1, rough: 0.4 })
    pen.poly([[44.4, 50], [55.6, 50], [60, 56], [40, 56]], { tint: hatch, hatch, gap: 1.6, weight: 0.8, rough: 0.3 })
    pen.ellipse(48.4, 52.6, 2.4, 2.4, { tint: '#ffffff', weight: 0.6, rough: 0.2 })
    pen.ellipse(52.6, 47, 1.8, 1.8, { tint: '#ffffff', weight: 0.6, rough: 0.2 })
  } else if (kind === 'weapon') {
    pen.line(38, 59, 62, 35, { line: '#8a6238', weight: 2.2, rough: 0.3 })
    pen.ellipse(62.5, 34.5, 7, 7, { tint: '#cfeaf8', hatch, gap: 1.6, weight: 0.9, rough: 0.3 })
    pen.line(62, 59, 38, 35, { line: '#6b7480', weight: 1.8, rough: 0.3 })
    pen.poly(starPts(37.5, 34.5, 5.2, 2, 4), { ...gold, weight: 0.8, rough: 0.2 })
  } else if (kind === 'mechanic') {
    pen.poly(gearPts(50, 47, 13, 9.5, 8), { ...metal, gap: 2, weight: 1.1, rough: 0.4 })
    pen.ellipse(50, 47, 8, 8, { tint: '#ffffff', weight: 0.9, rough: 0.3 })
    pen.dot(50, 47, 1.3)
  } else {
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2
      pen.line(50 + Math.cos(a) * 12, 47 + Math.sin(a) * 12, 50 + Math.cos(a) * 15, 47 + Math.sin(a) * 15, { weight: 0.9, rough: 0.2, line: '#e5b92e' })
    }
    pen.poly(starPts(50, 47, 12, 5.4, 5), { ...gold, weight: 1.1, rough: 0.4 })
  }
}

// A paper trading card for a level-up offer, 100 x 136 world units. It leaves the name, the
// description and the key number to Text objects. Those sit at the header band (name, y 5 to 28),
// under the sticker (description, y 66 to 114) and on the bottom row (key at x 14, rarity at x 50).
export function cardArt(scene: Phaser.Scene, rarity: Rarity, kind: PowerUpKind): SpriteRef {
  const hatch = cssColor(RARITY_COLOR[rarity])
  const tint = RARITY_TINT[rarity]
  return spriteFrom(scene, {
    key: `scribble:card:${rarity}:${kind}`,
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    anchors: { weapon: { x: 0, y: -CARD_HEIGHT / 2 }, head: { x: 0, y: -CARD_HEIGHT } },
    draw(pen) {
      pen.poly(CARD_OUTLINE, { tint: '#fffdf6', weight: 1.7, rough: 0.7 })
      pen.poly([[5, 5], [95, 5], [95, 28], [5, 28]], { tint, hatch, fill: rarity === 'legendary' ? 'cross-hatch' : 'hachure', gap: 2.2, weight: 1, rough: 0.5 })
      pen.ellipse(50, 47, 33, 33, { tint: '#ffffff', hatch, gap: 3, weight: 1.3, rough: 0.5 })
      stickerIcon(pen, kind, hatch)
      pen.trace(wavePts(12, 64, 88, 64, 1, 7), { line: hatch, weight: 0.9, rough: 0.3 })
      pen.ellipse(14, 126, 12, 12, { tint, weight: 0.9, rough: 0.3 })
      pen.line(24, 126, 36, 126, { line: hatch, weight: 0.8, rough: 0.2 })
      pen.line(64, 126, 76, 126, { line: hatch, weight: 0.8, rough: 0.2 })
      pen.poly(starPts(88, 126, 5, 2, 5), { tint, hatch, gap: 1.4, weight: 0.8, rough: 0.2 })
      sparkle(pen, 19, 40, 3.2, hatch)
      sparkle(pen, 80, 54, 2.6, hatch)
      pen.dot(24, 56, 1, hatch)
      pen.dot(77, 38, 1, hatch)
    },
  })
}

const GLOW_KEY = 'scribble:card:glow'

// A soft white disc that fades to nothing at the rim. Tint it to the colour of the glow.
export function glowTexture(scene: Phaser.Scene): string {
  return cached(scene, GLOW_KEY, () => {
    const canvas = document.createElement('canvas')
    canvas.width = 64
    canvas.height = 64
    const ctx = artContext(canvas)
    if (ctx) {
      const gradient = ctx.createRadialGradient(32, 32, 4, 32, 32, 32)
      gradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)')
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, 64, 64)
    }
    scene.textures.create(GLOW_KEY, canvas)?.add('__BASE', 0, 0, 0, 64, 64)
    return GLOW_KEY
  })
}
