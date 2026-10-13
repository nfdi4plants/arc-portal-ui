import type { EnemyWeaponKind } from '../../contracts/content'
import { starPts, wavePts } from './geometry'
import { ENEMY_WEAPON } from './layout'
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

export function drawEnemyWeapon(pen: Pen, kind: EnemyWeaponKind, hand: { x: number; y: number }, length: number, sw: Swatch): void {
  pen.at(hand.x, hand.y, ENEMY_WEAPON[kind].angle, () => ENEMY_WEAPON_DRAW[kind](pen, length, sw))
}
