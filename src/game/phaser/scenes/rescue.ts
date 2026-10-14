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
