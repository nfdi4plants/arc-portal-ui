import { moveStarts, stepMotor } from '../../model/input/motor'
import type { MotorEnv, MotorInput, MotorState } from '../../model/input/motor'
import type { AttackMachine, AttackStepEnv } from './attacks'

// An attack pressed this long after a dash ended still plays the dash variant.
export const DASH_ATTACK_GRACE_MS = 80
// The run speed share left while a move runs on the ground.
export const ATTACK_GROUND_SPEED = 0.3

const NO_HELD: ReadonlySet<string> = new Set()

export interface ControlPresses {
  light: boolean
  heavy: boolean
  // Up held and down not held.
  up: boolean
}

export interface Controls {
  // One fixed step of the attack machine and then the motor. `input` is what the motor reads, empty
  // while not controllable. Writes the motor state in place.
  step(input: MotorInput, presses: ControlPresses, controllable: boolean, attackSpeed: number, dtMs: number): void
  // A dash variant took over the dash, so a later press plays the normal move again.
  endDashGrace(): void
}

// Ties the attack machine to the motor. A jump or dash that can start always starts on the step it
// is pressed and ends the attack, so no button waits on another. Only the dash cooldown and the jump
// rules (ground, coyote time, air jumps) hold them back. An attack pressed during a dash waits in the
// buffer and plays the dash variant when the dash ends.
export function createControls(motor: MotorState, motorEnv: MotorEnv, attacks: AttackMachine): Controls {
  let sinceDashMs = Infinity
  const attackPressed = { light: false, heavy: false }
  const attackEnv: AttackStepEnv = { grounded: false, attackSpeed: 1, canStart: false, dashing: false, holdBuffer: false, up: false }
  // What the motor reads during an attack lock: no direction held, while jump and dash presses
  // still fill their buffers.
  const lockedInput: MotorInput = { held: NO_HELD, pressed: NO_HELD, released: NO_HELD }

  return {
    step(input, presses, controllable, attackSpeed, dtMs) {
      const grounded = motorEnv.grounded
      const move = controllable ? moveStarts(motor, input, motorEnv, dtMs) : null
      const dashRuns = motor.dashMs > 0 || move === 'dash'
      attackPressed.light = controllable && presses.light
      attackPressed.heavy = controllable && presses.heavy
      // A just-started jump can still report the ground, so a rising mage plays the air variants.
      attackEnv.grounded = grounded && motor.vy >= 0
      attackEnv.attackSpeed = attackSpeed
      attackEnv.canStart = controllable && move === null && !dashRuns
      attackEnv.dashing = dashRuns || sinceDashMs < DASH_ATTACK_GRACE_MS
      attackEnv.holdBuffer = dashRuns
      attackEnv.up = presses.up
      attacks.step(dtMs, attackPressed, attackEnv)
      // After the attack step, so a plunge landing on this step still fires its landing hit. Hits
      // already spawned stay.
      if (move) attacks.cancel()

      let motorInput = input
      if (attacks.lockRemainingMs() > 0 && controllable) {
        lockedInput.pressed = input.pressed
        lockedInput.released = input.released
        motorInput = lockedInput
      }
      motorEnv.actionsLocked = attacks.isLocked()
      motorEnv.speedScale = attacks.phase() !== 'idle' && grounded ? ATTACK_GROUND_SPEED : 1
      stepMotor(motor, motorInput, motorEnv, dtMs, motor)
      if (motor.dashMs > 0) sinceDashMs = 0
      else sinceDashMs += dtMs
    },
    endDashGrace() {
      sinceDashMs = Infinity
    },
  }
}
