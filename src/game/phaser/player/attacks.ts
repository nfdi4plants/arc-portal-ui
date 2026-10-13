import type { AttackMove } from '../../contracts/player'
import type { WeaponSlot } from '../../contracts/progression'

export type AttackPhase = 'idle' | 'startup' | 'active' | 'recovery'

export const ATTACK_BUFFER_MS = 150

export interface AttackHooks {
  movesFor(slot: WeaponSlot): AttackMove[]
  onStart(slot: WeaponSlot, comboIndex: number, move: AttackMove): void
  onActive(slot: WeaponSlot, comboIndex: number, move: AttackMove): void
}

export interface AttackStepEnv {
  grounded: boolean
  attackSpeed: number
  // False while dashing, flinching or dead. Presses stay buffered.
  canStart: boolean
}

export interface AttackMachine {
  step(dtMs: number, pressed: { light: boolean; heavy: boolean }, env: AttackStepEnv): void
  phase(): AttackPhase
  current(): { slot: WeaponSlot; comboIndex: number; move: AttackMove } | null
  // Startup, active, or recovery before the move's cancelAfterMs. Jumps and dashes wait.
  isLocked(): boolean
  // Recovery after cancelAfterMs: jump, dash and the next attack may cut the move short.
  canCancel(): boolean
  cancel(): void
}

// Runs startup, active and recovery for one move at a time. All durations are divided by
// the attack speed in effect when the phase is checked.
export function createAttackMachine(hooks: AttackHooks): AttackMachine {
  let phase: AttackPhase = 'idle'
  let elapsed = 0
  let attackSpeed = 1
  let slot: WeaponSlot = 'light'
  let comboIndex = 0
  let move: AttackMove | null = null
  // Allocated once per started move, so current() is free to call every frame.
  let info: { slot: WeaponSlot; comboIndex: number; move: AttackMove } | null = null
  let bufferedSlot: WeaponSlot | null = null
  let bufferedMs = 0

  const scaled = (ms: number) => ms / attackSpeed

  const advance = () => {
    for (;;) {
      if (!move) return
      if (phase === 'startup' && elapsed >= scaled(move.startupMs)) {
        elapsed -= scaled(move.startupMs)
        phase = 'active'
        hooks.onActive(slot, comboIndex, move)
      } else if (phase === 'active' && elapsed >= scaled(move.activeMs)) {
        elapsed -= scaled(move.activeMs)
        phase = 'recovery'
      } else if (phase === 'recovery' && elapsed >= scaled(move.recoveryMs)) {
        cancel()
      } else {
        return
      }
    }
  }

  const start = (nextSlot: WeaponSlot, index: number, grounded: boolean): boolean => {
    const moves = hooks.movesFor(nextSlot)
    if (moves.length === 0) return false
    const nextIndex = index % moves.length
    const next = moves[nextIndex]
    if (!grounded && !next.allowedInAir) return false
    slot = nextSlot
    comboIndex = nextIndex
    move = next
    info = { slot, comboIndex, move }
    phase = 'startup'
    elapsed = 0
    hooks.onStart(slot, comboIndex, move)
    advance()
    return true
  }

  const canCancel = () => phase === 'recovery' && move !== null && elapsed >= scaled(move.cancelAfterMs)

  const cancel = () => {
    phase = 'idle'
    move = null
    info = null
    elapsed = 0
  }

  return {
    step(dtMs, pressed, env) {
      attackSpeed = Math.max(0.05, env.attackSpeed)
      if (pressed.heavy || pressed.light) {
        bufferedSlot = pressed.heavy ? 'heavy' : 'light'
        bufferedMs = ATTACK_BUFFER_MS
      }

      if (phase !== 'idle') {
        elapsed += dtMs
        advance()
      }

      if (bufferedSlot && env.canStart) {
        let started = false
        if (phase === 'idle') {
          started = start(bufferedSlot, 0, env.grounded)
        } else if (canCancel()) {
          const chain = bufferedSlot === 'light' && slot === 'light'
          started = start(bufferedSlot, chain ? comboIndex + 1 : 0, env.grounded)
        }
        if (started) bufferedSlot = null
      }

      if (bufferedSlot) {
        bufferedMs -= dtMs
        if (bufferedMs <= 0) bufferedSlot = null
      }
    },
    phase: () => phase,
    current: () => info,
    isLocked: () => phase !== 'idle' && !canCancel(),
    canCancel,
    cancel,
  }
}
