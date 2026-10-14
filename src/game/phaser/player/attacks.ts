import type { AttackMove, AttackVariant } from '../../contracts/player'
import type { WeaponSlot } from '../../contracts/progression'

export type AttackPhase = 'idle' | 'startup' | 'active' | 'recovery'

export const ATTACK_BUFFER_MS = 150
// A plunge without maxMs that has not landed after this long fell into a pit or off the level.
export const PLUNGE_MAX_MS = 2000
// How long after its active phase started a move still waits for the landing that fires onLand.
export const LANDING_WINDOW_MS = 1500
// How long after a plunge lands its hits (the landing ring) may still bounce the player.
export const BOUNCE_LANDING_WINDOW_MS = 120
// The recovery that is left after a bounce, already cancellable.
export const BOUNCE_RECOVERY_MS = 100

export interface AttackHooks {
  movesFor(slot: WeaponSlot): AttackMove[]
  // The version of a slot for a variant other than 'ground'. Null means the slot has none, and the
  // machine tries the next variant. comboIndex matters for up lights only.
  variantFor?(slot: WeaponSlot, variant: Exclude<AttackVariant, 'ground'>, comboIndex: number): AttackMove | null
  onStart(slot: WeaponSlot, comboIndex: number, move: AttackMove, variant: AttackVariant): void
  onActive(slot: WeaponSlot, comboIndex: number, move: AttackMove): void
  onLand?(slot: WeaponSlot, move: AttackMove): void
}

export interface AttackStepEnv {
  grounded: boolean
  attackSpeed: number
  // False while flinching or dead, during a dash, or on the step a jump or dash starts. Presses stay
  // buffered.
  canStart: boolean
  // True during a dash and shortly after it. A press made now plays the dash variant, also when
  // the buffer starts it a little later.
  dashing?: boolean
  // True while a dash runs. A buffered press does not run out meanwhile, so it plays the dash
  // variant when the dash ends.
  holdBuffer?: boolean
  // Up held and down not held.
  up?: boolean
}

export interface AttackInfo {
  slot: WeaponSlot
  comboIndex: number
  move: AttackMove
  variant: AttackVariant
}

export interface AttackMachine {
  step(dtMs: number, pressed: { light: boolean; heavy: boolean }, env: AttackStepEnv): void
  phase(): AttackPhase
  current(): Readonly<AttackInfo> | null
  // Startup, active, recovery before the move's cancelAfterMs, or a lock. The motor keeps its facing.
  // A jump or dash that can start still ends the move (the player cancels it).
  isLocked(): boolean
  // Recovery after cancelAfterMs and no lock: the next attack may cut the move short.
  canCancel(): boolean
  // Time left of a lockMs or landingLockMs lock. The player takes no movement input meanwhile.
  lockRemainingMs(): number
  // Time since the current move started, for hover.
  moveElapsedMs(): number
  // Ends the move, its lock and a landing it still waits for. For hits, teleports and cancels.
  cancel(): void
  // The player's own hit landed. True once per air heavy while its plunge falls or just after it
  // landed: the plunge ends, the landing lock and the pending landing drop, the recovery becomes
  // short and cancellable. The caller then bounces the player.
  onOwnHit(): boolean
}

// Runs startup, active and recovery for one move at a time. All durations are divided by
// the attack speed in effect when the phase is checked.
export function createAttackMachine(hooks: AttackHooks): AttackMachine {
  let phase: AttackPhase = 'idle'
  let elapsed = 0
  let moveMs = 0
  let attackSpeed = 1
  let slot: WeaponSlot = 'light'
  let comboIndex = 0
  let move: AttackMove | null = null
  // Allocated once per started move, so current() is free to call every frame.
  let info: AttackInfo | null = null
  let bufferedSlot: WeaponSlot | null = null
  let bufferedMs = 0
  let bufferedDash = false
  let lockMs = 0
  // The move waiting for its landing, which may outlive the move itself.
  let landing: AttackMove | null = null
  let landingSlot: WeaponSlot = 'heavy'
  let landingMs = 0
  // An air heavy that may still bounce the player. The window is Infinity during the fall and
  // counts down after the landing.
  let bounceReady = false
  let bounceWindowMs = Infinity

  const scaled = (ms: number) => ms / attackSpeed

  const lock = (ms: number | undefined) => {
    if (ms) lockMs = Math.max(lockMs, scaled(ms))
  }

  const land = () => {
    const landed = landing
    landing = null
    if (!landed) return
    lock(landed.landingLockMs)
    if (bounceReady) bounceWindowMs = BOUNCE_LANDING_WINDOW_MS
    hooks.onLand?.(landingSlot, landed)
  }

  const finish = () => {
    phase = 'idle'
    move = null
    info = null
    elapsed = 0
  }

  const toRecovery = (current: AttackMove) => {
    phase = 'recovery'
    lock(current.lockMs)
  }

  const advance = (grounded: boolean) => {
    for (;;) {
      const current = move
      if (!current) return
      if (phase === 'startup') {
        if (elapsed < scaled(current.startupMs)) return
        elapsed -= scaled(current.startupMs)
        phase = 'active'
        bounceReady = info?.variant === 'air'
        bounceWindowMs = Infinity
        if (current.onLand || current.plunge || current.landingLockMs) {
          landing = current
          landingSlot = slot
          landingMs = 0
        }
        hooks.onActive(slot, comboIndex, current)
      } else if (phase === 'active' && current.plunge) {
        if (landing === current && grounded) land()
        const falling = landing === current
        if (falling && elapsed < scaled(current.plunge.maxMs ?? PLUNGE_MAX_MS)) return
        // Without maxMs the fall timed out over a pit, so no landing is due any more.
        if (falling && current.plunge.maxMs === undefined) landing = null
        elapsed = 0
        toRecovery(current)
      } else if (phase === 'active') {
        if (elapsed < scaled(current.activeMs)) return
        elapsed -= scaled(current.activeMs)
        toRecovery(current)
      } else if (phase === 'recovery') {
        if (elapsed < scaled(current.recoveryMs)) return
        finish()
      } else {
        return
      }
    }
  }

  const variant = (nextSlot: WeaponSlot, kind: Exclude<AttackVariant, 'ground'>, index: number) =>
    hooks.variantFor?.(nextSlot, kind, index) ?? null

  const start = (nextSlot: WeaponSlot, index: number, env: AttackStepEnv, dash: boolean): boolean => {
    const { grounded } = env
    const moves = hooks.movesFor(nextSlot)
    const nextIndex = moves.length > 0 ? index % moves.length : 0
    let kind: AttackVariant = 'ground'
    let next: AttackMove | null = null
    if (dash) {
      next = variant(nextSlot, 'dash', 0)
      if (next) kind = 'dash'
    }
    if (!next && env.up) {
      next = variant(nextSlot, 'up', nextIndex)
      if (next) kind = 'up'
    }
    if (!next && !grounded && nextSlot === 'heavy') {
      next = variant(nextSlot, 'air', 0)
      if (next) kind = 'air'
    }
    if (!next) {
      if (moves.length === 0) return false
      next = moves[nextIndex]
      if (!grounded && !next.allowedInAir) return false
    }
    slot = nextSlot
    comboIndex = kind === 'dash' || kind === 'air' ? 0 : nextIndex
    move = next
    info = { slot, comboIndex, move, variant: kind }
    phase = 'startup'
    elapsed = 0
    moveMs = 0
    landing = null
    bounceReady = false
    hooks.onStart(slot, comboIndex, move, kind)
    advance(grounded)
    return true
  }

  const canCancel = () => phase === 'recovery' && move !== null && lockMs <= 0 && elapsed >= scaled(move.cancelAfterMs)

  const cancel = () => {
    finish()
    landing = null
    lockMs = 0
    bounceReady = false
  }

  return {
    step(dtMs, pressed, env) {
      attackSpeed = Math.max(0.05, env.attackSpeed)
      const dashing = env.dashing ?? false
      if (pressed.heavy || pressed.light) {
        bufferedSlot = pressed.heavy ? 'heavy' : 'light'
        bufferedMs = ATTACK_BUFFER_MS
        bufferedDash = dashing
      } else if (bufferedSlot && dashing) {
        bufferedDash = true
      }
      // A dash out of a finished air move drops the landing it waited for.
      if (dashing && phase === 'idle') landing = null

      if (lockMs > 0) lockMs = Math.max(0, lockMs - dtMs)
      if (bounceReady && bounceWindowMs !== Infinity) {
        bounceWindowMs -= dtMs
        if (bounceWindowMs <= 0) bounceReady = false
      }
      if (phase !== 'idle') {
        elapsed += dtMs
        moveMs += dtMs
        advance(env.grounded)
      }
      // A fall that ended without a landing (timeout) can no longer bounce.
      if (bounceReady && bounceWindowMs === Infinity && phase !== 'active') bounceReady = false

      // A falling plunge lands inside advance. Every other move waits for its landing here.
      if (landing && !(phase === 'active' && move === landing && landing.plunge)) {
        landingMs += dtMs
        if (env.grounded) land()
        else if (landingMs >= LANDING_WINDOW_MS) landing = null
      }

      if (bufferedSlot && env.canStart && lockMs <= 0) {
        let started = false
        if (phase === 'idle') {
          started = start(bufferedSlot, 0, env, dashing || bufferedDash)
        } else if (canCancel()) {
          const chain = bufferedSlot === 'light' && slot === 'light'
          started = start(bufferedSlot, chain ? comboIndex + 1 : 0, env, dashing || bufferedDash)
        }
        if (started) bufferedSlot = null
      }

      if (bufferedSlot && !env.holdBuffer) {
        bufferedMs -= dtMs
        if (bufferedMs <= 0) bufferedSlot = null
      }
    },
    phase: () => phase,
    current: () => info,
    isLocked: () => lockMs > 0 || (phase !== 'idle' && !canCancel()),
    canCancel,
    lockRemainingMs: () => lockMs,
    moveElapsedMs: () => moveMs,
    cancel,
    onOwnHit() {
      if (!bounceReady || !move) return false
      bounceReady = false
      landing = null
      lockMs = 0
      if (phase === 'active') {
        phase = 'recovery'
        elapsed = 0
      }
      elapsed = Math.max(elapsed, scaled(move.cancelAfterMs), scaled(move.recoveryMs) - BOUNCE_RECOVERY_MS)
      return true
    },
  }
}
