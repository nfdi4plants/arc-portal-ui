// An ability that works once and comes back when the next boss falls, not on a timer (Second Wind).
// The run director owns it, so the spent state carries over from one scene to the next.
export interface BossCharge {
  ready(): boolean
  // Uses the charge. False when it was spent already.
  spend(): boolean
  // A boss fell, or the final boss is about to start.
  recharge(): void
}

export function createBossCharge(): BossCharge {
  let ready = true
  return {
    ready: () => ready,
    spend() {
      if (!ready) return false
      ready = false
      return true
    },
    recharge() {
      ready = true
    },
  }
}
