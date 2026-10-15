import { TILE } from '../../contracts/constants'
import type { Ground, StretchLayout } from './levelGen'

// Where the kraken intern of Deprecated jump() helps a mage that cannot jump. Pure, so the "every
// stretch stays finishable" promise is unit-tested against the level generator.
//
// Only the crossings the walk to the door needs get help: a hole between two grounds (a gap or a
// pit) gets a bridge at ground height, and a wall where the next ground is higher (a step up, or a
// step down walked back) gets a lift. Platforms are never needed to reach the door, so they get
// nothing: a mage without a jump simply cannot use them, and that is part of the price.

export interface Bridge {
  x: number
  w: number
  top: number
}

export interface Step {
  // Where the two grounds meet.
  x: number
  // Surface of the lower and the higher ground (y grows downwards, so high < low).
  low: number
  high: number
  // The way the mage walks to go up.
  up: 1 | -1
}

// The highest wall the intern lifts the mage over. The generator's steps rise at most
// MAX_STEP_TILES, so this is spare.
export const MAX_LIFT = 4 * TILE

// A bridge over every hole between neighbouring grounds, at the height of the ground before it.
export function internBridges(grounds: readonly Ground[]): Bridge[] {
  const bridges: Bridge[] = []
  for (let i = 1; i < grounds.length; i++) {
    const a = grounds[i - 1]
    const b = grounds[i]
    const end = a.x + a.w
    if (b.x > end) bridges.push({ x: end, w: b.x - end, top: a.top })
  }
  return bridges
}

// A step where two grounds touch at different heights.
export function internSteps(grounds: readonly Ground[]): Step[] {
  const steps: Step[] = []
  for (let i = 1; i < grounds.length; i++) {
    const a = grounds[i - 1]
    const b = grounds[i]
    if (b.x !== a.x + a.w || b.top === a.top) continue
    const rightHigher = b.top < a.top
    steps.push({ x: b.x, low: Math.max(a.top, b.top), high: Math.min(a.top, b.top), up: rightHigher ? 1 : -1 })
  }
  return steps
}

// Feet this close to the low surface stand on it.
const FOOT_SLACK = 3
// The body counts as pressed against the wall this close to it.
const WALL_SLACK = 4

// The step the mage pushes against: standing on its low side right at the wall and walking
// towards the high side. Null when no step is there.
export function stepAt(steps: readonly Step[], feetX: number, feetY: number, dir: 1 | -1, halfWidth: number): Step | null {
  for (const step of steps) {
    if (step.up !== dir || Math.abs(feetY - step.low) > FOOT_SLACK) continue
    const gap = dir === 1 ? step.x - (feetX + halfWidth) : feetX - halfWidth - step.x
    if (gap >= -1 && gap <= WALL_SLACK) return step
  }
  return null
}

// Walks the layout from the start to the door without a single jump, with the intern's bridges
// and lifts as the only help. Returns where it got stuck, or null when it reached the door. Only
// the grounds count: the walk never steps on a platform.
export function walkWithoutJumping(layout: StretchLayout): string | null {
  const bridges = internBridges(layout.grounds)
  const steps = internSteps(layout.grounds)
  const grounds = layout.grounds
  let index = grounds.findIndex((g) => layout.start.x >= g.x && layout.start.x <= g.x + g.w)
  if (index < 0) return 'the start is not on the ground'
  const doorX = layout.door.x + layout.door.w / 2
  while (!(doorX >= grounds[index].x && doorX <= grounds[index].x + grounds[index].w)) {
    const here = grounds[index]
    const next = grounds[index + 1]
    if (!next) return `no ground after x ${here.x + here.w}`
    const end = here.x + here.w
    if (next.x > end) {
      const bridge = bridges.find((b) => b.x === end && b.x + b.w === next.x)
      if (!bridge) return `no bridge over the hole at x ${end}`
      if (bridge.top !== here.top || next.top !== here.top) return `the bridge at x ${end} does not meet the ground on both sides`
    } else if (next.top < here.top) {
      const step = steps.find((s) => s.x === next.x && s.up === 1)
      if (!step) return `no lift at the step at x ${next.x}`
      if (step.low - step.high > MAX_LIFT) return `the step at x ${next.x} is too high to lift`
    }
    // A step down is walked off.
    index++
  }
  return null
}
