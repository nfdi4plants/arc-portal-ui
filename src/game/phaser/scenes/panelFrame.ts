import type Phaser from 'phaser'
import { PALETTE } from '../../contracts/constants'

// A hand-drawn box: a cream fill and two slightly wobbly navy outlines. The wobble comes from a
// small hash of the corner and the seed, so the same panel is drawn the same way every time and
// the box is drawn once per layout, never per frame.
function wobble(seed: number, i: number): number {
  const v = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453
  return (v - Math.floor(v) - 0.5) * 2
}

export function drawScribbleBox(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, seed = 1, fill: number = PALETTE.cream, stroke: number = PALETTE.navy): void {
  g.clear()
  g.fillStyle(fill, 0.97).fillRoundedRect(x, y, w, h, 3)
  const corners = [
    [x, y],
    [x + w, y],
    [x + w, y + h],
    [x, y + h],
  ]
  for (let pass = 0; pass < 2; pass++) {
    const amp = pass === 0 ? 0.9 : 1.6
    g.lineStyle(pass === 0 ? 1.6 : 1, stroke, pass === 0 ? 1 : 0.7)
    g.beginPath()
    for (let i = 0; i <= 4; i++) {
      const [cx, cy] = corners[i % 4]
      const px = cx + wobble(seed + pass * 7, i * 2) * amp
      const py = cy + wobble(seed + pass * 7, i * 2 + 1) * amp
      if (i === 0) g.moveTo(px, py)
      else g.lineTo(px, py)
    }
    g.strokePath()
  }
}
