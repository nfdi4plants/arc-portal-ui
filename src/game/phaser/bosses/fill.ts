// Plain math for the timing fill of a danger zone. Nothing here imports Phaser.

// How a zone fills while the wind-up runs. The anchor (x, y) of a ZoneSpec depends on it:
//   radial  centre, grows in both directions
//   wide    centre, grows left and right
//   right   left edge, grows to the right (turned by `rotation`, so it also draws diagonal lines)
//   left    right edge, grows to the left
//   up      bottom centre, grows upward
export type FillMode = 'radial' | 'wide' | 'right' | 'left' | 'up'

// The part of the zone image the fill layer shows, in frame pixels, or the scale of the whole image
// for a radial fill. Written into a reused object.
export interface FillCrop {
  x: number
  y: number
  w: number
  h: number
  scale: number
}

// A crop of zero width would show the whole image, so the fill never goes below this.
const MIN_PROGRESS = 0.001

// The fill grows linearly with the wind-up and is exactly full when the attack hits, so the player
// can time a jump or a dash against it. A longer telegraph fills more slowly.
export function fillCrop(mode: FillMode, progress: number, frameW: number, frameH: number, out: FillCrop): FillCrop {
  const k = Math.min(1, Math.max(MIN_PROGRESS, progress))
  out.x = 0
  out.y = 0
  out.w = frameW
  out.h = frameH
  out.scale = 1
  if (mode === 'radial') out.scale = k
  else if (mode === 'right') out.w = frameW * k
  else if (mode === 'left') {
    out.x = frameW * (1 - k)
    out.w = frameW * k
  } else if (mode === 'wide') {
    out.x = (frameW * (1 - k)) / 2
    out.w = frameW * k
  } else {
    out.y = frameH * (1 - k)
    out.h = frameH * k
  }
  return out
}

// The flash when a zone starts to hit: 1 at the impact, fading out over IMPACT_FLASH_MS.
export const IMPACT_FLASH_MS = 140

export function impactFlash(sinceImpactMs: number): number {
  if (sinceImpactMs < 0 || sinceImpactMs >= IMPACT_FLASH_MS) return 0
  return 1 - sinceImpactMs / IMPACT_FLASH_MS
}
