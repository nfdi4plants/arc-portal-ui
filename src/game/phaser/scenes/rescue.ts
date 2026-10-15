import { TILE } from '../../contracts/constants'

// The pit rescue: a cloud carries the mage down from above onto the last safe ground, lets go and
// flies off. Pure, so the timeline is unit-tested. Times in ms, distances in world units.

// The mage hangs this far above the landing spot when the carry starts.
export const RESCUE_DROP = 150
export const RESCUE_DESCEND_MS = 850
// Held still on the ground before the cloud lets go.
export const RESCUE_HOLD_MS = 200
export const RESCUE_FLY_MS = 450
// Mobs cannot hit the mage from the fall until this long after the release.
export const RESCUE_GRACE_MS = 450
export const RESCUE_MS = RESCUE_DESCEND_MS + RESCUE_HOLD_MS + Math.max(RESCUE_FLY_MS, RESCUE_GRACE_MS)

export interface RescueFrame {
  // How far above the landing spot the mage's feet are.
  lift: number
  // Sideways sway of the carried mage.
  sway: number
  // True once the cloud let go: the mage moves again.
  released: boolean
  // The cloud relative to where it holds the mage: up and to the side after the release.
  cloudDx: number
  cloudDy: number
  cloudAlpha: number
  // The mage can be hit again.
  vulnerable: boolean
  done: boolean
}

const easeOut = (t: number) => 1 - (1 - t) * (1 - t)
const easeIn = (t: number) => t * t
const clamp01 = (t: number) => Math.min(1, Math.max(0, t))

export function createRescueFrame(): RescueFrame {
  return { lift: RESCUE_DROP, sway: 0, released: false, cloudDx: 0, cloudDy: 0, cloudAlpha: 1, vulnerable: false, done: false }
}

// Writes the rescue at `elapsedMs` into `out`, so the scene reuses one object for every step.
export function rescueAt(out: RescueFrame, elapsedMs: number): RescueFrame {
  const descend = clamp01(elapsedMs / RESCUE_DESCEND_MS)
  out.lift = RESCUE_DROP * (1 - easeOut(descend))
  // A gentle swing that settles as the mage comes down.
  out.sway = Math.sin(elapsedMs * 0.009) * 4 * (1 - descend)
  const releaseMs = RESCUE_DESCEND_MS + RESCUE_HOLD_MS
  out.released = elapsedMs >= releaseMs
  const fly = clamp01((elapsedMs - releaseMs) / RESCUE_FLY_MS)
  const rise = easeIn(fly)
  out.cloudDx = 50 * rise
  out.cloudDy = -(RESCUE_DROP + 20) * rise
  out.cloudAlpha = 1 - rise
  out.vulnerable = elapsedMs >= releaseMs + RESCUE_GRACE_MS
  out.done = elapsedMs >= RESCUE_MS
  return out
}

export interface Surface {
  x: number
  w: number
  top: number
}

// Surfaces up to this wide put the mage down in their middle: on a stepping stone over a pit any
// other spot is close enough to an edge to fall again.
export const RESCUE_CENTRE_MAX_W = 4 * TILE
// On wider ground the landing spot keeps at least this far from both edges.
export const RESCUE_EDGE_MARGIN = 2 * TILE
// Feet can sink a few units into a one-way platform, so the surface match allows some slack.
const TOP_SLACK = 6

// Where the cloud puts the mage down: the surface it last stood on, found by its last grounded
// feet position, and a spot on it away from the edges. Falls back to that position when no
// surface matches.
export function rescueSpot(surfaces: readonly Surface[], x: number, y: number): { x: number; y: number } {
  let best: Surface | null = null
  for (const s of surfaces) {
    if (Math.abs(s.top - y) > TOP_SLACK || x < s.x - 2 || x > s.x + s.w + 2) continue
    if (!best || Math.abs(s.top - y) < Math.abs(best.top - y)) best = s
  }
  if (!best) return { x, y }
  if (best.w <= RESCUE_CENTRE_MAX_W) return { x: best.x + best.w / 2, y: best.top }
  const margin = Math.min(RESCUE_EDGE_MARGIN, best.w / 2)
  return { x: Math.min(best.x + best.w - margin, Math.max(best.x + margin, x)), y: best.top }
}
