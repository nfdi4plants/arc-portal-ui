import type { BodyKind } from '../../contracts/content'
import { domePts, ellipsePts, flipPts, shiftPts } from './geometry'
import type { Pt } from './geometry'
import { BODY_FACE, faceVariant } from './layout'
import { bone, detail, hatched, metal, shaded, stone, white } from './looks'
import { MATERIAL, hsl } from './palette'
import type { Swatch } from './palette'
import type { Pen } from './pen'

export interface Box {
  x: number
  y: number
  w: number
  h: number
}

type BodyDraw = (pen: Pen, b: Box, sw: Swatch) => void

// Points given as fractions of the box.
const at = (b: Box, fractions: readonly (readonly [number, number])[]): Pt[] => fractions.map(([fx, fy]) => [b.x + b.w * fx, b.y + b.h * fy])

const slime: BodyDraw = (pen, b, sw) => {
  const cx = b.x + b.w / 2
  const cy = b.y + b.h * 0.6
  const blob = ellipsePts(cx, cy, b.w / 2, b.h * 0.6, 16, 0.05).map(([x, y]): Pt => [x, y > cy ? cy + (y - cy) * 0.42 : y])
  // Drips first so the body overlaps their tops.
  for (const [fx, fy] of [
    [0.26, 0.9],
    [0.7, 0.88],
  ] as const) {
    pen.ellipse(b.x + b.w * fx, b.y + b.h * fy, b.w * 0.09, b.h * 0.22, hatched(sw))
  }
  pen.poly(blob, hatched(sw))
  pen.curve(at(b, [[0.18, 0.4], [0.26, 0.22], [0.4, 0.14]]), { line: '#ffffff', weight: 1.1, rough: 0.4 })
  pen.ellipse(b.x + b.w * 0.3, b.y + b.h * 0.7, b.h * 0.12, b.h * 0.12, { tint: sw.light, rough: 0.4, weight: 0.8 })
  pen.ellipse(b.x + b.w * 0.74, b.y + b.h * 0.62, b.h * 0.08, b.h * 0.08, { tint: sw.light, rough: 0.4, weight: 0.8 })
}

const wisp: BodyDraw = (pen, b, sw) => {
  // A flame with a hooked tip and a ragged, floating bottom.
  pen.poly(
    at(b, [[0.7, 0], [0.56, 0.12], [0.66, 0.26], [0.88, 0.44], [0.95, 0.66], [0.86, 0.86], [0.8, 0.96], [0.66, 0.88], [0.54, 1], [0.4, 0.9], [0.26, 0.98], [0.14, 0.84], [0.05, 0.64], [0.1, 0.44], [0.26, 0.3], [0.4, 0.16]]),
    hatched(sw),
  )
  pen.poly(at(b, [[0.5, 0.4], [0.76, 0.52], [0.74, 0.7], [0.52, 0.8], [0.3, 0.7], [0.28, 0.52]]), { tint: sw.light, rough: 0.5, weight: 0.8 })
  pen.curve(at(b, [[0.06, 0.26], [0.0, 0.14], [0.08, 0.06]]), { weight: 0.9, rough: 0.4 })
}

const beetle: BodyDraw = (pen, b, sw) => {
  const shellW = b.w * 0.78
  // Legs under the shell.
  for (const fx of [0.2, 0.4, 0.6]) {
    const x = b.x + b.w * fx
    pen.trace([[x, b.y + b.h * 0.78], [x - b.w * 0.04, b.y + b.h * 0.9], [x - b.w * 0.09, b.y + b.h]], { weight: 1.1 })
  }
  pen.trace([[b.x + b.w * 0.7, b.y + b.h * 0.8], [b.x + b.w * 0.74, b.y + b.h * 0.92], [b.x + b.w * 0.8, b.y + b.h]], { weight: 1.1 })
  pen.curve(at(b, [[0.82, 0.38], [0.88, 0.16], [0.98, 0.06]]), { weight: 0.9, rough: 0.4 })
  pen.poly(domePts(b.x, b.y + b.h * 0.1, shellW, b.h * 0.72, 12), shaded(sw))
  pen.line(b.x + shellW / 2, b.y + b.h * 0.14, b.x + shellW / 2, b.y + b.h * 0.8, { weight: 0.9 })
  for (const [fx, fy] of [[0.2, 0.55], [0.6, 0.55], [0.4, 0.34]] as const) {
    pen.ellipse(b.x + b.w * fx, b.y + b.h * fy, b.h * 0.15, b.h * 0.15, { tint: sw.light, rough: 0.4, weight: 0.8 })
  }
  pen.ellipse(b.x + b.w * 0.84, b.y + b.h * 0.56, b.w * 0.26, b.h * 0.5, hatched(sw))
}

const golem: BodyDraw = (pen, b, sw) => {
  const rock = { ...stone, tint: sw.light, hatch: sw.mid }
  pen.poly(at(b, [[0.24, 0.9], [0.24, 1], [0.46, 1], [0.46, 0.9]]), rock)
  pen.poly(at(b, [[0.54, 0.9], [0.54, 1], [0.76, 1], [0.76, 0.9]]), rock)
  pen.poly(at(b, [[0.02, 0.32], [0.2, 0.3], [0.22, 0.82], [0.06, 0.88], [0, 0.6]]), rock)
  pen.poly(at(b, [[0.8, 0.3], [0.98, 0.32], [1, 0.6], [0.94, 0.88], [0.78, 0.82]]), rock)
  pen.poly(at(b, [[0.18, 0.3], [0.82, 0.3], [0.86, 0.92], [0.14, 0.92]]), shaded(sw))
  pen.poly(at(b, [[0.28, 0.02], [0.72, 0.02], [0.76, 0.36], [0.24, 0.36]]), rock)
  pen.trace(at(b, [[0.3, 0.46], [0.4, 0.58], [0.34, 0.7], [0.44, 0.86]]), { weight: 0.9 })
  pen.trace(at(b, [[0.7, 0.5], [0.62, 0.62], [0.7, 0.76]]), { weight: 0.9 })
  pen.ellipse(b.x + b.w * 0.58, b.y + b.h * 0.7, b.w * 0.2, b.h * 0.1, { tint: hsl(100, 40, 72), hatch: hsl(110, 45, 52), rough: 0.5, weight: 0.8 })
}

const imp: BodyDraw = (pen, b, sw) => {
  // Tail with an arrow tip behind, then horns, ears, legs and body.
  pen.curve(at(b, [[0.3, 0.78], [0.12, 0.84], [0.06, 0.68], [0.12, 0.58]]), { weight: 1.3 })
  pen.poly(at(b, [[0.06, 0.52], [0.18, 0.56], [0.1, 0.66]]), detail(sw))
  pen.poly(at(b, [[0.28, 0.1], [0.24, -0.02], [0.4, 0.08]]), detail(sw))
  pen.poly(at(b, [[0.72, 0.1], [0.76, -0.02], [0.6, 0.08]]), detail(sw))
  pen.poly(at(b, [[0.2, 0.3], [0.04, 0.22], [0.2, 0.42]]), hatched(sw))
  pen.poly(at(b, [[0.8, 0.3], [0.96, 0.22], [0.8, 0.42]]), hatched(sw))
  pen.rect(b.x + b.w * 0.34, b.y + b.h * 0.86, b.w * 0.1, b.h * 0.14, hatched(sw))
  pen.rect(b.x + b.w * 0.56, b.y + b.h * 0.86, b.w * 0.1, b.h * 0.14, hatched(sw))
  pen.ellipse(b.x + b.w * 0.5, b.y + b.h * 0.7, b.w * 0.5, b.h * 0.34, shaded(sw))
  pen.ellipse(b.x + b.w * 0.5, b.y + b.h * 0.3, b.w * 0.66, b.h * 0.5, hatched(sw))
}

const turret: BodyDraw = (pen, b, sw) => {
  pen.trace(at(b, [[0.5, 0.26], [0.5, 0.1], [0.58, 0.04]]), { weight: 1 })
  pen.dot(b.x + b.w * 0.58, b.y + b.h * 0.04, 1.3, sw.accentDark)
  // Barrel behind the box, pointing forward.
  pen.poly(at(b, [[0.7, 0.28], [1.02, 0.28], [1.04, 0.44], [0.7, 0.44]]), metal)
  pen.poly(at(b, [[0.12, 0.82], [0.88, 0.82], [0.98, 1], [0.02, 1]]), shaded(sw))
  pen.poly(at(b, [[0.1, 0.24], [0.9, 0.24], [0.92, 0.84], [0.08, 0.84]]), hatched(sw))
  for (const [fx, fy] of [[0.17, 0.32], [0.83, 0.32], [0.17, 0.76], [0.83, 0.76]] as const) pen.dot(b.x + b.w * fx, b.y + b.h * fy, 0.9, MATERIAL.metal.dark)
}

const bat: BodyDraw = (pen, b, sw) => {
  const wing = at(b, [[0.42, 0.42], [0.3, 0.12], [0.02, 0.02], [0.08, 0.34], [0.04, 0.5], [0.16, 0.46], [0.18, 0.62], [0.3, 0.52], [0.36, 0.62]])
  pen.poly(wing, shaded(sw))
  pen.poly(flipPts(wing, b.x + b.w / 2), shaded(sw))
  for (const [fx, fy] of [[0.46, 0.96], [0.54, 0.96]] as const) pen.trace([[b.x + b.w * fx, b.y + b.h * 0.8], [b.x + b.w * fx, b.y + b.h * fy], [b.x + b.w * (fx + 0.02), b.y + b.h]], { weight: 1 })
  pen.ellipse(b.x + b.w / 2, b.y + b.h * 0.56, b.w * 0.26, b.h * 0.58, hatched(sw))
  pen.poly(at(b, [[0.42, 0.34], [0.4, 0.14], [0.48, 0.28]]), detail(sw))
  pen.poly(at(b, [[0.58, 0.34], [0.6, 0.14], [0.52, 0.28]]), detail(sw))
}

const crawler: BodyDraw = (pen, b, sw) => {
  const count = 5
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1)
    const hump = Math.sin(t * Math.PI)
    const w = b.w * (0.26 - 0.03 * (1 - t))
    const h = b.h * (0.5 + 0.3 * hump)
    const cx = b.x + b.w * (0.14 + t * 0.7)
    const bottom = b.y + b.h * 0.92
    pen.trace([[cx - w * 0.2, bottom - h * 0.1], [cx - w * 0.3, b.y + b.h], [cx - w * 0.5, b.y + b.h]], { weight: 1 })
    pen.trace([[cx + w * 0.2, bottom - h * 0.1], [cx + w * 0.3, b.y + b.h], [cx + w * 0.5, b.y + b.h]], { weight: 1 })
    pen.ellipse(cx, bottom - h / 2, w, h, i % 2 === 0 ? hatched(sw) : shaded(sw))
  }
  const head = [b.x + b.w * 0.88, b.y + b.h * 0.5] as const
  pen.curve([[head[0] + 2, head[1] - b.h * 0.25], [head[0] + b.w * 0.05, b.y + b.h * 0.08], [head[0] + b.w * 0.1, b.y + b.h * 0.02]], { weight: 0.9, rough: 0.4 })
  pen.ellipse(head[0], head[1] + b.h * 0.1, b.w * 0.2, b.h * 0.6, detail(sw))
}

export const BODIES: Record<BodyKind, BodyDraw> = { slime, wisp, beetle, golem, imp, turret, bat, crawler }

export function eye(pen: Pen, x: number, y: number, r: number, look = 0): void {
  pen.ellipse(x, y, r * 2, r * 2.15, { ...white, rough: 0.35, weight: 0.9 })
  pen.dot(x + r * 0.28, y + r * 0.12 + look, r * 0.52)
  pen.dot(x + r * 0.45, y - r * 0.18 + look, r * 0.16, '#ffffff')
}

export function drawFace(pen: Pen, b: Box, body: BodyKind, variant: number): void {
  const f = BODY_FACE[body]
  const { eyes, mouth } = faceVariant(variant)
  const cx = b.x + b.w * f.x
  const cy = b.y + b.h * f.y
  const r = Math.max(2.1, b.h * f.eye)
  const spread = Math.max(r * 1.15, b.w * f.spread)
  if (eyes === 1) {
    eye(pen, cx, cy, r * 1.45)
  } else if (eyes === 3) {
    eye(pen, cx - spread, cy, r * 1.2)
    eye(pen, cx + spread, cy + r * 0.2, r * 0.8)
  } else {
    eye(pen, cx - spread, cy, r)
    eye(pen, cx + spread, cy, r)
  }
  if (eyes === 2) {
    pen.line(cx - spread - r, cy - r * 1.5, cx - spread + r * 0.8, cy - r * 0.95, { weight: 1, rough: 0.3 })
    pen.line(cx + spread + r, cy - r * 1.5, cx + spread - r * 0.8, cy - r * 0.95, { weight: 1, rough: 0.3 })
  }
  const my = cy + r * (eyes === 1 ? 2.5 : 1.9)
  const m = Math.max(r * 0.9, 2)
  if (mouth === 0) {
    pen.curve([[cx - m, my], [cx, my + m * 0.7], [cx + m, my]], { weight: 1, rough: 0.3 })
  } else if (mouth === 1) {
    pen.trace(
      Array.from({ length: 5 }, (_, i): Pt => [cx - m + (i * m) / 2, my + (i % 2 === 0 ? 0 : m * 0.55)]),
      { weight: 1, rough: 0.3 },
    )
  } else if (mouth === 2) {
    pen.ellipse(cx, my + m * 0.3, m * 0.9, m * 1.1, { tint: MATERIAL.ink, weight: 0.9, rough: 0.3 })
  } else {
    pen.line(cx - m, my, cx + m, my, { weight: 1, rough: 0.3 })
    pen.poly(shiftPts([[-0.5, 0], [0.5, 0], [0, 1.1]].map(([x, y]): Pt => [x * m * 0.8, y * m * 0.8]), cx + m * 0.4, my), { ...bone, weight: 0.8, rough: 0.3 })
  }
}
