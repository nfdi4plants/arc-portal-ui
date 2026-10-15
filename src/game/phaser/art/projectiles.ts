import type Phaser from 'phaser'
import type { ProjectileArt, SpriteRef } from '../../contracts/art'
import { PALETTE } from '../../contracts/constants'
import { spriteFrom } from './atlas'
import { starPts } from './geometry'
import { fire, gold, metal } from './looks'
import { MATERIAL, cssColor } from './palette'
import type { Pen } from './pen'

// Small shots, 6 to 14 world units. Elongated ones point right.

interface ProjectileDef {
  width: number
  height: number
  draw(pen: Pen): void
}

const thin = { weight: 0.8 }

const DEFS: Record<ProjectileArt, ProjectileDef> = {
  bolt: {
    width: 14,
    height: 8,
    draw(pen) {
      pen.line(0.8, 2.4, 3.6, 2.6, { weight: 0.7, rough: 0.1 })
      pen.line(0.8, 5.6, 3.6, 5.4, { weight: 0.7, rough: 0.1 })
      pen.poly([[3, 4], [7, 0.9], [13.4, 4], [7, 7.1]], { ...gold, ...thin, rough: 0.5, gap: 1.8 })
      pen.ellipse(8.2, 4, 2.4, 2.4, { tint: '#ffffff', line: 'none' })
    },
  },
  droplet: {
    width: 8,
    height: 11,
    draw(pen) {
      pen.poly([[4, 0.8], [6.8, 6], [6.5, 8.6], [4, 10.2], [1.5, 8.6], [1.2, 6]], { tint: '#cfeaf8', hatch: cssColor(PALETTE.blue), ...thin, rough: 0.4, gap: 1.6 })
      pen.ellipse(3, 7, 1.4, 1.8, { tint: '#ffffff', line: 'none' })
    },
  },
  disc: {
    width: 12,
    height: 12,
    draw(pen) {
      pen.ellipse(6, 6, 10.4, 10.4, { ...metal, ...thin, rough: 0.5, gap: 1.8 })
      pen.ellipse(6, 6, 3.4, 3.4, { tint: '#ffffff', weight: 0.7, rough: 0.2 })
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2 + 0.5
        pen.line(6 + Math.cos(a) * 2.4, 6 + Math.sin(a) * 2.4, 6 + Math.cos(a) * 4.8, 6 + Math.sin(a) * 4.8, { weight: 0.7, rough: 0.1 })
      }
    },
  },
  arrow: {
    width: 14,
    height: 5,
    draw(pen) {
      pen.line(1, 2.5, 11, 2.5, { line: MATERIAL.wood.dark, weight: 0.9, rough: 0.2 })
      pen.poly([[10, 0.5], [13.8, 2.5], [10, 4.5]], { ...metal, ...thin, rough: 0.2 })
      pen.poly([[0.4, 0.4], [3, 2.5], [0.4, 4.6], [1.6, 2.5]], { tint: '#e5484d', weight: 0.6, rough: 0.1 })
    },
  },
  bomb: {
    width: 10,
    height: 11,
    draw(pen) {
      pen.curve([[5.6, 3.2], [6.8, 1.6], [8.2, 1.2]], { weight: 0.8, rough: 0.1 })
      pen.poly(starPts(8.6, 1.4, 1.5, 0.6, 4), { ...fire, weight: 0.5, rough: 0.1 })
      pen.ellipse(5, 7, 8, 8, { tint: '#6e6a78', hatch: MATERIAL.ink, fill: 'cross-hatch', gap: 1.6, weight: 0.9, rough: 0.4 })
      pen.ellipse(3.2, 5.4, 1.6, 1.2, { tint: '#ffffff', line: 'none' })
    },
  },
  flame: {
    width: 9,
    height: 12,
    draw(pen) {
      pen.poly([[4.8, 0.6], [6.4, 3.4], [8.2, 6.4], [7.4, 9.6], [4.5, 11.4], [1.6, 9.6], [0.9, 6.6], [2.6, 4.6], [3.2, 2.4]], { ...fire, ...thin, rough: 0.5, gap: 1.6 })
      pen.poly([[4.6, 5.6], [6, 8.8], [4.5, 10.2], [3.1, 8.8]], { tint: '#fff6cf', line: 'none' })
    },
  },
  // ARC Commander: a typed command flying as a little terminal chip.
  command: {
    width: 18,
    height: 9,
    draw(pen) {
      pen.rect(0.6, 0.6, 16.8, 7.8, { tint: '#253447', weight: 0.8, rough: 0.3 })
      pen.text(['$ arc'], 9, 4.6, 4.6, 16, 0, '#7ee8d0')
    },
  },
  // Git LFS: one enormous file, a sheet with a folded corner and the label.
  file: {
    width: 34,
    height: 34,
    draw(pen) {
      pen.glow(17, 17, 17, 'rgba(245, 190, 0, 0.35)')
      pen.poly([[4, 1.5], [23, 1.5], [31, 9.5], [31, 32.5], [4, 32.5]], { tint: '#fffdf6', hatch: '#9aa0a6', gap: 3.2, weight: 1.3, rough: 0.6 })
      pen.poly([[23, 1.5], [23, 9.5], [31, 9.5]], { tint: '#dfe3e6', weight: 1, rough: 0.3 })
      pen.rect(7, 13, 21, 10, { tint: '#f5be00', weight: 0.9, rough: 0.3 })
      pen.text(['LFS'], 17.5, 18.4, 7.2, 20, 0, '#253447')
      for (const y of [26.5, 29.5]) pen.line(8, y, 27, y, { weight: 0.6, rough: 0.2 })
    },
  },
  // Publication Press: the seal over a published enemy, a gold DOI stamp.
  seal: {
    width: 16,
    height: 16,
    draw(pen) {
      pen.poly(starPts(8, 8, 7.6, 6.2, 12), { ...gold, weight: 0.8, rough: 0.3 })
      pen.ellipse(8, 8, 9.4, 9.4, { tint: '#fff3c4', weight: 0.6, rough: 0.2 })
      pen.text(['DOI'], 8, 8.4, 3.8, 9, 0, '#253447')
    },
  },
  orb: {
    width: 10,
    height: 10,
    draw(pen) {
      pen.glow(5, 5, 5, 'rgba(120, 200, 240, 0.7)')
      pen.ellipse(5, 5, 6.6, 6.6, { tint: '#d3ecf7', hatch: cssColor(PALETTE.teal), ...thin, rough: 0.4, gap: 1.6 })
      pen.ellipse(3.8, 3.8, 1.8, 1.8, { tint: '#ffffff', line: 'none' })
    },
  },
}

export const PROJECTILE_KINDS = Object.keys(DEFS) as ProjectileArt[]

export function projectile(scene: Phaser.Scene, kind: ProjectileArt): SpriteRef {
  const def = DEFS[kind]
  const centre = { x: 0, y: -def.height / 2 }
  return spriteFrom(scene, {
    key: `scribble:projectile:${kind}`,
    width: def.width,
    height: def.height,
    anchors: { weapon: centre, head: centre },
    draw: (pen) => def.draw(pen),
  })
}
