// The portal a beaten node boss leaves behind. It takes about three seconds to form and opens only
// once it is whole: a swirl grows from a point, sparks spiral in, the arch draws in from the floor
// up while it flickers dimly, then a flash and the sign show it is ready. Pure, so the timeline is
// unit-tested. Times in ms, distances in world units.

export const PORTAL_SWIRL_MS = 900
export const PORTAL_SPARKS_FROM_MS = 200
export const PORTAL_ARCH_FROM_MS = 700
export const PORTAL_ARCH_MS = 1600
// The portal can be entered from this moment on.
export const PORTAL_SPAWN_MS = 3000
export const PORTAL_FLASH_MS = 450
export const PORTAL_LABEL_MS = 350
export const PORTAL_SPARKS = 8
const SPARK_CYCLE_MS = 700
const SPARK_RADIUS = 34
// Radians the swirl turns per ms while it forms, and once it is open.
const SPIN_FORMING = 0.006
const SPIN_OPEN = 0.0025
// Opacity of the arch while it forms: dim, with an uneven flicker.
const FORMING_ALPHA = 0.3
const FLICKER_ALPHA = 0.18

export interface PortalFrame {
  // The swirl in the middle of the arch, its scale grows from 0 and pulses once when it opens.
  swirlScale: number
  swirlAlpha: number
  // Rotation of the swirl in radians.
  spin: number
  // Share of the arch drawn so far, from the floor up.
  arch: number
  archAlpha: number
  // The flash when it opens, 1 at the moment it opens and 0 once it has faded.
  flash: number
  // Opacity of the sign over the arch, 0 until it opens.
  label: number
  sparks: boolean
  ready: boolean
}

export interface PortalSpark {
  // Offset from the middle of the swirl.
  dx: number
  dy: number
  alpha: number
}

const clamp01 = (t: number) => Math.min(1, Math.max(0, t))
const easeOut = (t: number) => 1 - (1 - t) * (1 - t)
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t))

export function createPortalFrame(): PortalFrame {
  return { swirlScale: 0, swirlAlpha: 0, spin: 0, arch: 0, archAlpha: FORMING_ALPHA, flash: 0, label: 0, sparks: false, ready: false }
}

// Writes the portal at `elapsedMs` since the boss fell into `out`, so the scene reuses one object.
export function portalAt(out: PortalFrame, elapsedMs: number): PortalFrame {
  const t = Math.max(0, elapsedMs)
  const ready = t >= PORTAL_SPAWN_MS
  const open = clamp01((t - PORTAL_SPAWN_MS) / PORTAL_FLASH_MS)
  out.ready = ready
  out.swirlScale = easeOut(clamp01(t / PORTAL_SWIRL_MS)) * (1 + (ready ? 0.35 * Math.sin(open * Math.PI) : 0))
  out.swirlAlpha = ready ? 0.75 : 0.9 * clamp01(t / (PORTAL_SWIRL_MS / 2))
  out.spin = ready ? SPIN_FORMING * PORTAL_SPAWN_MS + SPIN_OPEN * (t - PORTAL_SPAWN_MS) : SPIN_FORMING * t
  out.arch = easeInOut(clamp01((t - PORTAL_ARCH_FROM_MS) / PORTAL_ARCH_MS))
  // Two slow waves that rarely line up give an uneven flicker.
  const flicker = (0.5 + 0.5 * Math.sin(t * 0.045)) * (0.6 + 0.4 * Math.sin(t * 0.017))
  out.archAlpha = ready ? 1 : FORMING_ALPHA + FLICKER_ALPHA * flicker
  out.flash = ready ? 1 - open : 0
  out.label = ready ? clamp01((t - PORTAL_SPAWN_MS) / PORTAL_LABEL_MS) : 0
  out.sparks = t >= PORTAL_SPARKS_FROM_MS && !ready
  return out
}

// Spark `index` of PORTAL_SPARKS at `elapsedMs`. Each one spirals into the swirl again and again,
// the sparks spread evenly over one cycle.
export function portalSparkAt(out: PortalSpark, elapsedMs: number, index: number): PortalSpark {
  const local = elapsedMs - PORTAL_SPARKS_FROM_MS - (index * SPARK_CYCLE_MS) / PORTAL_SPARKS
  if (local < 0 || elapsedMs >= PORTAL_SPAWN_MS) {
    out.dx = 0
    out.dy = 0
    out.alpha = 0
    return out
  }
  const phase = (local % SPARK_CYCLE_MS) / SPARK_CYCLE_MS
  const radius = SPARK_RADIUS * (1 - phase)
  const angle = (index / PORTAL_SPARKS) * Math.PI * 2 + phase * 2.2
  out.dx = Math.cos(angle) * radius
  out.dy = Math.sin(angle) * radius * 1.2
  out.alpha = Math.sin(phase * Math.PI)
  return out
}
