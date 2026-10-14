import { PALETTE } from '../../contracts/constants'
import { cssColor } from '../color'

// Colour derivation for the scribble art. Pure, so it runs in unit tests without a canvas.

// The art modules import cssColor from here.
export { cssColor }

export const OUTLINE = cssColor(PALETTE.outline)

export function normalizeHue(hue: number): number {
  return ((hue % 360) + 360) % 360
}

function channel(n: number, hue: number, saturation: number, lightness: number): number {
  const k = (n + hue / 30) % 12
  const a = saturation * Math.min(lightness, 1 - lightness)
  return lightness - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
}

// Hue in degrees, saturation and lightness in percent. Returns "#rrggbb".
export function hsl(hue: number, saturation: number, lightness: number): string {
  const h = normalizeHue(hue)
  const s = saturation / 100
  const l = lightness / 100
  const hex = (n: number) =>
    Math.round(channel(n, h, s, l) * 255)
      .toString(16)
      .padStart(2, '0')
  return `#${hex(0)}${hex(8)}${hex(4)}`
}

export interface Swatch {
  // Paper wash under the hatching.
  light: string
  // The pastel the hatch lines are drawn in. Saturation 52 %, lightness 68 %.
  mid: string
  // Dark parts, hatched across.
  dark: string
  // A second hue for details such as horns and liquids.
  accent: string
  accentDark: string
}

export const MID_SATURATION = 52
export const MID_LIGHTNESS = 68

export function swatch(hue: number): Swatch {
  const accentHue = hue + 150
  return {
    light: hsl(hue, 48, 87),
    mid: hsl(hue, MID_SATURATION, MID_LIGHTNESS),
    dark: hsl(hue, 46, 42),
    accent: hsl(accentHue, 55, 72),
    accentDark: hsl(accentHue, 48, 46),
  }
}

export interface BackdropInk {
  tint: string
  hatch: string
  line: string
}

// Background layers use paler, greyer ink than anything in front of them. Deeper layers
// (index 0) are the faintest.
export function backdropInk(hue: number, layer: number): BackdropInk {
  const depth = Math.max(0, Math.min(2, layer))
  return {
    tint: hsl(hue, 18 + depth * 4, 93 - (2 - depth) * 1.5),
    hatch: hsl(hue, 24 + depth * 5, 84 - depth * 3),
    line: hsl(hue, 14 + depth * 4, 74 - depth * 8),
  }
}

// Fixed colours for things that do not follow a monster's hue.
export const MATERIAL = {
  white: '#ffffff',
  wood: { tint: '#efdcbc', hatch: '#c19a62', dark: '#8a6238' },
  metal: { tint: '#eceff2', hatch: '#aab3bd', dark: '#6b7480' },
  bone: { tint: '#faf3e0', hatch: '#d8c9a3' },
  glass: { tint: 'rgba(214, 238, 248, 0.75)', hatch: '#9fcfe4' },
  gold: { tint: '#fbe9a6', hatch: '#e5b92e' },
  stone: { tint: '#e4e0d8', hatch: '#a9a396', dark: '#6f6a5f' },
  fire: { tint: '#ffe0a8', hatch: '#f08a3c' },
  ink: '#3b3340',
} as const

// Base hue of each theme's backgrounds and tiles.
export const THEME_HUE = { study: 118, assay: 196, run: 262 } as const
