// Stance clock for mobs with the stanceShift passive.

export const STANCE_MS = 3000

export interface Stance {
  aggressive: boolean
  elapsedMs: number
}

export interface StanceMods {
  // Multiplies walking and flying speed.
  speed: number
  // Multiplies the weapon cooldown, below 1 attacks more often.
  cooldown: number
  // Multiplies damage the mob takes.
  damageTaken: number
}

const AGGRESSIVE: StanceMods = { speed: 1.3, cooldown: 0.7, damageTaken: 1 }
const DEFENSIVE: StanceMods = { speed: 1, cooldown: 1, damageTaken: 0.6 }

export function createStance(elapsedMs = 0, aggressive = true): Stance {
  return { aggressive, elapsedMs }
}

// Advances the clock and returns true on the step the stance flips.
export function stepStance(stance: Stance, dtMs: number): boolean {
  stance.elapsedMs += dtMs
  if (stance.elapsedMs < STANCE_MS) return false
  stance.elapsedMs %= STANCE_MS
  stance.aggressive = !stance.aggressive
  return true
}

export function stanceMods(stance: Stance): StanceMods {
  return stance.aggressive ? AGGRESSIVE : DEFENSIVE
}
