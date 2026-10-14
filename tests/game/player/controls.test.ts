import { describe, expect, it } from 'vitest'
import { STEP_MS } from '../../../src/game/contracts/constants'
import type { Action } from '../../../src/game/contracts/input'
import type { AttackMove, AttackVariant } from '../../../src/game/contracts/player'
import { MOTOR, createMotorState } from '../../../src/game/model/input/motor'
import type { MotorEnv } from '../../../src/game/model/input/motor'
import { createAttackMachine } from '../../../src/game/phaser/player/attacks'
import { createControls } from '../../../src/game/phaser/player/controls'

function move(name: string, timing: Partial<AttackMove>): AttackMove {
  return { name, startupMs: 60, activeMs: 80, recoveryMs: 140, cancelAfterMs: 60, allowedInAir: true, onActive: () => {}, ...timing }
}

// Staff-like timings: a quick jab combo and a slow slam that locks.
const LIGHT = [move('jab', {}), move('jab', {}), move('thrust', { startupMs: 80, activeMs: 90, recoveryMs: 220, cancelAfterMs: 130 })]
const HEAVY = [move('slam', { startupMs: 280, activeMs: 120, recoveryMs: 320, cancelAfterMs: 200, allowedInAir: false, lockMs: 150 })]
const DASH_LIGHT = move('lunge', { startupMs: 40, activeMs: 90, recoveryMs: 120, cancelAfterMs: 0, keepsMomentum: true })
const DASH_HEAVY = move('comet', { startupMs: 70, activeMs: 160, recoveryMs: 220, cancelAfterMs: 150, lockMs: 150 })
const AIR_HEAVY = move('meteor', { startupMs: 90, activeMs: 0, recoveryMs: 220, cancelAfterMs: 160, landingLockMs: 220, plunge: { speed: 700 } })

// The mage on a flat floor at y = 0 (y grows downwards), stepped like Player's onStep.
function setup() {
  const motor = createMotorState()
  const motorEnv: MotorEnv = {
    grounded: true,
    touchingWallLeft: false,
    touchingWallRight: false,
    stats: { moveSpeed: 1, dashCooldownMs: 2000 },
    mechanics: { doubleJump: false, airDash: false, wallJump: false, hatGlide: false },
    speedScale: 1,
    actionsLocked: false,
  }
  const started: { name: string; variant: AttackVariant }[] = []
  const attacks = createAttackMachine({
    movesFor: (slot) => (slot === 'light' ? LIGHT : HEAVY),
    variantFor(slot, variant) {
      if (variant === 'dash') return slot === 'light' ? DASH_LIGHT : DASH_HEAVY
      if (variant === 'air') return slot === 'heavy' ? AIR_HEAVY : null
      return null
    },
    onStart(_slot, _index, m, variant) {
      started.push({ name: m.name, variant })
      if (variant === 'dash') {
        motor.dashMs = 0
        controls.endDashGrace()
      }
    },
    onActive: () => {},
  })
  const controls = createControls(motor, motorEnv, attacks)
  let y = 0
  const released = new Set<string>()
  const step = (pressed: Action[] = []) => {
    motorEnv.grounded = y >= 0
    const set = new Set<string>(pressed)
    const presses = { light: set.has('light'), heavy: set.has('heavy'), up: false }
    controls.step({ held: set, pressed: set, released }, presses, true, 1, STEP_MS)
    y += (motor.vy * STEP_MS) / 1000
    if (y >= 0) {
      y = 0
      if (motor.vy > 0) motor.vy = 0
    }
  }
  const wait = (ms: number) => {
    for (let n = Math.round(ms / STEP_MS); n > 0; n--) step()
  }
  return { motor, attacks, started, step, wait, airborne: () => y < 0 }
}

describe('createControls', () => {
  it('starts a jump on the press step during the recovery of a light attack', () => {
    const { motor, attacks, step, wait } = setup()
    step(['light'])
    // Startup and active are over, recovery has not reached its cancel window.
    wait(150)
    expect(attacks.phase()).toBe('recovery')
    expect(attacks.canCancel()).toBe(false)
    step(['jump'])
    expect(motor.jumped).toBe(true)
    expect(attacks.phase()).toBe('idle')
  })

  it('starts a jump during the windup and the lock of a heavy attack', () => {
    const { motor, attacks, step, wait } = setup()
    step(['heavy'])
    wait(100)
    expect(attacks.phase()).toBe('startup')
    step(['jump'])
    expect(motor.jumped).toBe(true)

    const locked = setup()
    locked.step(['heavy'])
    // The active phase ends at 400 ms, the lock runs 150 ms after it.
    locked.wait(420)
    expect(locked.attacks.lockRemainingMs()).toBeGreaterThan(0)
    locked.step(['jump'])
    expect(locked.motor.jumped).toBe(true)
    expect(locked.attacks.lockRemainingMs()).toBe(0)
  })

  it('starts a dash on the press step during an attack', () => {
    const { motor, attacks, step, wait } = setup()
    step(['heavy'])
    wait(150)
    step(['dash'])
    expect(motor.dashed).toBe(true)
    expect(attacks.phase()).toBe('idle')
  })

  it('keeps the current attack when the dash is on cooldown', () => {
    const { motor, attacks, step, wait } = setup()
    step(['dash'])
    wait(400)
    step(['heavy'])
    wait(100)
    step(['dash'])
    expect(motor.dashed).toBe(false)
    expect(attacks.phase()).toBe('startup')
  })

  it('plays the dash variant when the dash ends, not cutting the dash short', () => {
    const { motor, started, step, wait } = setup()
    step(['dash'])
    wait(30)
    step(['light'])
    let dashSteps = 2 + Math.round(30 / STEP_MS)
    while (motor.dashMs > 0) {
      expect(started).toHaveLength(0)
      step()
      dashSteps++
    }
    expect(dashSteps * STEP_MS).toBeGreaterThanOrEqual(MOTOR.dashMs - STEP_MS)
    step()
    expect(started).toEqual([{ name: 'lunge', variant: 'dash' }])
  })

  it('keeps an attack pressed on the dash step until the dash ends', () => {
    const { started, step, wait } = setup()
    step(['dash', 'heavy'])
    wait(MOTOR.dashMs + 2 * STEP_MS)
    expect(started).toEqual([{ name: 'comet', variant: 'dash' }])
  })

  it('plays the air variant for an attack pressed with the jump', () => {
    const { motor, started, step, wait } = setup()
    step(['jump', 'heavy'])
    expect(motor.jumped).toBe(true)
    wait(2 * STEP_MS)
    expect(started).toEqual([{ name: 'meteor', variant: 'air' }])
  })

  it('never leaves the mage unable to act while presses are spammed', () => {
    const { motor, attacks, started, step, wait, airborne } = setup()
    const rotation: Action[][] = [['light'], ['jump'], ['heavy'], ['dash'], ['light', 'jump'], ['heavy'], ['dash', 'light'], ['jump']]
    for (let i = 0; i < 120; i++) {
      const pressed = rotation[i % rotation.length]
      const onGround = !airborne() && motor.vy >= 0
      const dashReady = motor.dashCooldownMs <= STEP_MS && motor.dashMs <= 0
      step(pressed)
      if (pressed.includes('jump') && onGround) expect(motor.jumped).toBe(true)
      if (pressed.includes('dash') && onGround && dashReady) expect(motor.dashed).toBe(true)
      wait(40)
    }
    expect(started.length).toBeGreaterThan(10)

    wait(3000)
    expect(attacks.phase()).toBe('idle')
    step(['jump'])
    expect(motor.jumped).toBe(true)
    wait(1500)
    step(['dash'])
    expect(motor.dashed).toBe(true)
    wait(1000)
    const before = started.length
    step(['light'])
    expect(started).toHaveLength(before + 1)
  })
})
