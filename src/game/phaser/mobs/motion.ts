import type { Vec } from './aim'

// Moves `current` toward `target` by at most `maxDelta`.
export function approach(current: number, target: number, maxDelta: number): number {
  if (current < target) return Math.min(target, current + maxDelta)
  return Math.max(target, current - maxDelta)
}

export interface BlinkInput {
  // Centres of the mob and the player.
  mob: Vec
  player: Vec
  // Flyers may change height, walkers keep theirs.
  flies: boolean
  // Land on the far side of the player, away from the mob's own side.
  flank: boolean
  // Longest jump, in world units.
  reach: number
  // How close to the player the mob wants to land.
  standOff: number
}

// Where a blinking mob wants to land, or null when the jump would barely move it. The caller
// still checks that the spot is free and has ground.
export function blinkDestination(input: BlinkInput): Vec | null {
  const { mob, player, flies, flank, reach, standOff } = input
  const side = mob.x >= player.x ? 1 : -1
  const goalX = player.x + (flank ? -side : side) * standOff
  let dx = goalX - mob.x
  let dy = flies ? player.y - mob.y : 0
  const distance = Math.hypot(dx, dy)
  if (distance > reach) {
    dx = (dx / distance) * reach
    dy = (dy / distance) * reach
  }
  if (Math.hypot(dx, dy) < 8) return null
  return { x: mob.x + dx, y: mob.y + dy }
}
