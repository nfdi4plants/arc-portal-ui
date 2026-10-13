import Phaser from 'phaser'
import type { ScribbleArt } from '../../contracts/art'
import type { CombatWorld, HitEvent } from '../../contracts/combat'
import { DEPTH, MAGE_FRAME, MAGE_TEXTURE, PALETTE, PLAYER_HEIGHT } from '../../contracts/constants'
import type { Action } from '../../contracts/input'
import type { AbilityHandler, AttackContext, PlayerEvents, PlayerHandle, WeaponMoveset } from '../../contracts/player'
import type { PlayerBuild, PlayerWeaponId, WeaponSlot } from '../../contracts/progression'
import { EMPTY_MOTOR_INPUT, MOTOR, availableJump, canDash, createMotorState, runSpeed, stepMotor } from '../../model/input/motor'
import type { MotorEnv, MotorInput, MotorState } from '../../model/input/motor'
import type { InputLayer } from '../input/InputLayer'
import { createAttackMachine } from './attacks'
import type { AttackPhase } from './attacks'
import { staffMoveset } from './staffMoveset'

export const PLAYER_HURTBOX = { width: 18, height: 42 }
const DAMAGE_IFRAMES_MS = 700
const FLINCH_MS = 180
const DROP_THROUGH_MS = 150
const ATTACK_GROUND_SPEED = 0.3
const ABILITY_ACTIONS: readonly Action[] = ['ability1', 'ability2', 'ability3', 'ability4']
const GHOST_COUNT = 6
const GHOST_LIFE_MS = 180
const GHOST_INTERVAL_MS = 28

export interface PlayerDeps {
  combat: CombatWorld
  art: ScribbleArt
  input: InputLayer
  build: PlayerBuild
  colliders: Phaser.Types.Physics.Arcade.ArcadeColliderType[]
}

export interface PlayerDebugState {
  motor: Readonly<MotorState>
  grounded: boolean
  attackPhase: AttackPhase
  flinchMs: number
  damageIframesMs: number
}

export type Player = PlayerHandle & { destroy(): void; debugState(): PlayerDebugState }

// A scene marks a static body as a one-way platform by turning off collision on every side
// except the top. The player lands on it from above, jumps up through it, and drops through
// it with down + jump.
export function markOneWay(body: Phaser.Physics.Arcade.StaticBody | Phaser.Physics.Arcade.Body): void {
  body.checkCollision.down = false
  body.checkCollision.left = false
  body.checkCollision.right = false
}

function isOneWay(body: Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody): boolean {
  return body.checkCollision.down === false && body.checkCollision.up !== false
}

function bodyOf(object: unknown): Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody | null {
  if (typeof object !== 'object' || object === null) return null
  const o = object as { isBody?: boolean; body?: unknown }
  if (o.isBody) return object as Phaser.Physics.Arcade.Body
  if (o.body && (o.body as { isBody?: boolean }).isBody) return o.body as Phaser.Physics.Arcade.Body
  return null
}

function clamp1(v: number): number {
  return Math.max(-1, Math.min(1, v))
}

export function createPlayer(scene: Phaser.Scene, deps: PlayerDeps, x: number, y: number): Player {
  const { width: W, height: H } = PLAYER_HURTBOX
  const world = scene.physics.world
  const body = scene.physics.add.body(x - W / 2, y - H, W, H)
  body.setAllowGravity(false)

  let build = deps.build
  let hp = Math.min(build.hp, build.stats.maxHp)
  // Mutated in place every step. debugState() hands out this object, so readers see live values.
  const motor = createMotorState()
  const motorEnv: MotorEnv = {
    grounded: false,
    touchingWallLeft: false,
    touchingWallRight: false,
    stats: { moveSpeed: 1, dashCooldownMs: 0 },
    mechanics: { doubleJump: false, airDash: false, wallJump: false, hatGlide: false },
    speedScale: 1,
    actionsLocked: false,
  }
  const readBuild = () => {
    motorEnv.stats.moveSpeed = build.stats.moveSpeed
    motorEnv.stats.dashCooldownMs = build.stats.dashCooldownMs
    motorEnv.mechanics.doubleJump = build.mechanics.includes('doubleJump')
    motorEnv.mechanics.airDash = build.mechanics.includes('airDash')
    motorEnv.mechanics.wallJump = build.mechanics.includes('wallJump')
    motorEnv.mechanics.hatGlide = build.mechanics.includes('hatGlide')
  }
  readBuild()

  let frozen = false
  let justUnfrozen = false
  let destroyed = false
  let grounded = false
  let lastVy = 0
  let flinchMs = 0
  let damageIframesMs = 0
  let dropMs = 0
  let standingOnOneWay = false
  let aim = { x, y }
  let interceptor: ((hit: HitEvent) => boolean) | null = null
  const abilityHandlers: (AbilityHandler | null)[] = [null, null, null, null]
  const abilityCooldowns = [0, 0, 0, 0]
  const movesets = new Map<PlayerWeaponId, WeaponMoveset>([['staff', staffMoveset]])
  const listeners = new Map<keyof PlayerEvents, Set<(payload: never) => void>>()
  const hurtbox = new Phaser.Geom.Rectangle(0, 0, W, H)
  const attackPressed = { light: false, heavy: false }
  const attackEnv = { grounded: false, attackSpeed: 1, canStart: false }
  // Used on the down + jump step, so the jump press does not reach the motor.
  const dropPressed = new Set<string>()
  const dropInput: { held: ReadonlySet<string>; pressed: ReadonlySet<string>; released: ReadonlySet<string> } = {
    held: dropPressed,
    pressed: dropPressed,
    released: dropPressed,
  }

  const emit = <K extends keyof PlayerEvents>(event: K, payload: PlayerEvents[K]) => {
    const set = listeners.get(event)
    if (set) for (const listener of set) (listener as (p: PlayerEvents[K]) => void)(payload)
  }

  // Keeps one-way platforms solid only for a player that was above them on the previous step.
  const processCollision = (a: unknown, b: unknown): boolean => {
    const other = bodyOf(a === body ? b : a)
    if (!other || !isOneWay(other)) return true
    if (dropMs > 0) return false
    if (body.prev.y + H > other.top + 1) return false
    standingOnOneWay = true
    return true
  }
  const colliders = deps.colliders.map((target) => scene.physics.add.collider(body, target, undefined, processCollision))

  // Visuals. The container sits at the feet, the mage image hangs above it.
  const mageFrame = scene.textures.get(MAGE_TEXTURE).has(MAGE_FRAME) ? MAGE_FRAME : undefined
  const mage = scene.add.image(0, 0, MAGE_TEXTURE, mageFrame).setOrigin(0.5, 1)
  const baseScale = PLAYER_HEIGHT / Math.max(1, mage.height)
  const weaponArt = deps.art.playerWeapon(scene, build.weapons.light.id, build.weapons.light.tier)
  const weapon = scene.add.image(0, -20, weaponArt.textureKey).setOrigin(0.15, 0.5).setDisplaySize(26, 5)
  const weaponScaleX = Math.abs(weapon.scaleX)
  const container = scene.add.container(x, y, [weapon, mage]).setDepth(DEPTH.player)

  // A fixed pool for the dash smear, reused in turn.
  const ghosts = Array.from({ length: GHOST_COUNT }, () =>
    scene.add
      .image(0, 0, MAGE_TEXTURE, mageFrame)
      .setOrigin(0.5, 1)
      .setTint(PALETTE.blue)
      .setTintMode(Phaser.TintModes.FILL)
      .setDepth(DEPTH.player - 1)
      .setVisible(false),
  )
  const ghostLife = ghosts.map(() => 0)
  let nextGhost = 0

  const contextFor = (tier: 1 | 2): AttackContext => ({
    scene,
    combat: deps.combat,
    art: deps.art,
    player: handle,
    aim: { x: aim.x, y: aim.y },
    tier,
    rangeScale: build.stats.meleeRange,
  })

  const attacks = createAttackMachine({
    movesFor(slot: WeaponSlot) {
      const { id, tier } = build.weapons[slot]
      return (movesets.get(id) ?? staffMoveset).moves(slot, tier)
    },
    onStart(slot, comboIndex, move) {
      emit('attackStarted', { slot, comboIndex, move })
    },
    onActive(slot, comboIndex, move) {
      move.onActive(contextFor(build.weapons[slot].tier))
      if (move.lunge) motor.vx = motor.facing * move.lunge
      emit('attackActive', { slot, comboIndex, move })
    },
  })

  // Animation state, advanced per rendered frame.
  let squashX = 1
  let squashY = 1
  let lean = 0
  let flashMs = 0
  let flashing = false
  let ghostMs = 0

  const onStep = (deltaSeconds: number) => {
    if (destroyed) return
    if (frozen) {
      body.setVelocity(0, 0)
      body.resetFlags()
      return
    }
    const dt = deltaSeconds * 1000
    // Collisions in this step have already run, so the flags describe where the body is now.
    // Phaser clears them only once per frame, so clear them here for the next step.
    const wasGrounded = grounded
    grounded = justUnfrozen ? grounded : body.blocked.down
    motorEnv.grounded = grounded
    motorEnv.touchingWallLeft = body.blocked.left
    motorEnv.touchingWallRight = body.blocked.right
    const onOneWay = standingOnOneWay
    standingOnOneWay = false
    justUnfrozen = false
    body.resetFlags()
    motor.vx = body.velocity.x
    motor.vy = body.velocity.y

    const frame = deps.input.frame()
    aim = frame.aim
    flinchMs = Math.max(0, flinchMs - dt)
    damageIframesMs = Math.max(0, damageIframesMs - dt)
    dropMs = Math.max(0, dropMs - dt)
    for (let i = 0; i < abilityCooldowns.length; i++) abilityCooldowns[i] = Math.max(0, abilityCooldowns[i] - dt)

    if (grounded && !wasGrounded) {
      const fallSpeed = Math.max(0, lastVy)
      emit('landed', { fallSpeed })
      if (fallSpeed > 120) {
        const k = Math.min(1, fallSpeed / MOTOR.terminalFall)
        squashX = 1 + 0.32 * k
        squashY = 1 - 0.3 * k
      }
    }

    const controllable = flinchMs <= 0 && hp > 0
    let input: MotorInput = controllable ? frame : EMPTY_MOTOR_INPUT
    if (controllable && grounded && onOneWay && frame.held.has('down') && frame.pressed.has('jump')) {
      dropMs = DROP_THROUGH_MS
      dropPressed.clear()
      for (const action of frame.pressed) if (action !== 'jump') dropPressed.add(action)
      dropInput.held = frame.held
      dropInput.pressed = dropPressed
      dropInput.released = frame.released
      input = dropInput
    }

    motorEnv.actionsLocked = false
    motorEnv.speedScale = 1
    if (attacks.canCancel()) {
      const wantsJump = (input.pressed.has('jump') || motor.jumpBufferMs > 0) && availableJump(motor, motorEnv) !== null
      const wantsDash = input.pressed.has('dash') && canDash(motor, motorEnv)
      if (wantsJump || wantsDash) attacks.cancel()
    }
    attackPressed.light = controllable && frame.pressed.has('light')
    attackPressed.heavy = controllable && frame.pressed.has('heavy')
    attackEnv.grounded = grounded
    attackEnv.attackSpeed = build.stats.attackSpeed
    attackEnv.canStart = controllable && motor.dashMs <= 0
    attacks.step(dt, attackPressed, attackEnv)

    if (controllable) {
      for (let slot = 0; slot < ABILITY_ACTIONS.length; slot++) {
        const handler = abilityHandlers[slot]
        if (!handler || !frame.pressed.has(ABILITY_ACTIONS[slot]) || abilityCooldowns[slot] > 0) continue
        handler.activate(contextFor(1))
        abilityCooldowns[slot] = handler.cooldownMs
      }
    }

    motorEnv.actionsLocked = attacks.isLocked()
    motorEnv.speedScale = attacks.phase() !== 'idle' && grounded ? ATTACK_GROUND_SPEED : 1
    stepMotor(motor, input, motorEnv, dt, motor)
    if (motor.dashed) {
      emit('dashed', { direction: motor.dashDir })
      ghostMs = 0
    }
    if (motor.jumped) {
      squashX = 0.8
      squashY = 1.22
    }
    lastVy = motor.vy
    // A dash has no gravity, so the body would stop touching the floor and read as airborne.
    // A tiny downward push keeps the ground contact without moving the player visibly.
    const probe = motor.dashMs > 0 && grounded && !motor.jumped ? 1 : 0
    body.setVelocity(motor.vx, motor.vy + probe)
  }

  const spawnGhost = () => {
    const ghost = ghosts[nextGhost]
    ghostLife[nextGhost] = GHOST_LIFE_MS
    nextGhost = (nextGhost + 1) % GHOST_COUNT
    ghost
      .setPosition(container.x + mage.x, container.y + mage.y)
      .setScale(mage.scaleX, mage.scaleY)
      .setRotation(mage.rotation)
      .setAlpha(0.5)
      .setVisible(true)
  }

  const onRender = (_time: number, delta: number) => {
    if (destroyed) return
    container.setPosition(body.center.x, body.bottom)
    const dt = Math.min(delta, 50) / 1000
    const now = scene.time.now
    const ease = 1 - Math.exp(-dt * 14)
    squashX += (1 - squashX) * ease
    squashY += (1 - squashY) * ease

    const speed = runSpeed(motorEnv)
    const moving = Math.abs(motor.vx) > 10
    let bob = 0
    let breathe = 1
    if (grounded && !moving) {
      const wave = Math.sin((now / 1100) * Math.PI * 2)
      bob = wave * 0.6
      breathe = 1 + wave * 0.015
    } else if (grounded) {
      bob = -Math.abs(Math.sin(now * 0.016)) * 1.6
    }
    const targetLean = clamp1(motor.vx / speed) * 0.14 + (grounded ? 0 : clamp1(motor.vy / 600) * 0.05 * motor.facing)
    lean += (targetLean - lean) * (1 - Math.exp(-dt * 16))

    const attack = attacks.current()
    const phase = attacks.phase()
    let poke = 0
    if (attack && phase === 'startup') poke = -0.4
    else if (attack && phase === 'active') poke = 1
    else if (attack && phase === 'recovery') poke = 0.4
    const heavy = attack?.slot === 'heavy'

    mage.setPosition(0, bob)
    mage.setScale(baseScale * squashX * motor.facing, baseScale * squashY * breathe)
    mage.setRotation(lean + (poke > 0 ? poke * 0.08 * motor.facing : 0))

    weapon.setPosition(motor.facing * (6 + poke * 10), -20 + bob)
    weapon.scaleX = weaponScaleX * motor.facing
    const heavyAngle = phase === 'startup' ? -1.4 : phase === 'active' ? 0.5 : 0.2
    weapon.setRotation((heavy ? heavyAngle : 0.15) * motor.facing)

    if (motor.dashMs > 0) {
      ghostMs -= delta
      if (ghostMs <= 0) {
        spawnGhost()
        ghostMs = GHOST_INTERVAL_MS
      }
    }
    for (let i = 0; i < GHOST_COUNT; i++) {
      if (ghostLife[i] <= 0) continue
      ghostLife[i] -= delta
      if (ghostLife[i] <= 0) ghosts[i].setVisible(false)
      else ghosts[i].setAlpha((0.5 * ghostLife[i]) / GHOST_LIFE_MS)
    }

    flashMs = Math.max(0, flashMs - delta)
    const flash = flashMs > 0
    if (flash !== flashing) {
      flashing = flash
      if (flash) mage.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL)
      else mage.clearTint()
    }
    mage.setAlpha(damageIframesMs > 0 && !flash && Math.floor(now / 60) % 2 === 0 ? 0.35 : 1)
  }

  world.on('worldstep', onStep)
  scene.events.on('postupdate', onRender)

  const handle: Player = {
    id: 'player',
    team: 'player',
    killer: null,
    gameObject: container,
    // The same rectangle every call. Read it, do not keep it.
    hurtbox: () => hurtbox.setTo(body.x, body.y, W, H),
    facing: () => motor.facing,
    position: () => ({ x: body.center.x, y: body.bottom }),
    isInvulnerable: () => motor.dashIframesMs > 0 || damageIframesMs > 0,
    isDead: () => hp <= 0,
    receiveHit(hit) {
      if (hp <= 0 || handle.isInvulnerable()) return
      if (hit.damage >= hp && interceptor?.(hit)) return
      hp = Math.max(0, hp - hit.damage)
      attacks.cancel()
      motor.dashMs = 0
      motor.jumpHeld = false
      handle.setVelocity(hit.knockback.x, hit.knockback.y)
      flinchMs = FLINCH_MS
      damageIframesMs = DAMAGE_IFRAMES_MS
      flashMs = 70
      emit('damaged', { hit })
    },
    getBuild: () => ({ ...build, hp }),
    setBuild(next) {
      build = next
      hp = Math.min(next.hp, next.stats.maxHp)
      readBuild()
    },
    hp: () => hp,
    heal(amount) {
      if (hp <= 0) return
      hp = Math.min(build.stats.maxHp, hp + amount)
    },
    velocity: () => ({ x: motor.vx, y: motor.vy }),
    setVelocity(vx, vy) {
      motor.vx = vx
      motor.vy = vy
      if (!frozen) body.setVelocity(vx, vy)
    },
    teleport(tx, ty) {
      body.reset(tx - W / 2, ty - H)
      motor.vx = 0
      motor.vy = 0
      motor.dashMs = 0
      grounded = false
      container.setPosition(tx, ty)
    },
    isGrounded: () => grounded,
    on(event, listener) {
      const set = listeners.get(event) ?? new Set()
      set.add(listener as (payload: never) => void)
      listeners.set(event, set)
      return () => set.delete(listener as (payload: never) => void)
    },
    registerMoveset(moveset) {
      movesets.set(moveset.id, moveset)
    },
    setAbilityHandler(slot, handler) {
      if (slot < 0 || slot >= abilityHandlers.length) return
      abilityHandlers[slot] = handler
      abilityCooldowns[slot] = 0
    },
    abilityCooldownRemainingMs: (slot) => abilityCooldowns[slot] ?? 0,
    setLethalHitInterceptor(next) {
      interceptor = next
    },
    setFrozen(next) {
      if (next === frozen) return
      frozen = next
      if (frozen) {
        body.setVelocity(0, 0)
      } else {
        justUnfrozen = true
        body.setVelocity(motor.vx, motor.vy)
      }
    },
    debugState: () => ({ motor, grounded, attackPhase: attacks.phase(), flinchMs, damageIframesMs }),
    destroy() {
      if (destroyed) return
      destroyed = true
      world.off('worldstep', onStep)
      scene.events.off('postupdate', onRender)
      for (const collider of colliders) collider.destroy()
      deps.combat.unregister(handle)
      body.destroy()
      for (const ghost of ghosts) ghost.destroy()
      container.destroy()
    },
  }

  deps.combat.register(handle)
  scene.events.once('shutdown', handle.destroy)
  return handle
}
