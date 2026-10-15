import type Phaser from 'phaser'
import type { SpriteRef } from '../../contracts/art'
import { PALETTE } from '../../contracts/constants'
import { spriteFrom } from './atlas'
import type { Pt } from './geometry'
import { metal, darkMetal, wood } from './looks'
import { cssColor } from './palette'
import type { Pen } from './pen'

// The Datenkrake of the waystation, its tentacles, the kraken intern of the Deprecated jump() curse
// with its bridge planks, and the glitched card of a corrupted augment. Drawn once and cached like
// every other scribble texture, with the usual boiling variants.

const NAVY = cssColor(PALETTE.navy)
const YELLOW = cssColor(PALETTE.yellow)
const TEAL = cssColor(PALETTE.teal)
const PURPLE = '#8e44c9'
const PURPLE_LIGHT = '#d9b8f2'
const PURPLE_DARK = '#4b1d6e'
const SUCKER = '#f4dcff'
const MAGENTA = '#ff3df2'
const CYAN = '#29e0ff'

// The mark of a corrupted augment wherever a rarity colour goes (recap, history, build chips).
export const CORRUPTED_COLOR = 0xb04cff

export const DATENKRAKE_WIDTH = 96
export const DATENKRAKE_HEIGHT = 80
// Where the tentacle sprites are attached, from the bottom centre of the body sprite.
export const DATENKRAKE_ARMS: readonly { x: number; y: number; angle: number }[] = [
  { x: -30, y: -10, angle: -0.9 },
  { x: -14, y: -6, angle: -0.35 },
  { x: 14, y: -6, angle: 0.35 },
  { x: 30, y: -10, angle: 0.9 },
]

// The kraken sits on a heap of cables in front of a humming server rack: a big purple mantle with a
// "cookie" in one curl, round reading glasses and a lanyard badge that says DATENKRAKE.
export function datenkrakeArt(scene: Phaser.Scene): SpriteRef {
  const w = DATENKRAKE_WIDTH
  const h = DATENKRAKE_HEIGHT
  const mid = w / 2
  return spriteFrom(scene, {
    key: 'scribble:datenkrake',
    width: w,
    height: h,
    anchors: { weapon: { x: 0, y: -h / 2 }, head: { x: 0, y: -h + 4 } },
    draw(pen) {
      // The server rack behind, with blinking lights.
      pen.rect(w - 30, 8, 26, h - 9, { ...darkMetal, weight: 1, rough: 0.5 })
      for (let y = 13; y < h - 6; y += 8) {
        pen.rect(w - 27, y, 20, 5, { ...metal, weight: 0.6, rough: 0.3 })
        pen.dot(w - 11, y + 2.5, 0.9, y % 16 === 13 ? TEAL : YELLOW)
      }
      // Cables pouring out of the rack onto the floor.
      pen.curve([[w - 26, h - 20], [w - 40, h - 8], [w - 60, h - 3]], { line: NAVY, weight: 1.1, rough: 0.4 })
      pen.curve([[w - 24, h - 30], [w - 46, h - 14], [w - 70, h - 2]], { line: TEAL, weight: 1, rough: 0.4 })
      // The mantle.
      const mantle: Pt[] = [
        [mid - 26, h - 14], [mid - 30, h - 34], [mid - 22, h - 58], [mid, h - 70], [mid + 22, h - 58], [mid + 28, h - 34], [mid + 24, h - 14], [mid - 26, h - 14],
      ]
      pen.curve(mantle, { tint: PURPLE_LIGHT, hatch: PURPLE, gap: 2.4, weight: 1.4, rough: 0.6 })
      // Spots.
      pen.ellipse(mid - 12, h - 52, 5, 4, { tint: PURPLE, weight: 0.6, rough: 0.3 })
      pen.ellipse(mid + 10, h - 58, 4, 3, { tint: PURPLE, weight: 0.6, rough: 0.3 })
      pen.ellipse(mid + 16, h - 44, 3, 3, { tint: PURPLE, weight: 0.6, rough: 0.3 })
      // Curled tentacles on the floor.
      for (const [x, dir] of [[mid - 20, -1], [mid - 8, -1], [mid + 8, 1], [mid + 20, 1]] as const) {
        pen.curve([[x, h - 16], [x + dir * 6, h - 6], [x + dir * 13, h - 3], [x + dir * 16, h - 8], [x + dir * 12, h - 11]], {
          line: PURPLE_DARK,
          weight: 3,
          rough: 0.4,
        })
        pen.dot(x + dir * 9, h - 4.5, 0.9, SUCKER)
      }
      // Glasses and eyes.
      pen.ellipse(mid - 9, h - 40, 13, 13, { tint: '#ffffff', weight: 1.1, rough: 0.3 })
      pen.ellipse(mid + 9, h - 40, 13, 13, { tint: '#ffffff', weight: 1.1, rough: 0.3 })
      pen.line(mid - 2.5, h - 41, mid + 2.5, h - 41, { weight: 1, rough: 0.2 })
      pen.dot(mid - 7.4, h - 39, 2.4)
      pen.dot(mid + 10.6, h - 39, 2.4)
      pen.dot(mid - 6.6, h - 40, 0.8, '#ffffff')
      pen.dot(mid + 11.4, h - 40, 0.8, '#ffffff')
      // A smug grin.
      pen.arc(mid + 1, h - 30, 12, 6, 0.15, Math.PI - 0.15, false, { weight: 1, rough: 0.2 })
      // Lanyard and badge.
      pen.trace([[mid - 10, h - 30], [mid - 2, h - 21], [mid + 6, h - 30]], { line: TEAL, weight: 0.8, rough: 0.2 })
      pen.rect(mid - 9, h - 22, 14, 8, { tint: '#fffdf6', weight: 0.7, rough: 0.2 })
      pen.text(['DATEN', 'KRAKE'], mid - 2, h - 18, 3.2, 12, 0, PURPLE_DARK)
      // A cookie in the curl of the left floor tentacle.
      pen.ellipse(mid - 34, h - 7, 9, 9, { tint: '#d9a35f', hatch: '#a8733a', gap: 2.2, weight: 0.8, rough: 0.4 })
      pen.dot(mid - 35.5, h - 8, 0.8)
      pen.dot(mid - 32.5, h - 6, 0.8)
      // A USB stick, half swallowed.
      pen.rect(mid + 30, h - 12, 9, 5, { ...metal, weight: 0.7, rough: 0.2 })
      pen.rect(mid + 27, h - 12, 4, 5, { tint: NAVY, weight: 0.7, rough: 0.2 })
    },
  })
}

export const ARM_LENGTH = 44
const ARM_WIDTH = 12

// One tentacle, standing upright with its base at the origin, so a sprite rotates around the base
// and stretches with scaleY to reach the mage.
export function datenkrakeArmArt(scene: Phaser.Scene): SpriteRef {
  return spriteFrom(scene, {
    key: 'scribble:datenkrake:arm',
    width: ARM_WIDTH,
    height: ARM_LENGTH,
    anchors: { weapon: { x: 0, y: -ARM_LENGTH }, head: { x: 0, y: -ARM_LENGTH } },
    draw(pen) {
      const c = ARM_WIDTH / 2
      const outline: Pt[] = [
        [c - 4.5, ARM_LENGTH], [c - 3.5, ARM_LENGTH * 0.6], [c - 2.5, ARM_LENGTH * 0.25], [c - 0.5, 3], [c + 2.6, 1.5], [c + 2.2, 5], [c + 1.6, ARM_LENGTH * 0.25], [c + 3, ARM_LENGTH * 0.6], [c + 4.5, ARM_LENGTH], [c - 4.5, ARM_LENGTH],
      ]
      pen.curve(outline, { tint: PURPLE_LIGHT, hatch: PURPLE, gap: 2, weight: 1, rough: 0.4 })
      for (let y = 8; y < ARM_LENGTH - 2; y += 6) pen.dot(c - 0.4 + (y / ARM_LENGTH) * 0.6, y, 0.6 + (y / ARM_LENGTH) * 0.8, SUCKER)
    },
  })
}

export const INTERN_WIDTH = 24
export const INTERN_HEIGHT = 20

// The kraken intern of Deprecated jump(): a small kraken in a yellow hard hat with a hammer.
export function krakenInternArt(scene: Phaser.Scene): SpriteRef {
  const w = INTERN_WIDTH
  const h = INTERN_HEIGHT
  const mid = w / 2
  return spriteFrom(scene, {
    key: 'scribble:datenkrake:intern',
    width: w,
    height: h,
    anchors: { weapon: { x: 6, y: -h / 2 }, head: { x: 0, y: -h } },
    draw(pen) {
      for (const dx of [-7, -3, 3, 7]) pen.curve([[mid + dx * 0.6, h - 6], [mid + dx, h - 2], [mid + dx * 1.3, h - 1]], { line: PURPLE_DARK, weight: 1.6, rough: 0.3 })
      pen.curve([[mid - 8, h - 5], [mid - 9, h - 12], [mid, h - 16], [mid + 9, h - 12], [mid + 8, h - 5], [mid - 8, h - 5]], {
        tint: PURPLE_LIGHT,
        hatch: PURPLE,
        gap: 2,
        weight: 1,
        rough: 0.4,
      })
      pen.dot(mid - 3, h - 10, 1.3)
      pen.dot(mid + 3, h - 10, 1.3)
      pen.arc(mid, h - 7.5, 5, 2.4, 0.2, Math.PI - 0.2, false, { weight: 0.6, rough: 0.2 })
      // Hard hat.
      pen.arc(mid, h - 14, 16, 9, Math.PI, Math.PI * 2, true, { tint: YELLOW, hatch: '#d49a00', gap: 1.6, weight: 0.9, rough: 0.3 })
      pen.line(mid - 9, h - 14, mid + 9, h - 14, { weight: 1.1, rough: 0.2 })
      // Hammer.
      pen.line(mid + 9, h - 6, mid + 11, h - 14, { ...wood, line: '#8a6238', weight: 1.2, rough: 0.2 })
      pen.rect(mid + 9, h - 17, 5, 3, { ...metal, weight: 0.7, rough: 0.2 })
    },
  })
}

export const PLANK_WIDTH = 12
export const PLANK_HEIGHT = 8

// One plank of the intern's bridge, with the cable it hangs on. A bridge is a row of them.
export function bridgePlankArt(scene: Phaser.Scene): SpriteRef {
  return spriteFrom(scene, {
    key: 'scribble:datenkrake:plank',
    width: PLANK_WIDTH,
    height: PLANK_HEIGHT,
    anchors: { weapon: { x: 0, y: -PLANK_HEIGHT }, head: { x: 0, y: -PLANK_HEIGHT } },
    draw(pen) {
      pen.rect(0.6, 1.5, PLANK_WIDTH - 1.2, 5, { ...wood, weight: 0.9, rough: 0.4 })
      pen.line(0, 1, PLANK_WIDTH, 1, { line: TEAL, weight: 0.8, rough: 0.2 })
      pen.dot(3, 4, 0.6)
      pen.dot(PLANK_WIDTH - 3, 4, 0.6)
    },
  })
}

export const CORRUPTED_CARD_WIDTH = 100
export const CORRUPTED_CARD_HEIGHT = 136

// The card of a corrupted augment: the paper card gone wrong. A dark purple face with scan lines,
// glitched bars of magenta and cyan, a cracked floppy disk with a tentacle coming out of it, and
// dark boxes where the scene writes the boon (green) and the curse (red).
export function corruptedCardArt(scene: Phaser.Scene): SpriteRef {
  const W = CORRUPTED_CARD_WIDTH
  const H = CORRUPTED_CARD_HEIGHT
  return spriteFrom(scene, {
    key: 'scribble:card:corrupted',
    width: W,
    height: H,
    anchors: { weapon: { x: 0, y: -H / 2 }, head: { x: 0, y: -H } },
    draw(pen, variant) {
      const outline: Pt[] = [[7, 1.5], [93, 1.5], [98.5, 7], [98.5, 129], [93, 134.5], [7, 134.5], [1.5, 129], [1.5, 7]]
      pen.poly(outline, { tint: '#1d1028', weight: 1.7, rough: 0.7 })
      // Scan lines.
      for (let y = 4; y < H - 3; y += 3) pen.line(3, y, W - 3, y, { line: 'rgba(176, 76, 255, 0.18)', weight: 0.5, rough: 0 })
      // Glitch bars, shifted in every variant so the boiling flickers.
      const shift = (variant - 1) * 2.5
      glitchBar(pen, 4 + shift, 30, 40, MAGENTA)
      glitchBar(pen, 52 - shift, 61, 30, CYAN)
      glitchBar(pen, 12 + shift, 117, 50, MAGENTA)
      pen.poly([[5, 5], [95, 5], [95, 28], [5, 28]], { tint: '#3a1557', hatch: PURPLE, fill: 'cross-hatch', gap: 2.2, weight: 1, rough: 0.5 })
      // The sticker: a cracked floppy disk with a tentacle.
      pen.rect(38, 34, 24, 24, { tint: '#2a2a3a', hatch: PURPLE_DARK, gap: 2, weight: 1.1, rough: 0.4 })
      pen.rect(43, 34, 14, 8, { tint: '#c9ccd6', weight: 0.8, rough: 0.3 })
      pen.rect(42, 48, 16, 10, { tint: '#fffdf6', weight: 0.7, rough: 0.3 })
      pen.trace([[50, 34], [47, 41], [53, 46], [49, 58]], { line: MAGENTA, weight: 1, rough: 0.3 })
      pen.curve([[60, 52], [67, 47], [66, 39], [71, 35], [74, 38]], { line: PURPLE_LIGHT, weight: 2.6, rough: 0.3 })
      pen.dot(67, 44, 0.7, SUCKER)
      // Boon and curse boxes.
      pen.rect(7, 66, 86, 23, { tint: 'rgba(34, 195, 120, 0.18)', line: '#2da44e', weight: 0.9, rough: 0.3 })
      pen.rect(7, 92, 86, 23, { tint: 'rgba(217, 83, 79, 0.18)', line: '#d9534f', weight: 0.9, rough: 0.3 })
      pen.ellipse(14, 126, 12, 12, { tint: '#3a1557', weight: 0.9, rough: 0.3 })
    },
  })
}

function glitchBar(pen: Pen, x: number, y: number, w: number, color: string): void {
  pen.rect(x, y, w, 1.6, { tint: color, line: 'none' })
}
