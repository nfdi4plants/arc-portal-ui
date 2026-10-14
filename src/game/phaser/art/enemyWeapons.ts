import type { EnemyWeaponKind } from '../../contracts/content'
import { starPts, wavePts } from './geometry'
import { bone, fire, glass, gold, metal, wood } from './looks'
import { MATERIAL } from './palette'
import type { Swatch } from './palette'
import type { Pen } from './pen'

// Each weapon is drawn pointing along +x from the hand, L is its length in world units.
type WeaponDraw = (pen: Pen, L: number, sw: Swatch) => void

const claw: WeaponDraw = (pen, L) => {
  pen.ellipse(0.2 * L, 0, 0.55 * L, 0.55 * L, bone)
  for (const dy of [-0.3, 0, 0.3]) {
    pen.poly([[0.4 * L, (dy - 0.1) * L], [L, dy * 1.7 * L], [0.4 * L, (dy + 0.1) * L]], { ...bone, weight: 1 })
  }
}

const spear: WeaponDraw = (pen, L) => {
  pen.line(-0.4 * L, 0, 0.58 * L, 0, { line: MATERIAL.wood.dark, weight: 1.6, rough: 0.5 })
  pen.poly([[0.5 * L, -0.08 * L], [0.75 * L, 0], [0.5 * L, 0.08 * L]], metal)
  pen.poly([[-0.4 * L, 0], [-0.5 * L, -0.07 * L], [-0.46 * L, 0.07 * L]], { tint: '#e5484d', weight: 0.8 })
}

const bow: WeaponDraw = (pen, L) => {
  pen.curve([[0.05 * L, -0.5 * L], [0.45 * L, 0], [0.05 * L, 0.5 * L]], { line: MATERIAL.wood.dark, weight: 1.7, rough: 0.6 })
  pen.line(0.05 * L, -0.5 * L, 0.05 * L, 0.5 * L, { weight: 0.6, rough: 0.2 })
  pen.line(-0.25 * L, 0, 0.35 * L, 0, { weight: 0.9, rough: 0.3 })
  pen.poly([[0.3 * L, -0.06 * L], [0.42 * L, 0], [0.3 * L, 0.06 * L]], metal)
}

const wand: WeaponDraw = (pen, L) => {
  pen.line(-0.25 * L, 0, 0.62 * L, 0, { line: MATERIAL.wood.dark, weight: 1.5, rough: 0.5 })
  pen.poly(starPts(0.66 * L, 0, 0.17 * L, 0.07 * L, 5), { ...gold, weight: 0.9, rough: 0.5 })
  pen.line(0.45 * L, -0.28 * L, 0.5 * L, -0.2 * L, { weight: 0.8, rough: 0.2 })
  pen.line(0.45 * L, 0.28 * L, 0.5 * L, 0.2 * L, { weight: 0.8, rough: 0.2 })
}

const bomb: WeaponDraw = (pen, L, sw) => {
  pen.trace([[0.35 * L, -0.3 * L], [0.42 * L, -0.5 * L], [0.55 * L, -0.55 * L]], { weight: 1, rough: 0.3 })
  pen.poly(starPts(0.58 * L, -0.56 * L, 0.14 * L, 0.06 * L, 4), { ...fire, weight: 0.7, rough: 0.3 })
  pen.ellipse(0.35 * L, 0.05 * L, 0.68 * L, 0.68 * L, { tint: sw.dark, hatch: MATERIAL.ink, fill: 'cross-hatch', gap: 2 })
  pen.curve([[0.15 * L, -0.02 * L], [0.2 * L, -0.12 * L], [0.3 * L, -0.15 * L]], { line: '#ffffff', weight: 0.9, rough: 0.2 })
}

const shield: WeaponDraw = (pen, L, sw) => {
  pen.ellipse(0.4 * L, 0, 0.8 * L, 1.1 * L, { tint: sw.mid, hatch: sw.dark, fill: 'cross-hatch', gap: 2.6 })
  pen.ellipse(0.4 * L, 0, 0.3 * L, 0.3 * L, { ...metal, weight: 0.9, rough: 0.4 })
  pen.line(0.4 * L, -0.45 * L, 0.4 * L, 0.45 * L, { weight: 0.8, rough: 0.3 })
}

const whip: WeaponDraw = (pen, L) => {
  pen.line(-0.25 * L, 0, 0.1 * L, 0, { line: MATERIAL.wood.dark, weight: 2.1, rough: 0.4 })
  pen.trace(wavePts(0.1 * L, 0, L, -0.1 * L, 0.18 * L, 1.5, 12), { weight: 1.1, rough: 0.5 })
  pen.line(L, -0.1 * L, 1.08 * L, -0.2 * L, { weight: 0.8, rough: 0.2 })
  pen.line(L, -0.1 * L, 1.08 * L, 0, { weight: 0.8, rough: 0.2 })
}

const flask: WeaponDraw = (pen, L, sw) => {
  pen.poly([[0, -0.32 * L], [0.45 * L, -0.1 * L], [0.6 * L, -0.1 * L], [0.6 * L, 0.1 * L], [0.45 * L, 0.1 * L], [0, 0.32 * L]], glass)
  pen.poly([[0.02 * L, -0.27 * L], [0.25 * L, -0.16 * L], [0.25 * L, 0.16 * L], [0.02 * L, 0.27 * L]], { tint: sw.accent, hatch: sw.accentDark, rough: 0.5, weight: 0.8, gap: 2 })
  pen.rect(0.6 * L, -0.1 * L, 0.1 * L, 0.2 * L, wood)
  pen.ellipse(0.12 * L, -0.05 * L, 0.07 * L, 0.07 * L, { tint: '#ffffff', weight: 0.6, rough: 0.2 })
}

export const ENEMY_WEAPON_DRAW: Record<EnemyWeaponKind, WeaponDraw> = { claw, spear, bow, wand, bomb, shield, whip, flask }

// Mobs hold their weapon as a sprite of its own, so it can swing. Its length scales with the body
// height and only mildly with the weapon scale, so a small monster's claw still reads as a claw and a
// large monster's spear does not dwarf the 48 unit mage.
const WEAPON_SIZE: Record<EnemyWeaponKind, number> = {
  claw: 0.6,
  spear: 1.3,
  bow: 0.95,
  wand: 0.9,
  bomb: 0.6,
  shield: 0.8,
  whip: 1.1,
  flask: 0.65,
}

export function enemyWeaponLength(kind: EnemyWeaponKind, bodyHeight: number, scale: number): number {
  const base = 15 + bodyHeight / 2
  return WEAPON_SIZE[kind] * base * Math.min(1.6, Math.max(0.75, scale)) ** 0.6
}

// What each drawing covers, in multiples of its length, with the hand at (0, 0).
const WEAPON_BOUNDS: Record<EnemyWeaponKind, { x0: number; x1: number; y0: number; y1: number }> = {
  claw: { x0: -0.1, x1: 1.02, y0: -0.55, y1: 0.55 },
  spear: { x0: -0.52, x1: 0.78, y0: -0.1, y1: 0.1 },
  bow: { x0: -0.28, x1: 0.48, y0: -0.52, y1: 0.52 },
  wand: { x0: -0.28, x1: 0.85, y0: -0.3, y1: 0.3 },
  bomb: { x0: -0.02, x1: 0.74, y0: -0.72, y1: 0.41 },
  shield: { x0: -0.03, x1: 0.83, y0: -0.58, y1: 0.58 },
  whip: { x0: -0.28, x1: 1.1, y0: -0.32, y1: 0.22 },
  flask: { x0: -0.02, x1: 0.72, y0: -0.34, y1: 0.34 },
}

// The business end (blade tip, arrow head, star, bottle) along the weapon, as a multiple of its length.
export const WEAPON_TIP: Record<EnemyWeaponKind, number> = {
  claw: 1,
  spear: 0.75,
  bow: 0.42,
  wand: 0.7,
  bomb: 0.35,
  shield: 0.8,
  whip: 1.08,
  flask: 0.4,
}

// Room for the line weight and the roughness around the drawing.
const WEAPON_MARGIN = 2

export interface WeaponFrame {
  // Frame size in world units.
  width: number
  height: number
  // Where the hand sits in the frame, from its top left.
  handX: number
  handY: number
}

export function enemyWeaponFrame(kind: EnemyWeaponKind, length: number): WeaponFrame {
  const b = WEAPON_BOUNDS[kind]
  return {
    width: Math.ceil((b.x1 - b.x0) * length + WEAPON_MARGIN * 2),
    height: Math.ceil((b.y1 - b.y0) * length + WEAPON_MARGIN * 2),
    handX: WEAPON_MARGIN - b.x0 * length,
    handY: WEAPON_MARGIN - b.y0 * length,
  }
}

// Draws the weapon pointing along +x with the hand at the frame's hand point. The sprite rotates it.
export function drawEnemyWeapon(pen: Pen, kind: EnemyWeaponKind, frame: WeaponFrame, length: number, sw: Swatch): void {
  pen.at(frame.handX, frame.handY, 0, () => ENEMY_WEAPON_DRAW[kind](pen, length, sw))
}
