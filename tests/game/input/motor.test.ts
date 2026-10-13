import { describe, expect, it } from 'vitest'
import { STEP_MS } from '../../../src/game/contracts/constants'
import type { MotorAction, MotorEnv, MotorInput, MotorState } from '../../../src/game/model/input/motor'
import { JUMP_VELOCITY, MOTOR, createMotorState, stepMotor } from '../../../src/game/model/input/motor'

type Mechanics = MotorEnv['mechanics']
const NO_MECHANICS: Mechanics = { doubleJump: false, airDash: false, wallJump: false, hatGlide: false }

function env(overrides: Partial<MotorEnv> = {}): MotorEnv {
  return {
    grounded: false,
    touchingWallLeft: false,
    touchingWallRight: false,
    stats: { moveSpeed: 1, dashCooldownMs: 500 },
    mechanics: NO_MECHANICS,
    ...overrides,
  }
}

function input(held: MotorAction[] = [], pressed: MotorAction[] = [], released: MotorAction[] = []): MotorInput {
  return { held: new Set(held), pressed: new Set(pressed), released: new Set(released) }
}

// Steps the motor for `ms` with the same input and environment.
function run(state: MotorState, ms: number, i: MotorInput, e: MotorEnv): MotorState {
  let s = state
  for (let t = 0; t < ms - 1e-6; t += STEP_MS) s = stepMotor(s, i, e, STEP_MS)
  return s
}

// Steps the whole number of steps nearest to `ms`, so a boundary test lands within half a step of the
// time it names.
function elapse(state: MotorState, ms: number, i: MotorInput, e: MotorEnv): MotorState {
  let s = state
  for (let n = Math.round(ms / STEP_MS); n > 0; n--) s = stepMotor(s, i, e, STEP_MS)
  return s
}

// The step that applies `i` `ms` after `state`, counting that step itself, with no input before it.
function stepAt(state: MotorState, ms: number, i: MotorInput, e: MotorEnv): MotorState {
  return stepMotor(elapse(state, ms - STEP_MS, input(), e), i, e, STEP_MS)
}

function grounded(): MotorState {
  return stepMotor(createMotorState(), input(), env({ grounded: true }), STEP_MS)
}

// A flat floor at y = 0 (y grows downwards). Returns the highest point reached.
function jumpApex(holdMs: number): number {
  let s = grounded()
  let y = 0
  let minY = 0
  for (let t = 0; t < 1500; t += STEP_MS) {
    const holding = t < holdMs
    const i = input(holding ? ['jump'] : [], t === 0 ? ['jump'] : [], [])
    s = stepMotor(s, i, env({ grounded: y >= 0 && s.vy >= 0 }), STEP_MS)
    y += (s.vy * STEP_MS) / 1000
    if (y > 0) {
      y = 0
      s = { ...s, vy: 0 }
    }
    minY = Math.min(minY, y)
  }
  return -minY
}

describe('motor', () => {
  it('allows a coyote jump just inside the coyote time after leaving a ledge and refuses it just after', () => {
    const jump = input(['jump'], ['jump'])
    const early = stepAt(grounded(), MOTOR.coyoteMs - 10, jump, env())
    expect(early.jumped).toBe(true)
    expect(early.vy).toBeLessThan(0)

    const late = stepAt(grounded(), MOTOR.coyoteMs + 10, jump, env())
    expect(late.jumped).toBe(false)
    expect(late.vy).toBeGreaterThan(0)
  })

  it('fires a jump pressed 100 ms before landing on the landing step', () => {
    let s = run(grounded(), 200, input(), env())
    s = stepMotor(s, input(['jump'], ['jump']), env(), STEP_MS)
    expect(s.jumped).toBe(false)
    s = run(s, 100 - STEP_MS, input(['jump']), env())
    s = stepMotor({ ...s, vy: 0 }, input(['jump']), env({ grounded: true }), STEP_MS)
    expect(s.jumped).toBe(true)
    expect(s.vy).toBeLessThan(0)
  })

  it('jumps about 3.5 tiles when held and lower when released early', () => {
    const full = jumpApex(1000)
    const short = jumpApex(50)
    expect(full).toBeGreaterThan(80)
    expect(full).toBeLessThan(92)
    expect(short).toBeLessThan(full * 0.6)
  })

  it('turns instantly on the ground', () => {
    const running = run(grounded(), 300, input(['right']), env({ grounded: true }))
    expect(running.vx).toBeCloseTo(MOTOR.runSpeed)
    const turned = stepMotor(running, input(['left']), env({ grounded: true }), STEP_MS)
    expect(turned.vx).toBeCloseTo((-MOTOR.groundAccel * STEP_MS) / 1000)
    expect(turned.facing).toBe(-1)
  })

  it('gives i-frames for the dash i-frame time and respects the cooldown', () => {
    const e = env({ grounded: true })
    const dashed = stepMotor(grounded(), input(['dash'], ['dash']), e, STEP_MS)
    expect(dashed.dashed).toBe(true)
    expect(dashed.vx).toBeCloseTo(MOTOR.runSpeed * MOTOR.dashSpeedFactor)
    expect(dashed.vy).toBe(0)
    expect(dashed.dashIframesMs).toBeGreaterThan(0)

    expect(elapse(dashed, MOTOR.dashIframesMs - 10, input(), e).dashIframesMs).toBeGreaterThan(0)
    const after = elapse(dashed, MOTOR.dashIframesMs + 10, input(), e)
    expect(after.dashIframesMs).toBe(0)
    expect(stepMotor(after, input(['dash'], ['dash']), e, STEP_MS).dashed).toBe(false)

    const cooled = run(after, 400, input(), e)
    expect(stepMotor(cooled, input(['dash'], ['dash']), e, STEP_MS).dashed).toBe(true)
  })

  it('fires a dash pressed during the cooldown once it ends, within the dash buffer', () => {
    const e = env({ grounded: true })
    const dash = input(['dash'], ['dash'])
    const dashed = stepMotor(grounded(), dash, e, STEP_MS)
    // Presses `beforeEndMs` before the cooldown ends, then waits on for the buffer time.
    const dashesAgain = (beforeEndMs: number): boolean => {
      let s = stepAt(dashed, e.stats.dashCooldownMs - beforeEndMs, dash, e)
      expect(s.dashed).toBe(false)
      for (let n = Math.round((beforeEndMs + MOTOR.dashBufferMs) / STEP_MS); n > 0 && !s.dashed; n--) s = stepMotor(s, input(), e, STEP_MS)
      return s.dashed
    }
    expect(dashesAgain(MOTOR.dashBufferMs - 10)).toBe(true)
    expect(dashesAgain(MOTOR.dashBufferMs + 10)).toBe(false)
  })

  it('fires a dash pressed while actions are locked once they unlock, within the dash buffer', () => {
    const locked = env({ grounded: true, actionsLocked: true })
    const pressed = stepMotor(grounded(), input(['dash'], ['dash']), locked, STEP_MS)
    expect(pressed.dashed).toBe(false)
    const unlockedAfter = (ms: number) => {
      const stillLocked = elapse(pressed, ms - STEP_MS, input(), locked)
      return stepMotor(stillLocked, input(), env({ grounded: true }), STEP_MS).dashed
    }
    expect(unlockedAfter(MOTOR.dashBufferMs - 10)).toBe(true)
    expect(unlockedAfter(MOTOR.dashBufferMs + 10)).toBe(false)
  })

  it('jumps in the air only with the doubleJump mechanic, once', () => {
    const falling = run(grounded(), 200, input(), env())
    expect(stepMotor(falling, input(['jump'], ['jump']), env(), STEP_MS).jumped).toBe(false)

    const e = env({ mechanics: { ...NO_MECHANICS, doubleJump: true } })
    const first = stepMotor(falling, input(['jump'], ['jump']), e, STEP_MS)
    expect(first.jumped).toBe(true)
    const second = stepMotor(run(first, 100, input(['jump']), e), input(['jump'], ['jump']), e, STEP_MS)
    expect(second.jumped).toBe(false)
  })

  it('pushes away from the wall on a wall jump and ignores input towards it for a moment', () => {
    const e = env({ touchingWallRight: true, mechanics: { ...NO_MECHANICS, wallJump: true } })
    const falling = run(grounded(), 200, input(['right']), env())
    const jumped = stepMotor(falling, input(['right', 'jump'], ['jump']), e, STEP_MS)
    expect(jumped.vy).toBeCloseTo(-JUMP_VELOCITY + (MOTOR.gravity * STEP_MS) / 1000)
    expect(jumped.vx).toBe(-MOTOR.wallJumpPush)
    expect(jumped.facing).toBe(-1)
    const later = run(jumped, 100, input(['right', 'jump']), env())
    expect(later.vx).toBe(-MOTOR.wallJumpPush)

    const without = stepMotor(falling, input(['right', 'jump'], ['jump']), env({ touchingWallRight: true }), STEP_MS)
    expect(without.jumped).toBe(false)
  })

  it('allows a wall jump just inside the wall grace after the contact ends and refuses it just after', () => {
    const mechanics = { ...NO_MECHANICS, wallJump: true }
    const falling = run(grounded(), 200, input(), env())
    const touched = stepMotor(falling, input(), env({ touchingWallRight: true, mechanics }), STEP_MS)
    const jump = input(['jump'], ['jump'])

    const early = stepAt(touched, MOTOR.wallGraceMs - 10, jump, env({ mechanics }))
    expect(early.jumped).toBe(true)
    expect(early.vx).toBe(-MOTOR.wallJumpPush)

    const late = stepAt(touched, MOTOR.wallGraceMs + 10, jump, env({ mechanics }))
    expect(late.jumped).toBe(false)
  })

  it('caps the fall speed while gliding with the hat', () => {
    const falling = run(grounded(), 200, input(), env())
    const glide = env({ mechanics: { ...NO_MECHANICS, hatGlide: true } })
    expect(run(falling, 300, input(['jump']), glide).vy).toBe(MOTOR.glideFallSpeed)
    expect(run(falling, 300, input(['jump']), env()).vy).toBeGreaterThan(MOTOR.glideFallSpeed * 4)
  })

  it('falls faster while holding down', () => {
    const start = run(grounded(), 100, input(), env())
    const normal = run(start, 100, input(), env()).vy
    const fast = run(start, 100, input(['down']), env()).vy
    expect(fast - start.vy).toBeCloseTo((normal - start.vy) * MOTOR.fastFallGravity)
  })
})
