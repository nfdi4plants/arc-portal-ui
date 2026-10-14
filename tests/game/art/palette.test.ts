import { describe, expect, it } from 'vitest'
import { backdropInk, hsl, swatch } from '../../../src/game/phaser/art/palette'

function toHsl(hex: string): { h: number; s: number; l: number } {
  const [r, g, b] = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  const d = max - min
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1))
  let h = 0
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
  }
  return { h: (h * 60 + 360) % 360, s: s * 100, l: l * 100 }
}

describe('hsl', () => {
  it('converts primary colours and wraps the hue', () => {
    expect(hsl(0, 100, 50)).toBe('#ff0000')
    expect(hsl(120, 100, 50)).toBe('#00ff00')
    expect(hsl(240, 100, 50)).toBe('#0000ff')
    expect(hsl(-120, 100, 50)).toBe('#0000ff')
    expect(hsl(360, 100, 50)).toBe('#ff0000')
  })
})

describe('swatch', () => {
  it('keeps the main pastel in the saturation and lightness band for every hue', () => {
    for (let hue = 0; hue < 360; hue += 15) {
      const { s, l } = toHsl(swatch(hue).mid)
      expect(s).toBeGreaterThanOrEqual(44)
      expect(s).toBeLessThanOrEqual(61)
      expect(l).toBeGreaterThanOrEqual(60)
      expect(l).toBeLessThanOrEqual(75)
    }
  })

  it('orders the paper wash, the pastel and the dark shade by lightness', () => {
    const sw = swatch(200)
    expect(toHsl(sw.light).l).toBeGreaterThan(toHsl(sw.mid).l)
    expect(toHsl(sw.mid).l).toBeGreaterThan(toHsl(sw.dark).l)
  })
})

describe('backdropInk', () => {
  it('is paler and greyer than the gameplay pastel on every layer', () => {
    const mid = toHsl(swatch(118).mid)
    for (const layer of [0, 1, 2]) {
      const ink = backdropInk(118, layer)
      expect(toHsl(ink.hatch).s).toBeLessThan(mid.s)
      expect(toHsl(ink.tint).l).toBeGreaterThan(mid.l)
    }
  })

  it('makes deeper layers fainter', () => {
    expect(toHsl(backdropInk(196, 0).line).l).toBeGreaterThan(toHsl(backdropInk(196, 2).line).l)
  })
})
