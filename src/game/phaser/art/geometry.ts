// Point helpers for the scribble art. Pure, no canvas and no Phaser.

export type Pt = [number, number]

export interface Bounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export function boundsOf(points: readonly Pt[]): Bounds {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const [x, y] of points) {
    if (x < minX) minX = x
    if (y < minY) minY = y
    if (x > maxX) maxX = x
    if (y > maxY) maxY = y
  }
  return { minX, minY, maxX, maxY }
}

// Points around an ellipse, clockwise from the top. `wobble` (0 to 0.3) bends the radius with a
// fixed pattern so organic bodies are not perfect ovals and every variant still gets the same shape.
export function ellipsePts(cx: number, cy: number, rx: number, ry: number, count = 14, wobble = 0, phase = 0): Pt[] {
  const points: Pt[] = []
  for (let i = 0; i < count; i++) {
    const angle = -Math.PI / 2 + (i / count) * Math.PI * 2
    const k = 1 + wobble * Math.sin(angle * 3 + phase)
    points.push([cx + Math.cos(angle) * rx * k, cy + Math.sin(angle) * ry * k])
  }
  return points
}

// A dome on a flat base: the upper half of an ellipse whose bottom edge is y + h.
export function domePts(x: number, y: number, w: number, h: number, count = 10): Pt[] {
  const points: Pt[] = [[x, y + h]]
  for (let i = 0; i <= count; i++) {
    const angle = Math.PI + (i / count) * Math.PI
    points.push([x + w / 2 + Math.cos(angle) * (w / 2), y + h + Math.sin(angle) * h])
  }
  points.push([x + w, y + h])
  return points
}

// A wedge with its tip at the left middle of a w x h box and a curved edge that reaches the
// right corners.
export function conePts(w: number, h: number, count = 8): Pt[] {
  const radius = Math.max(1, w - 1)
  const half = Math.atan2(Math.max(0, h / 2 - 0.5), radius)
  const points: Pt[] = [[1, h / 2]]
  for (let i = 0; i <= count; i++) {
    const t = -half + (2 * half * i) / count
    points.push([1 + Math.cos(t) * radius, h / 2 + Math.sin(t) * radius])
  }
  return points
}

export function starPts(cx: number, cy: number, outer: number, inner: number, tips: number, rotation = -Math.PI / 2): Pt[] {
  const points: Pt[] = []
  for (let i = 0; i < tips * 2; i++) {
    const radius = i % 2 === 0 ? outer : inner
    const angle = rotation + (i / (tips * 2)) * Math.PI * 2
    points.push([cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius])
  }
  return points
}

export function gearPts(cx: number, cy: number, outer: number, inner: number, teeth: number): Pt[] {
  const points: Pt[] = []
  const step = (Math.PI * 2) / teeth
  for (let i = 0; i < teeth; i++) {
    const a = i * step
    for (const [offset, radius] of [
      [-0.28, inner],
      [-0.16, outer],
      [0.16, outer],
      [0.28, inner],
    ] as const) {
      points.push([cx + Math.cos(a + offset * step * 2) * radius, cy + Math.sin(a + offset * step * 2) * radius])
    }
  }
  return points
}

export function shiftPts(points: readonly Pt[], dx: number, dy: number): Pt[] {
  return points.map(([x, y]) => [x + dx, y + dy])
}

// Mirrors around the vertical line x = axisX.
export function flipPts(points: readonly Pt[], axisX: number): Pt[] {
  return points.map(([x, y]) => [2 * axisX - x, y])
}

// An open sine wave from (x1, y1) to (x2, y2), for tentacles and cables.
export function wavePts(x1: number, y1: number, x2: number, y2: number, amplitude: number, waves: number, count = 10): Pt[] {
  const dx = x2 - x1
  const dy = y2 - y1
  const length = Math.hypot(dx, dy) || 1
  const nx = -dy / length
  const ny = dx / length
  const points: Pt[] = []
  for (let i = 0; i <= count; i++) {
    const t = i / count
    const bend = Math.sin(t * Math.PI * 2 * waves) * amplitude * (0.4 + 0.6 * t)
    points.push([x1 + dx * t + nx * bend, y1 + dy * t + ny * bend])
  }
  return points
}

// A closed outline around a centre line that narrows or widens from startWidth to endWidth, for
// tentacles and roots.
export function ribbonPts(center: readonly Pt[], startWidth: number, endWidth: number): Pt[] {
  const left: Pt[] = []
  const right: Pt[] = []
  center.forEach(([x, y], i) => {
    const [px, py] = center[Math.max(0, i - 1)]
    const [nx, ny] = center[Math.min(center.length - 1, i + 1)]
    const length = Math.hypot(nx - px, ny - py) || 1
    const t = center.length > 1 ? i / (center.length - 1) : 0
    const half = (startWidth + (endWidth - startWidth) * t) / 2
    const ox = (-(ny - py) / length) * half
    const oy = ((nx - px) / length) * half
    left.push([x + ox, y + oy])
    right.push([x - ox, y - oy])
  })
  return [...left, ...right.reverse()]
}

// Splits a title into at most `maxLines` lines of about `maxChars` characters. Words are never
// cut, so one overlong word gets its own line. Text past the last line is cut with an ellipsis.
export function wrapTitle(title: string, maxChars: number, maxLines: number): string[] {
  const words = title.trim().split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    if (current && current.length + 1 + word.length > maxChars) {
      lines.push(current)
      current = word
    } else {
      current = current ? `${current} ${word}` : word
    }
  }
  if (current) lines.push(current)
  if (lines.length <= maxLines) return lines
  const kept = lines.slice(0, maxLines)
  kept[maxLines - 1] = `${kept[maxLines - 1].slice(0, Math.max(1, maxChars - 1)).trimEnd()}...`
  return kept
}

const TELEGRAPH_MIN = 16
const TELEGRAPH_MAX = 1024

// The smallest power of two from 16 to 1024 that holds `size`. Danger zone textures come in these
// sizes only, so a fight draws a handful of them. The zone image is scaled to its real size.
export function telegraphSize(size: number): number {
  let step = TELEGRAPH_MIN
  while (step < size && step < TELEGRAPH_MAX) step *= 2
  return step
}
