import type { PassiveKind } from '../../contracts/content'
import { gearPts } from './geometry'
import type { Pt } from './geometry'
import type { Box } from './bodies'
import { glass, gold, metal, white } from './looks'
import { MATERIAL } from './palette'
import type { Swatch } from './palette'
import type { Pen } from './pen'

// Passive marks. Armour, stance, gear and shield fragment sit on the body, route arrow, quill,
// clock and speech bubble float above the head.

function armored(pen: Pen, b: Box): void {
  const x = (f: number) => b.x + b.w * f
  const y = (f: number) => b.y + b.h * f
  pen.poly([[x(0.7), y(0.3)], [x(0.95), y(0.36)], [x(0.97), y(0.86)], [x(0.72), y(0.9)]], { ...metal, gap: 2.2 })
  pen.line(x(0.74), y(0.5), x(0.95), y(0.54), { weight: 0.9, rough: 0.3 })
  pen.line(x(0.74), y(0.7), x(0.95), y(0.73), { weight: 0.9, rough: 0.3 })
  pen.dot(x(0.78), y(0.4), 0.8)
  pen.dot(x(0.9), y(0.8), 0.8)
}

function stanceShift(pen: Pen, b: Box): void {
  const r = Math.max(3.2, b.h * 0.13)
  const cx = b.x + b.w * 0.3
  const cy = b.y + b.h * 0.68
  pen.ellipse(cx, cy, r * 2, r * 2, { ...white, weight: 1, rough: 0.35 })
  pen.arc(cx, cy, r * 2, r * 2, Math.PI / 2, Math.PI * 1.5, true, { tint: MATERIAL.ink, weight: 0.9, rough: 0.25 })
  pen.dot(cx, cy - r * 0.5, r * 0.2, '#ffffff')
  pen.dot(cx, cy + r * 0.5, r * 0.2)
}

function tuned(pen: Pen, b: Box): void {
  const r = Math.max(3.4, b.h * 0.14)
  const cx = b.x + b.w * 0.22
  const cy = b.y + b.h * 0.38
  pen.poly(gearPts(cx, cy, r, r * 0.72, 7), { ...gold, weight: 0.9, rough: 0.4, gap: 1.6 })
  pen.ellipse(cx, cy, r * 0.7, r * 0.7, { tint: '#fffdf6', weight: 0.8, rough: 0.2 })
}

function shieldDrop(pen: Pen, b: Box): void {
  const x = b.x + b.w * 0.04
  const y = b.y + b.h * 0.46
  const s = Math.max(5, b.h * 0.24)
  pen.poly([[x, y], [x + s * 0.5, y - s * 0.15], [x + s, y + s * 0.1], [x + s * 0.8, y + s * 0.8], [x + s * 0.35, y + s * 1.05], [x - s * 0.05, y + s * 0.55]], { ...glass, weight: 1 })
  pen.trace([[x + s * 0.5, y - s * 0.1], [x + s * 0.4, y + s * 0.45], [x + s * 0.65, y + s * 0.95]], { weight: 0.7, rough: 0.2 })
}

function patrol(pen: Pen, b: Box): void {
  const cx = b.x + b.w / 2
  const y = b.y - 5.5
  for (let i = 0; i < 4; i++) pen.dot(cx - 8 + i * 3.4, y, 0.85, MATERIAL.ink)
  pen.poly([[cx + 2.6, y - 2.6], [cx + 8.4, y], [cx + 2.6, y + 2.6]], { tint: MATERIAL.ink, weight: 0.8, rough: 0.2 })
}

function summoner(pen: Pen, b: Box, sw: Swatch): void {
  const cx = b.x + b.w / 2
  const y = b.y - 1.5
  const vane: Pt[] = [[cx - 3, y], [cx - 3.5, y - 5], [cx - 1, y - 9.5], [cx + 4, y - 9], [cx + 3.5, y - 4.5], [cx + 0.5, y - 1.5]]
  pen.poly(vane, { tint: sw.accent, hatch: sw.accentDark, gap: 1.6, weight: 0.9, rough: 0.35 })
  pen.line(cx - 4.5, y + 0.5, cx + 3.6, y - 9, { weight: 0.9, rough: 0.2 })
}

function blink(pen: Pen, b: Box): void {
  const cx = b.x + b.w / 2
  const cy = b.y - 5.5
  pen.ellipse(cx, cy, 9, 9, { ...white, weight: 1, rough: 0.35 })
  pen.line(cx, cy, cx, cy - 3, { weight: 0.9, rough: 0.2 })
  pen.line(cx, cy, cx + 2.4, cy + 0.8, { weight: 0.9, rough: 0.2 })
  pen.line(cx - 6.5, cy - 3, cx - 8.5, cy - 4, { weight: 0.8, rough: 0.2 })
  pen.line(cx + 6.5, cy - 3, cx + 8.5, cy - 4, { weight: 0.8, rough: 0.2 })
}

function chatter(pen: Pen, b: Box): void {
  const cx = b.x + b.w / 2
  const cy = b.y - 6
  pen.poly([[cx - 4, cy + 2], [cx - 2, cy + 6], [cx + 1, cy + 2]], { ...white, weight: 0.9, rough: 0.25 })
  pen.ellipse(cx, cy, 15, 9, { ...white, weight: 1, rough: 0.35 })
  for (let i = -1; i <= 1; i++) pen.dot(cx + i * 3.4, cy, 0.8)
}

export function drawBodyMark(pen: Pen, kind: PassiveKind, b: Box): void {
  if (kind === 'armored') armored(pen, b)
  else if (kind === 'stanceShift') stanceShift(pen, b)
  else if (kind === 'tuned') tuned(pen, b)
  else if (kind === 'shieldDrop') shieldDrop(pen, b)
}

export function drawHeadMark(pen: Pen, kind: PassiveKind, b: Box, sw: Swatch): void {
  if (kind === 'patrol') patrol(pen, b)
  else if (kind === 'summoner') summoner(pen, b, sw)
  else if (kind === 'blink') blink(pen, b)
  else if (kind === 'chatter') chatter(pen, b)
}
