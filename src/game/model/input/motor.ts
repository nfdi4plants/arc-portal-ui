import { TILE } from '../../contracts/constants'

// Feel constants in world units (1 tile = TILE units) and seconds.
export const MOTOR = {
  runSpeed: 210,
  groundAccel: 2800,
  groundDecel: 3600,
  airAccel: 2000,
  gravity: 1900,
  jumpHeightTiles: 3.5,
  apexHangSpeed: 60,
  apexHangGravity: 0.5,
  jumpCut: 0.4,
  fastFallGravity: 1.6,
  terminalFall: 720,
  coyoteMs: 90,
  jumpBufferMs: 120,
  dashBufferMs: 100,
  dashMs: 150,
  dashSpeedFactor: 3.2,
  dashIframesMs: 120,
  wallJumpPush: 260,
  wallJumpLockMs: 120,
  // Arcade reports wall contact only while the body pushes into the wall, so a wall jump stays
  // possible this long after the contact ends.
  wallGraceMs: 80,
  glideFallSpeed: 90,
} as const

// v = sqrt(2 g h) gives the apex height without the small extra from the apex hang.
export const JUMP_VELOCITY = Math.sqrt(2 * MOTOR.gravity * MOTOR.jumpHeightTiles * TILE)

// The bounce after an air heavy hit launches at this share of a jump's speed. Height scales with
// the square, so the peak is 0.55^2 = about 30% of a full jump (3.5 tiles), roughly 1 tile.
export const PLUNGE_BOUNCE_FACTOR = 0.55
// Serial Dilution: bounce heights of a chain as shares of a full jump's height, one per air heavy
// of the airtime. The first is a full jump, so two or three plunges chain easily, four or five
// take a quick hand, and a sixth is refused (PLUNGE_CHAIN_MAX).
export const CHAIN_BOUNCE_HEIGHTS: readonly number[] = [1, 0.75, 0.5, 0.3, 0.15]
export const PLUNGE_CHAIN_MAX = CHAIN_BOUNCE_HEIGHTS.length

export type MotorAction = 'left' | 'right' | 'down' | 'jump' | 'dash'

// An InputFrame fits as is. The motor reads only the MotorAction entries.
export interface MotorInput {
  held: ReadonlySet<string>
  pressed: ReadonlySet<string>
  released: ReadonlySet<string>
}

export interface MotorEnv {
  grounded: boolean
  touchingWallLeft: boolean
  touchingWallRight: boolean
  stats: { moveSpeed: number; dashCooldownMs: number }
  mechanics: { doubleJump: boolean; airDash: boolean; wallJump: boolean; hatGlide: boolean }
  // Multiplies the horizontal target speed, for example while attacking on the ground. Default 1.
  speedScale?: number
  // Blocks starting jumps and dashes and turning around. Jump and dash presses still fill their buffers.
  actionsLocked?: boolean
}

export interface MotorState {
  vx: number
  vy: number
  facing: 1 | -1
  // Remaining times in ms.
  coyoteMs: number
  jumpBufferMs: number
  dashBufferMs: number
  dashMs: number
  dashCooldownMs: number
  dashIframesMs: number
  wallLockMs: number
  // The side of the wall the player jumped off. Input towards it is ignored while wallLockMs runs.
  wallLockDir: 1 | -1
  // Time left to wall jump off the wall last touched in the air, and the side it was on.
  wallGraceMs: number
  wallGraceDir: 1 | -1
  dashDir: 1 | -1
  jumpsUsed: number
  airDashUsed: boolean
  // True from a jump until jump is released, for the apex hang and the jump cut.
  jumpHeld: boolean
  // An air heavy started in this airtime, so no other may start before the mage lands, wall jumps
  // or is teleported. The jumpsUsed and airDashUsed it started with come back after its bounce.
  plungeUsed: boolean
  plungeJumpsUsed: number
  plungeAirDashUsed: boolean
  // Air heavies started in this airtime, and the place of the last one in that count (1 for the
  // first). A bounce off the floor continues the airtime, so it restores plungeChain from plungeLink.
  plungeChain: number
  plungeLink: number
  // Set for the step in which the move started, for animation and events.
  jumped: boolean
  dashed: boolean
}

export function createMotorState(facing: 1 | -1 = 1): MotorState {
  return {
    vx: 0,
    vy: 0,
    facing,
    coyoteMs: 0,
    jumpBufferMs: 0,
    dashBufferMs: 0,
    dashMs: 0,
    dashCooldownMs: 0,
    dashIframesMs: 0,
    wallLockMs: 0,
    wallLockDir: 1,
    wallGraceMs: 0,
    wallGraceDir: 1,
    dashDir: 1,
    jumpsUsed: 0,
    airDashUsed: false,
    jumpHeld: false,
    plungeUsed: false,
    plungeJumpsUsed: 0,
    plungeAirDashUsed: false,
    plungeChain: 0,
    plungeLink: 0,
    jumped: false,
    dashed: false,
  }
}

export const EMPTY_MOTOR_INPUT: MotorInput = { held: new Set(), pressed: new Set(), released: new Set() }

export function runSpeed(env: MotorEnv): number {
  return MOTOR.runSpeed * env.stats.moveSpeed
}

// A just-started jump can still report the ground for one step, so rising never counts as grounded.
function onGround(state: MotorState, env: MotorEnv): boolean {
  return env.grounded && state.vy >= 0
}

function wallSide(env: MotorEnv): 1 | -1 | 0 {
  if (env.touchingWallLeft) return -1
  if (env.touchingWallRight) return 1
  return 0
}

export type JumpKind = 'ground' | 'wall' | 'air' | null

// Which jump a press would start now. The player uses it to decide whether a jump may cancel an attack.
export function availableJump(state: MotorState, env: MotorEnv): JumpKind {
  const grounded = onGround(state, env)
  if (grounded || state.coyoteMs > 0) return 'ground'
  if (env.mechanics.wallJump && (wallSide(env) !== 0 || state.wallGraceMs > 0)) return 'wall'
  if (env.mechanics.doubleJump && state.jumpsUsed < 2) return 'air'
  return null
}

export function canDash(state: MotorState, env: MotorEnv): boolean {
  if (state.dashMs > 0 || state.dashCooldownMs > 0) return false
  if (onGround(state, env) || state.coyoteMs > 0) return true
  return env.mechanics.airDash && !state.airDashUsed
}

const probeState = createMotorState()
const probeEnv: MotorEnv = {
  grounded: false,
  touchingWallLeft: false,
  touchingWallRight: false,
  stats: { moveSpeed: 1, dashCooldownMs: 0 },
  mechanics: { doubleJump: false, airDash: false, wallJump: false, hatGlide: false },
}

// The move a step with this input would start if no attack locked the motor, or null. It runs the
// step on a scratch state, so it always agrees with stepMotor. The player uses it to let a jump or a
// dash end any attack.
export function moveStarts(state: MotorState, input: MotorInput, env: MotorEnv, dtMs: number): 'jump' | 'dash' | null {
  if (!input.pressed.has('jump') && !input.pressed.has('dash') && state.jumpBufferMs <= 0 && state.dashBufferMs <= 0) return null
  Object.assign(probeEnv, env)
  probeEnv.actionsLocked = false
  stepMotor(state, input, probeEnv, dtMs, probeState)
  if (probeState.dashed) return 'dash'
  return probeState.jumped ? 'jump' : null
}

// An air heavy started. Call once per air heavy.
export function startPlunge(state: MotorState): void {
  state.plungeUsed = true
  state.plungeJumpsUsed = state.jumpsUsed
  state.plungeAirDashUsed = state.airDashUsed
  state.plungeChain++
  state.plungeLink = state.plungeChain
}

// The share of a jump's launch speed the bounce after air heavy number `link` of an airtime gets.
// Without Serial Dilution (`chains`) every bounce is the small one.
export function bounceFactor(link: number, chains: boolean): number {
  if (!chains) return PLUNGE_BOUNCE_FACTOR
  const index = Math.min(PLUNGE_CHAIN_MAX, Math.max(1, link)) - 1
  return Math.sqrt(CHAIN_BOUNCE_HEIGHTS[index])
}

// The air heavy bounced the mage up. Returns the bounce's share of the jump speed, and the caller
// sets the velocity. The bounce continues the airtime the plunge started in, also when the landing
// ring bounced it off the floor: the jumps and the air dash are as they were before the plunge and
// the coyote time of that landing is gone. Without Serial Dilution no second air heavy may start
// before the next landing. With it (`chains`) the next one may, up to PLUNGE_CHAIN_MAX per airtime.
export function plungeBounced(state: MotorState, chains = false): number {
  state.plungeChain = state.plungeLink
  state.plungeUsed = !chains || state.plungeChain >= PLUNGE_CHAIN_MAX
  state.jumpsUsed = state.plungeJumpsUsed
  state.airDashUsed = state.plungeAirDashUsed
  state.coyoteMs = 0
  state.jumpHeld = false
  return bounceFactor(state.plungeLink, chains)
}

// A plain heavy press in the air plays the air heavy, which only one may do per airtime. Up and dash
// heavies are other variants and stay free.
export function airHeavyRefused(state: MotorState, airborne: boolean, up: boolean, dashing: boolean): boolean {
  return state.plungeUsed && airborne && !up && !dashing
}

function approach(value: number, target: number, maxDelta: number): number {
  if (value < target) return Math.min(target, value + maxDelta)
  return Math.max(target, value - maxDelta)
}

// Pass `out` (which may be `state` itself) to write the result into an existing object, so the
// per-step loop allocates nothing.
export function stepMotor(state: MotorState, input: MotorInput, env: MotorEnv, dtMs: number, out?: MotorState): MotorState {
  const dt = dtMs / 1000
  const s: MotorState = out ? Object.assign(out, state) : { ...state }
  s.jumped = false
  s.dashed = false
  const locked = env.actionsLocked ?? false
  const run = runSpeed(env)
  const grounded = onGround(s, env)

  s.jumpBufferMs = Math.max(0, s.jumpBufferMs - dtMs)
  s.dashBufferMs = Math.max(0, s.dashBufferMs - dtMs)
  s.dashCooldownMs = Math.max(0, s.dashCooldownMs - dtMs)
  s.dashIframesMs = Math.max(0, s.dashIframesMs - dtMs)
  s.wallLockMs = Math.max(0, s.wallLockMs - dtMs)
  const wall = wallSide(env)
  if (wall !== 0 && !grounded) {
    s.wallGraceMs = MOTOR.wallGraceMs
    s.wallGraceDir = wall
  } else {
    s.wallGraceMs = grounded ? 0 : Math.max(0, s.wallGraceMs - dtMs)
  }
  if (grounded) {
    s.coyoteMs = MOTOR.coyoteMs
    s.jumpsUsed = 0
    s.airDashUsed = false
    s.plungeUsed = false
    s.plungeChain = 0
    if (s.vy > 0) s.vy = 0
  } else {
    s.coyoteMs = Math.max(0, s.coyoteMs - dtMs)
  }

  if (input.pressed.has('jump')) s.jumpBufferMs = MOTOR.jumpBufferMs

  let dir = (input.held.has('right') ? 1 : 0) - (input.held.has('left') ? 1 : 0)

  if (input.pressed.has('dash')) s.dashBufferMs = MOTOR.dashBufferMs
  if (s.dashBufferMs > 0 && !locked && canDash(s, env)) {
    s.dashBufferMs = 0
    if (!grounded && s.coyoteMs <= 0) s.airDashUsed = true
    s.dashDir = dir !== 0 ? (dir as 1 | -1) : s.facing
    s.facing = s.dashDir
    s.dashMs = MOTOR.dashMs
    s.dashIframesMs = MOTOR.dashIframesMs
    s.dashCooldownMs = env.stats.dashCooldownMs
    s.jumpHeld = false
    s.dashed = true
  }

  const wasDashing = s.dashMs > 0
  if (wasDashing) s.dashMs = Math.max(0, s.dashMs - dtMs)

  // A jump ends a dash early, so dash into jump keeps the timing tight.
  if (s.jumpBufferMs > 0 && !locked) {
    const kind = availableJump(s, env)
    if (kind) {
      s.vy = -JUMP_VELOCITY
      s.jumpBufferMs = 0
      s.coyoteMs = 0
      s.jumpHeld = true
      s.jumped = true
      if (s.dashMs > 0) {
        s.dashMs = 0
        s.vx = s.dashDir * run
      }
      if (kind === 'ground') s.jumpsUsed = 1
      else if (kind === 'air') s.jumpsUsed = 2
      else {
        const side = wall !== 0 ? wall : s.wallGraceDir
        s.vx = -side * MOTOR.wallJumpPush
        s.facing = -side as 1 | -1
        s.wallLockMs = MOTOR.wallJumpLockMs
        s.wallLockDir = side
        s.wallGraceMs = 0
        s.jumpsUsed = Math.max(1, s.jumpsUsed)
        s.plungeUsed = false
        s.plungeChain = 0
      }
    }
  }

  if (s.jumpHeld && !input.held.has('jump')) {
    if (s.vy < 0) s.vy *= MOTOR.jumpCut
    s.jumpHeld = false
  }

  if (s.dashMs > 0) {
    s.vx = s.dashDir * run * MOTOR.dashSpeedFactor
    s.vy = 0
    return s
  }
  if (wasDashing) s.vx = s.dashDir * run

  const wallLocked = s.wallLockMs > 0
  if (wallLocked && dir === s.wallLockDir) dir = 0
  if (dir !== 0 && !locked) s.facing = dir as 1 | -1

  const target = dir * run * (env.speedScale ?? 1)
  const groundedNow = grounded && !s.jumped
  if (groundedNow) {
    if (dir !== 0 && Math.sign(s.vx) === -dir) s.vx = 0
    const speedingUp = dir !== 0 && Math.abs(s.vx) < Math.abs(target)
    s.vx = approach(s.vx, target, (speedingUp ? MOTOR.groundAccel : MOTOR.groundDecel) * dt)
  } else if (!(wallLocked && dir === 0)) {
    // During the wall-jump lock, no steering keeps the push from the wall.
    s.vx = approach(s.vx, target, MOTOR.airAccel * dt)
  }

  let gravity = MOTOR.gravity
  if (s.jumpHeld && Math.abs(s.vy) < MOTOR.apexHangSpeed) gravity *= MOTOR.apexHangGravity
  if (!groundedNow && input.held.has('down')) gravity *= MOTOR.fastFallGravity
  s.vy += gravity * dt

  let maxFall: number = MOTOR.terminalFall
  if (env.mechanics.hatGlide && !groundedNow && input.held.has('jump') && s.vy > 0) maxFall = MOTOR.glideFallSpeed
  if (s.vy > maxFall) s.vy = maxFall
  return s
}
