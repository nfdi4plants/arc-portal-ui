import type { StatusEffect } from '../../contracts/combat'

// Freezes and slows of a combatant. Plain math, nothing here imports Phaser. Each combatant keeps
// one state object and ticks it every step, so a status never allocates.

export interface StatusState {
  freezeMs: number
  slowMs: number
  // The speed share while slowMs runs, 0 to 1.
  slowFactor: number
}

// A freeze turns into this slow on a boss.
export const BOSS_FREEZE_SLOW = 0.5
// A boss takes this share of a slow, so a 0.7 slow is a 0.85 one on a boss.
export const BOSS_SLOW_SHARE = 0.5

export function createStatus(): StatusState {
  return { freezeMs: 0, slowMs: 0, slowFactor: 1 }
}

// Bosses are never frozen: a freeze slows them for its time instead, and every slow counts half.
// Longer times and stronger slows win over what runs already.
export function addStatus(state: StatusState, status: StatusEffect, boss: boolean): void {
  if (status.kind === 'freeze' && !boss) {
    state.freezeMs = Math.max(state.freezeMs, status.ms)
    return
  }
  let factor = status.kind === 'freeze' ? BOSS_FREEZE_SLOW : status.factor
  if (boss && status.kind === 'slow') factor = 1 - (1 - factor) * BOSS_SLOW_SHARE
  factor = Math.min(1, Math.max(0, factor))
  state.slowFactor = state.slowMs > 0 ? Math.min(state.slowFactor, factor) : factor
  state.slowMs = Math.max(state.slowMs, status.ms)
}

export function tickStatus(state: StatusState, dtMs: number): void {
  if (state.freezeMs > 0) state.freezeMs = Math.max(0, state.freezeMs - dtMs)
  if (state.slowMs <= 0) return
  state.slowMs = Math.max(0, state.slowMs - dtMs)
  if (state.slowMs <= 0) state.slowFactor = 1
}

// How fast the combatant's own clock runs: 0 while frozen, the slow factor while slowed, else 1.
export function statusTimeScale(state: StatusState): number {
  if (state.freezeMs > 0) return 0
  return state.slowMs > 0 ? state.slowFactor : 1
}

export function clearStatus(state: StatusState): void {
  state.freezeMs = 0
  state.slowMs = 0
  state.slowFactor = 1
}
