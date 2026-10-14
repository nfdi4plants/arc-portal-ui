import type { Rng } from '../../contracts/rng'

// The shortest time a danger zone is shown. Even at telegraph quality 0 the player gets one flash.
export const MIN_WINDUP_MS = 80
// Pause after a light attack.
export const LIGHT_GAP_MS = 400
// Pause before the first attack of a fight or a phase.
export const OPENING_DELAY_MS = 1200

export function windupMs(telegraphMs: number): number {
  return Math.max(MIN_WINDUP_MS, telegraphMs)
}

// Idle time after a heavy attack. A well-annotated step gives the player a longer window to punish.
export function punishWindowMs(quality: number): number {
  return 600 + 900 * Math.min(1, Math.max(0, quality))
}

export interface SchedulableAttack {
  id: string
  heavy: boolean
  cooldownMs: number
}

export interface AttackScheduler<A extends SchedulableAttack> {
  // Replaces the attack list (a phase change). Cooldowns restart and nothing is picked for delayMs.
  setAttacks(attacks: readonly A[], quality: number, delayMs?: number): void
  // Advances cooldowns and the idle time. Call once per step.
  tick(dtMs: number): void
  // The next attack, or null while busy, idle or when every candidate is on cooldown.
  next(): A | null
  // The attack from next() is over. Its cooldown starts and the idle time begins.
  complete(idleMs?: number): void
  // Multiplies the cooldown of every attack that completes from now on (an enraged or tempo boss
  // recharges faster). The idle time after an attack stays as it is.
  setCooldownScale(scale: number): void
  // Keeps the boss from starting an attack for at least this long.
  delay(ms: number): void
  busy(): boolean
}

export function createScheduler<A extends SchedulableAttack>(rng: Rng): AttackScheduler<A> {
  let attacks: readonly A[] = []
  let cooldowns: number[] = []
  let quality = 0
  let idleMs = 0
  let current = -1
  let lastHeavy = false
  let cooldownScale = 1
  // A list without light attacks would never pick again if heavy attacks could not follow each other.
  let hasLight = false
  const eligible: number[] = []

  return {
    setAttacks(next, nextQuality, delayMs = 0) {
      attacks = next
      cooldowns = next.map(() => 0)
      quality = nextQuality
      idleMs = delayMs
      current = -1
      lastHeavy = false
      hasLight = next.some((attack) => !attack.heavy)
    },
    tick(dtMs) {
      idleMs = Math.max(0, idleMs - dtMs)
      for (let i = 0; i < cooldowns.length; i++) {
        if (cooldowns[i] > 0) cooldowns[i] = Math.max(0, cooldowns[i] - dtMs)
      }
    },
    next() {
      if (current >= 0 || idleMs > 0) return null
      eligible.length = 0
      for (let i = 0; i < attacks.length; i++) {
        if (cooldowns[i] > 0) continue
        if (lastHeavy && attacks[i].heavy && hasLight) continue
        eligible.push(i)
      }
      if (eligible.length === 0) return null
      current = eligible[rng.int(0, eligible.length - 1)]
      return attacks[current]
    },
    complete(idleOverrideMs) {
      if (current < 0) return
      const attack = attacks[current]
      cooldowns[current] = attack.cooldownMs * cooldownScale
      lastHeavy = attack.heavy
      idleMs = idleOverrideMs ?? (attack.heavy ? punishWindowMs(quality) : LIGHT_GAP_MS)
      current = -1
    },
    setCooldownScale(scale) {
      cooldownScale = scale
    },
    delay(ms) {
      idleMs = Math.max(idleMs, ms)
    },
    busy: () => current >= 0,
  }
}
