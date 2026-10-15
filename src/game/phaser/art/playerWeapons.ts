import type Phaser from 'phaser'
import type { SpriteRef } from '../../contracts/art'
import type { PlayerWeaponId } from '../../contracts/progression'
import { PALETTE } from '../../contracts/constants'
import { spriteFrom } from './atlas'
import { starPts, wavePts } from './geometry'
import { fire, glass, gold, metal, wood } from './looks'
import { MATERIAL, cssColor } from './palette'
import type { Pen } from './pen'

// Weapons stand upright with the grip at the bottom centre of the sprite, which is the sprite
// origin, so rotating the sprite swings the weapon around the hand. Tier 2 is the doubled or
// overclocked version with a glow.

interface WeaponDef {
  // World units for tier 1 and tier 2.
  size: [[number, number], [number, number]]
  // Business end (tip or head centre) for tier 1 and tier 2, in frame coordinates.
  tip: [[number, number], [number, number]]
  draw(pen: Pen, tier: 1 | 2, w: number, h: number): void
}

const blue = { tint: '#d3ecf7', hatch: cssColor(PALETTE.blue) }
const teal = { tint: '#cdf3ea', hatch: cssColor(PALETTE.teal) }
const HALO = 'rgba(255, 224, 110, 0.6)'

function sparkle(pen: Pen, x: number, y: number, r: number): void {
  pen.poly(starPts(x, y, r, r * 0.28, 4), { ...gold, weight: 0.6, rough: 0.2 })
}

function overclock(pen: Pen, x: number, y: number, r: number): void {
  pen.glow(x, y, r, HALO)
  sparkle(pen, x - r * 0.7, y - r * 0.5, 2.2)
  sparkle(pen, x + r * 0.7, y + r * 0.2, 1.8)
}

function stick(pen: Pen, x1: number, y1: number, x2: number, y2: number, weight = 2): void {
  pen.line(x1, y1, x2, y2, { line: MATERIAL.wood.dark, weight, rough: 0.4 })
}

function wandOne(pen: Pen, x: number, bottom: number, lean: number, h: number): void {
  pen.at(x, bottom, lean, () => {
    stick(pen, 0, 0, 0, -h * 0.78, 1.6)
    pen.poly(starPts(0, -h * 0.88, 6, 2.6, 5), { ...gold, weight: 0.9, rough: 0.4 })
    pen.rect(-1.6, -h * 0.2, 3.2, 3.5, { ...teal, weight: 0.7, rough: 0.2 })
  })
}

function scalpelOne(pen: Pen, x: number, bottom: number, lean: number, h: number): void {
  pen.at(x, bottom, lean, () => {
    pen.rect(-1.8, -h * 0.5, 3.6, h * 0.5, { ...metal, weight: 0.9, rough: 0.3 })
    pen.poly([[-1.8, -h * 0.5], [1.8, -h * 0.5], [2.4, -h * 0.85], [0, -h], [-1.8, -h * 0.8]], { ...metal, hatch: MATERIAL.metal.dark, weight: 0.9, rough: 0.3, gap: 1.8 })
  })
}

const staff: WeaponDef = {
  size: [[16, 54], [22, 58]],
  tip: [[8, 9], [11, 9]],
  draw(pen, tier, w, h) {
    const x = w / 2
    if (tier === 2) overclock(pen, x, 10, 13)
    stick(pen, x, h, x, 16, 2.4)
    pen.ellipse(x, 10, 12, 12, { ...blue, rough: 0.5 })
    pen.curve([[x - 5, 15], [x - 6, 11], [x - 3, 14]], { weight: 0.9, rough: 0.2 })
    pen.curve([[x + 5, 15], [x + 6, 11], [x + 3, 14]], { weight: 0.9, rough: 0.2 })
    if (tier === 2) {
      pen.ellipse(x, 10, 20, 7, { weight: 0.8, rough: 0.3 })
      pen.rect(x - 2.5, 24, 5, 3, gold)
    }
  },
}

const wand: WeaponDef = {
  size: [[14, 30], [28, 32]],
  tip: [[7, 4], [14, 3]],
  draw(pen, tier, w, h) {
    if (tier === 1) return wandOne(pen, w / 2, h, 0, h)
    overclock(pen, w / 2, 6, 12)
    wandOne(pen, w / 2 - 1, h, -0.28, h)
    wandOne(pen, w / 2 + 1, h, 0.28, h)
  },
}

const pipettePistol: WeaponDef = {
  size: [[18, 32], [28, 34]],
  tip: [[9, 1], [14, 1]],
  draw(pen, tier, w, h) {
    const barrel = (x: number) => {
      pen.rect(x - 2.4, 8, 4.8, 15, glass)
      pen.rect(x - 1.8, 14, 3.6, 8.5, { tint: 'rgba(120, 214, 190, 0.8)', hatch: cssColor(PALETTE.teal), line: 'none', gap: 1.6 })
      pen.poly([[x - 1.2, 8], [x + 1.2, 8], [x + 0.5, 1], [x - 0.5, 1]], { ...glass, weight: 0.8, rough: 0.2 })
      for (const y of [11, 15, 19]) pen.line(x + 2.4, y, x + 4, y, { weight: 0.6, rough: 0.1 })
    }
    if (tier === 2) overclock(pen, w / 2, 8, 12)
    if (tier === 1) barrel(w / 2)
    else {
      barrel(w / 2 - 5.5)
      barrel(w / 2 + 5.5)
    }
    pen.ellipse(w / 2, h - 6, tier === 1 ? 12 : 22, 11, { tint: '#f1a7a4', hatch: '#d96c68', rough: 0.5 })
    pen.rect(w / 2 - 3, 22, 6, 3, metal)
  },
}

const centrifugeDisc: WeaponDef = {
  size: [[26, 36], [30, 40]],
  tip: [[13, 13], [14, 13]],
  draw(pen, tier, w, h) {
    const x = w / 2
    if (tier === 2) overclock(pen, x, 13, 15)
    stick(pen, x, h, x, 24, 2)
    const disc = (cx: number, cy: number) => {
      pen.ellipse(cx, cy, 24, 24, { ...metal, gap: 2.4 })
      pen.ellipse(cx, cy, 6, 6, { tint: MATERIAL.white, weight: 0.8, rough: 0.2 })
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2
        pen.ellipse(cx + Math.cos(a) * 8, cy + Math.sin(a) * 8, 3.4, 3.4, { tint: MATERIAL.white, weight: 0.7, rough: 0.2 })
      }
    }
    if (tier === 2) disc(x + 2.5, 11)
    disc(x, 13)
  },
}

const scalpel: WeaponDef = {
  size: [[10, 34], [26, 36]],
  tip: [[5, 1], [13, 1]],
  draw(pen, tier, w, h) {
    if (tier === 1) return scalpelOne(pen, w / 2, h, 0, h)
    overclock(pen, w / 2, 8, 13)
    scalpelOne(pen, w / 2 - 1, h, -0.3, h)
    scalpelOne(pen, w / 2 + 1, h, 0.3, h)
  },
}

const sequenceWhip: WeaponDef = {
  size: [[18, 44], [24, 46]],
  tip: [[9, 3], [12, 3]],
  draw(pen, tier, w, h) {
    const x = w / 2
    const colors = ['#e5484d', '#22c3a6', '#f5be00', '#4baed6']
    if (tier === 2) overclock(pen, x, 12, 14)
    pen.rect(x - 2.4, h - 12, 4.8, 12, { ...wood, weight: 1 })
    const a = wavePts(x, h - 12, x, 3, 6, 2, 16)
    pen.trace(a, { weight: 1.5, rough: 0.5 })
    if (tier === 2) {
      const b = wavePts(x, h - 12, x, 3, -6, 2, 16)
      pen.trace(b, { weight: 1.5, rough: 0.5 })
      for (let i = 2; i < 16; i += 2) pen.line(a[i][0], a[i][1], b[i][0], b[i][1], { line: colors[i % 4], weight: 1.1, rough: 0.2 })
    } else {
      for (let i = 2; i < 16; i += 3) pen.line(a[i][0], a[i][1], a[i][0] + (i % 2 === 0 ? 3 : -3), a[i][1], { line: colors[i % 4], weight: 1.3, rough: 0.2 })
    }
  },
}

const beakerHammer: WeaponDef = {
  size: [[28, 40], [30, 42]],
  tip: [[14, 10], [15, 10]],
  draw(pen, tier, w, h) {
    const x = w / 2
    if (tier === 2) overclock(pen, x, 11, 16)
    stick(pen, x, h, x, 14, 2.6)
    pen.rect(2, 3, w - 4, 15, glass)
    pen.rect(3, tier === 2 ? 5 : 9, w - 6, tier === 2 ? 12 : 8, tier === 2 ? { tint: 'rgba(255, 224, 90, 0.8)', hatch: '#e5b92e', line: 'none', gap: 2 } : { tint: 'rgba(160, 200, 250, 0.8)', hatch: '#6a9ee0', line: 'none', gap: 2 })
    pen.rect(0, 2, 4, 17, { ...metal, weight: 1, rough: 0.3 })
    pen.rect(w - 4, 2, 4, 17, { ...metal, weight: 1, rough: 0.3 })
    for (const px of [10, 17]) pen.line(px, 6, px, 8.5, { weight: 0.6, rough: 0.1 })
    pen.ellipse(12, 12, 2.4, 2.4, { tint: MATERIAL.white, weight: 0.5, rough: 0.1 })
  },
}

const bunsenStaff: WeaponDef = {
  size: [[20, 52], [26, 56]],
  tip: [[10, 5], [13, 4]],
  draw(pen, tier, w, h) {
    const x = w / 2
    if (tier === 2) overclock(pen, x, 8, 15)
    stick(pen, x, h, x, 24, 2.4)
    pen.rect(x - 3.2, 18, 6.4, 12, { ...metal, rough: 0.4 })
    pen.rect(x - 4.6, 24, 9.2, 3, { tint: '#f4a14a', weight: 0.8, rough: 0.2 })
    const scale = tier === 2 ? 1.25 : 1
    pen.poly([[x, 18 - 17 * scale], [x + 4.4 * scale, 18 - 8 * scale], [x + 3.4 * scale, 18 - 1], [x - 3.4 * scale, 18 - 1], [x - 4.4 * scale, 18 - 9 * scale]], { ...fire, rough: 0.6 })
    pen.poly([[x, 18 - 9 * scale], [x + 2 * scale, 18 - 4], [x - 2 * scale, 18 - 4]], { tint: tier === 2 ? '#bfe6ff' : '#fff6cf', weight: 0.7, rough: 0.2 })
  },
}

const petriShield: WeaponDef = {
  size: [[30, 38], [34, 40]],
  tip: [[15, 17], [17, 18]],
  draw(pen, tier, w, h) {
    const x = w / 2
    const cy = tier === 2 ? 18 : 17
    if (tier === 2) overclock(pen, x, cy, 19)
    pen.rect(x - 2, cy + 10, 4, h - cy - 10, { ...wood, weight: 1, rough: 0.3 })
    pen.ellipse(x, cy, 28, 28, glass)
    pen.ellipse(x, cy, 21, 21, { tint: 'rgba(250, 190, 200, 0.7)', hatch: '#e58aa0', gap: 2.2, weight: 0.9, rough: 0.5 })
    for (const [dx, dy, r] of [[-5, -3, 3.4], [4, 2, 2.8], [-1, 6, 2.2], [6, -6, 2]]) pen.ellipse(x + dx, cy + dy, r, r, { tint: '#fff3c8', weight: 0.7, rough: 0.2 })
    if (tier === 2) {
      pen.ellipse(x, cy, 33, 33, { weight: 0.9, rough: 0.5 })
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2
        pen.poly([[x + Math.cos(a - 0.14) * 16, cy + Math.sin(a - 0.14) * 16], [x + Math.cos(a) * 20, cy + Math.sin(a) * 20], [x + Math.cos(a + 0.14) * 16, cy + Math.sin(a + 0.14) * 16]], { ...gold, weight: 0.7, rough: 0.2 })
      }
    }
  },
}

// The legendary weapons have one form, drawn the same at both tiers, with a gold legendary halo.
const LEGEND_HALO = 'rgba(245, 190, 0, 0.5)'

// ARCitect: a builder's rod topped with the ISA tree, an Investigation block over a Study and an
// Assay.
const arcitect: WeaponDef = {
  size: [[24, 44], [24, 44]],
  tip: [[12, 8], [12, 8]],
  draw(pen, _tier, w, h) {
    const x = w / 2
    pen.glow(x, 12, 13, LEGEND_HALO)
    stick(pen, x, h, x, 24, 2.4)
    pen.rect(x - 3, 22, 6, 3, gold)
    pen.line(x, 10, x - 6, 15, { weight: 0.7, rough: 0.2 })
    pen.line(x, 10, x + 6, 15, { weight: 0.7, rough: 0.2 })
    pen.rect(x - 7, 1, 14, 9, { tint: '#fff3c4', hatch: '#e5b92e', gap: 2, weight: 1, rough: 0.3 })
    pen.text(['I'], x, 5.8, 6.4, 10, 0, cssColor(PALETTE.navy))
    pen.rect(x - 11, 14, 9, 8, { ...blue, gap: 2, weight: 0.9, rough: 0.3 })
    pen.text(['S'], x - 6.5, 18.2, 5.4, 8, 0, cssColor(PALETTE.navy))
    pen.rect(x + 2, 14, 9, 8, { ...teal, gap: 2, weight: 0.9, rough: 0.3 })
    pen.text(['A'], x + 6.5, 18.2, 5.4, 8, 0, cssColor(PALETTE.navy))
  },
}

// ARC Commander: a terminal on a grip, its screen shows the prompt.
const arcCommander: WeaponDef = {
  size: [[24, 34], [24, 34]],
  tip: [[12, 8], [12, 8]],
  draw(pen, _tier, w, h) {
    const x = w / 2
    pen.glow(x, 9, 12, LEGEND_HALO)
    stick(pen, x, h, x, 18, 2.4)
    pen.rect(x - 11, 1, 22, 16, { ...metal, weight: 1.1, rough: 0.3 })
    pen.rect(x - 9, 3, 18, 12, { tint: cssColor(PALETTE.navy), weight: 0.8, rough: 0.2 })
    pen.text(['$_'], x, 9.4, 7, 16, 0, '#7ee8d0')
    pen.rect(x - 4, 17, 8, 3, gold)
  },
}

// Git LFS: one enormous file carried by its strap. It leaves the hand when thrown.
const gitLfs: WeaponDef = {
  size: [[30, 40], [30, 40]],
  tip: [[15, 14], [15, 14]],
  draw(pen, _tier, w, h) {
    const x = w / 2
    pen.glow(x, 14, 15, LEGEND_HALO)
    pen.line(x, h, x - 6, 27, { line: MATERIAL.wood.dark, weight: 1.6, rough: 0.3 })
    pen.line(x, h, x + 6, 27, { line: MATERIAL.wood.dark, weight: 1.6, rough: 0.3 })
    pen.poly([[3, 1], [21, 1], [27, 7], [27, 28], [3, 28]], { tint: '#fffdf6', hatch: '#9aa0a6', gap: 3, weight: 1.2, rough: 0.5 })
    pen.poly([[21, 1], [21, 7], [27, 7]], { tint: '#dfe3e6', weight: 0.9, rough: 0.3 })
    pen.rect(6, 11, 18, 8, { tint: '#f5be00', weight: 0.8, rough: 0.3 })
    pen.text(['LFS'], 15, 15.4, 6, 16, 0, cssColor(PALETTE.navy))
  },
}

// Publication Press: a heavy rubber stamp, its face reads DOI.
const publicationPress: WeaponDef = {
  size: [[32, 46], [32, 46]],
  tip: [[16, 9], [16, 9]],
  draw(pen, _tier, w, h) {
    const x = w / 2
    pen.glow(x, 10, 16, LEGEND_HALO)
    stick(pen, x, h, x, 20, 2.8)
    pen.ellipse(x, h - 4, 8, 7, { ...wood, weight: 0.9, rough: 0.3 })
    pen.rect(2, 4, w - 4, 13, { tint: '#e5484d', hatch: '#a8282d', gap: 2.4, weight: 1.2, rough: 0.4 })
    pen.rect(4, 1, w - 8, 4, gold)
    pen.rect(x - 4, 17, 8, 4, metal)
    pen.text(['DOI'], x, 11, 8, w - 8, 0, '#fffdf6')
  },
}

export const WEAPON_DEFS: Record<PlayerWeaponId, WeaponDef> = {
  staff,
  wand,
  pipettePistol,
  centrifugeDisc,
  scalpel,
  sequenceWhip,
  beakerHammer,
  bunsenStaff,
  petriShield,
  arcitect,
  arcCommander,
  gitLfs,
  publicationPress,
}

export function playerWeapon(scene: Phaser.Scene, id: PlayerWeaponId, tier: 1 | 2): SpriteRef {
  const def = WEAPON_DEFS[id]
  const [w, h] = def.size[tier - 1]
  const [tx, ty] = def.tip[tier - 1]
  const tip = { x: tx - w / 2, y: ty - h }
  return spriteFrom(scene, {
    key: `scribble:weapon:${id}:${tier}`,
    width: w,
    height: h,
    anchors: { weapon: tip, head: tip },
    draw: (pen) => def.draw(pen, tier, w, h),
  })
}
