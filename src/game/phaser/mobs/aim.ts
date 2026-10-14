// Aim math for mob projectiles. Plain data in, plain data out, so it runs in jsdom tests.

export interface Vec {
  x: number
  y: number
}

// Uncalibrated weapons miss by up to this many degrees either way.
export const SPREAD_DEG = 12
// Lead and lob times never exceed this, so a fast player does not send a shot across the level.
const MAX_LEAD_S = 1.2

// Where a shot of constant speed meets a target that keeps its velocity. Three passes settle the
// flight time closely enough for a game.
export function leadPoint(origin: Vec, target: Vec, velocity: Vec, speed: number): Vec {
  let t = 0
  for (let i = 0; i < 3; i++) {
    const px = target.x + velocity.x * t
    const py = target.y + velocity.y * t
    t = Math.min(MAX_LEAD_S, Math.hypot(px - origin.x, py - origin.y) / speed)
  }
  return { x: target.x + velocity.x * t, y: target.y + velocity.y * t }
}

// `random` is in [0, 1). 0 gives -SPREAD_DEG, 0.5 gives 0 and values near 1 give +SPREAD_DEG.
export function spreadAngle(random: number): number {
  return (random * 2 - 1) * ((SPREAD_DEG * Math.PI) / 180)
}

export function rotate(v: Vec, angle: number): Vec {
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  return { x: v.x * cos - v.y * sin, y: v.x * sin + v.y * cos }
}

// Velocity of a straight shot. A calibrated weapon leads the target, an uncalibrated one aims at
// where the target is now and then adds the random spread.
export function aimVelocity(origin: Vec, target: Vec, velocity: Vec, speed: number, calibrated: boolean, random: number): Vec {
  const aimed = calibrated ? leadPoint(origin, target, velocity, speed) : target
  const dx = aimed.x - origin.x
  const dy = aimed.y - origin.y
  const length = Math.hypot(dx, dy) || 1
  const straight = { x: (dx / length) * speed, y: (dy / length) * speed }
  return calibrated ? straight : rotate(straight, spreadAngle(random))
}

// Seconds of flight for a lobbed shot, longer for farther targets.
export function lobFlightS(distance: number): number {
  return Math.min(1, Math.max(0.5, distance / 260))
}

// Launch velocity that brings a shot under constant gravity to the target after `flightS`.
// A calibrated weapon aims at where the target will be by then.
export function lobVelocity(origin: Vec, target: Vec, velocity: Vec, flightS: number, gravity: number, calibrated: boolean, random: number): Vec {
  const tx = calibrated ? target.x + velocity.x * flightS : target.x
  const ty = calibrated ? target.y + velocity.y * flightS : target.y
  const launch = { x: (tx - origin.x) / flightS, y: (ty - origin.y) / flightS - 0.5 * gravity * flightS }
  return calibrated ? launch : rotate(launch, spreadAngle(random))
}
