import type { Action } from '../../contracts/input'
import type { Rng } from '../../contracts/rng'

// The brain of the fighting FAIR trader. It plays the mage's own body with the mage's buttons: each
// physics step it writes the actions it holds, and the input adapter of traderFight.ts turns them
// into presses and releases. Pure and allocation-free per step, so it is unit-tested and cheap.
//
// He keeps the fighting distance of his weapons, runs light strings and heavies with a short
// breather after each so they can be read and punished, dashes away from the mage's heavy wind-ups,
// jumps at a mage above him, super-dashes through the mage with Preprint, and shouts before Peer
// Pressure so a dash can dodge it. Git Revert saves him from one lethal hit on its own.

export type Reach = 'melee' | 'ranged'

export interface TraderPlan {
  light: Reach
  heavy: Reach
  // Ability slots of Peer Pressure and Preprint, -1 without.
  pressureSlot: number
  preprintSlot: number
}

export interface TraderSense {
  self: { x: number; y: number; grounded: boolean }
  foe: { x: number; y: number; dead: boolean; heavyWindup: boolean }
  room: { left: number; right: number }
  pressureReady: boolean
  preprintReady: boolean
}

// Distances from the mage he likes for each kind of attack, in world units.
export const TRADER_RANGES: Record<Reach, { min: number; max: number }> = {
  melee: { min: 24, max: 70 },
  ranged: { min: 120, max: 230 },
}
export const TRADER_TIMING = {
  // How often he rethinks his plan.
  thinkMs: 150,
  // Between two presses of a light string, inside the combo grace.
  stringGapMs: 230,
  // How long he waits after a heavy press for the move to play out.
  heavyMs: 900,
  // The breather after a string or a heavy.
  restMinMs: 380,
  restMaxMs: 720,
  // The shout before Peer Pressure.
  shoutMs: 750,
  heavyCooldownMs: 2200,
  dodgeCooldownMs: 1400,
  dashCooldownMs: 1800,
}
// How high above him the mage must be before he jumps or attacks upward.
const ABOVE = 40
const WALL_MARGIN = 36
const JUMP_HOLD_MS = 240

export type TraderMode = 'move' | 'string' | 'heavy' | 'shout' | 'rest'

export interface TraderBrain {
  // One physics step. Fills `held` with what he holds now. Returns 'pressure' on the step he starts
  // the shout, for the speech bubble.
  think(sense: TraderSense, dtMs: number, held: Set<Action>): 'pressure' | null
  mode(): TraderMode
}

const ABILITIES: readonly Action[] = ['ability1', 'ability2', 'ability3', 'ability4']

// The direction towards the mage, 1 or -1.
export function towards(selfX: number, foeX: number): 1 | -1 {
  return foeX >= selfX ? 1 : -1
}

// Which way to walk to get into the range of `reach`: 1 or -1 to move, 0 to hold. Too close for
// a ranged attack he backs off, unless a wall is behind him.
export function rangeStep(selfX: number, foeX: number, reach: Reach, room: { left: number; right: number }): -1 | 0 | 1 {
  const dir = towards(selfX, foeX)
  const dist = Math.abs(foeX - selfX)
  const { min, max } = TRADER_RANGES[reach]
  if (dist > max) return dir
  if (dist >= min) return 0
  const back = -dir as -1 | 1
  const wall = back === 1 ? room.right - selfX : selfX - room.left
  return wall > WALL_MARGIN ? back : 0
}

export function inRange(selfX: number, foeX: number, reach: Reach): boolean {
  const dist = Math.abs(foeX - selfX)
  return dist >= TRADER_RANGES[reach].min * 0.5 && dist <= TRADER_RANGES[reach].max
}

export function createTraderBrain(plan: TraderPlan, rng: Rng): TraderBrain {
  let mode: TraderMode = 'move'
  let modeMs = 0
  let thinkMs = 0
  // The light presses left in the current string, and the time to the next one.
  let presses = 0
  let pressMs = 0
  let restMs = 0
  let heavyCooldown = TRADER_TIMING.heavyCooldownMs / 2
  let dodgeCooldown = 0
  let dashCooldown = 0
  // The plan of the current think: where to walk and what to press this step.
  let walk: -1 | 0 | 1 = 0
  let jump = false
  let dash = false
  let pressLight = false
  let pressHeavy = false
  let ability = -1
  let up = false
  // A jump is held a while, so it is a full jump and not a hop.
  let jumpMs = 0

  const enter = (next: TraderMode) => {
    mode = next
    modeMs = 0
  }

  const rest = () => {
    restMs = TRADER_TIMING.restMinMs + rng.next() * (TRADER_TIMING.restMaxMs - TRADER_TIMING.restMinMs)
    enter('rest')
  }

  return {
    mode: () => mode,
    think(sense, dtMs, held) {
      held.clear()
      if (sense.foe.dead) {
        enter('move')
        return null
      }
      modeMs += dtMs
      thinkMs -= dtMs
      heavyCooldown -= dtMs
      dodgeCooldown -= dtMs
      dashCooldown -= dtMs
      const { self, foe } = sense
      const dir = towards(self.x, foe.x)
      const dist = Math.abs(foe.x - self.x)
      const above = self.y - foe.y > ABOVE
      let shout: 'pressure' | null = null
      jump = false
      dash = false
      pressLight = false
      pressHeavy = false
      ability = -1

      // A heavy wind-up of the mage close by: dash away from it, now and then.
      if (foe.heavyWindup && dist < 110 && dodgeCooldown <= 0 && mode !== 'heavy') {
        dodgeCooldown = TRADER_TIMING.dodgeCooldownMs
        if (rng.chance(0.55)) {
          walk = (-dir as -1 | 1)
          dash = true
          rest()
        }
      }

      if (mode === 'string') {
        walk = plan.light === 'melee' ? dir : 0
        up = above && dist < 60
        pressMs -= dtMs
        if (pressMs <= 0) {
          pressLight = true
          presses--
          pressMs = TRADER_TIMING.stringGapMs
          if (presses <= 0) rest()
        }
      } else if (mode === 'heavy') {
        // The press itself went out with the step that chose the heavy.
        walk = 0
        if (modeMs >= TRADER_TIMING.heavyMs) rest()
      } else if (mode === 'shout') {
        walk = 0
        if (modeMs >= TRADER_TIMING.shoutMs) {
          ability = plan.pressureSlot
          rest()
        }
      } else if (mode === 'rest') {
        // He keeps his distance while he breathes.
        walk = rangeStep(self.x, foe.x, plan.light, sense.room)
        if (modeMs >= restMs) enter('move')
      } else if (thinkMs <= 0) {
        thinkMs = TRADER_TIMING.thinkMs
        walk = rangeStep(self.x, foe.x, plan.light, sense.room)
        up = false
        if (sense.pressureReady && plan.pressureSlot >= 0 && rng.chance(0.12)) {
          shout = 'pressure'
          enter('shout')
        } else if (sense.preprintReady && plan.preprintSlot >= 0 && dist > 80 && dist < 240 && Math.abs(self.y - foe.y) < 30 && rng.chance(0.2)) {
          walk = dir
          ability = plan.preprintSlot
        } else if (heavyCooldown <= 0 && inRange(self.x, foe.x, plan.heavy) && self.grounded && rng.chance(0.4)) {
          heavyCooldown = TRADER_TIMING.heavyCooldownMs
          enter('heavy')
          pressHeavy = true
          up = above && dist < 70
          walk = dir
        } else if (inRange(self.x, foe.x, plan.light)) {
          presses = rng.int(2, 3)
          pressMs = 0
          enter('string')
        } else if (above && dist < 120 && self.grounded) {
          jump = true
          walk = dir
        } else if (plan.light === 'melee' && dist > 200 && dashCooldown <= 0 && rng.chance(0.3)) {
          dashCooldown = TRADER_TIMING.dashCooldownMs
          dash = true
          walk = dir
        } else if (self.grounded && rng.chance(0.04)) {
          jump = true
        }
      }

      if (walk === 1) held.add('right')
      else if (walk === -1) held.add('left')
      if (jump) jumpMs = JUMP_HOLD_MS
      if (jumpMs > 0) {
        jumpMs -= dtMs
        held.add('jump')
      }
      if (dash) held.add('dash')
      if (up) held.add('up')
      if (pressLight) held.add('light')
      if (pressHeavy) held.add('heavy')
      if (ability >= 0) held.add(ABILITIES[ability])
      return shout
    },
  }
}
