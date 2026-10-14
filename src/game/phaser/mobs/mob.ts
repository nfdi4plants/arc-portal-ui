import Phaser from 'phaser'
import type { SpriteRef } from '../../contracts/art'
import type { Combatant, CombatWorld, HitEvent } from '../../contracts/combat'
import { DEPTH, PALETTE } from '../../contracts/constants'
import type { EnemyWeaponKind, MonsterSpec } from '../../contracts/content'
import { SUMMONED_SUFFIX } from '../../model/content'
import { MINION_ID_SUFFIX, applySpriteRef } from '../art'
import { bodyOf, isOneWay } from '../player/oneWay'
import { aimVelocity, lobFlightS, lobVelocity } from './aim'
import type { Vec } from './aim'
import { acquireBubble, releaseBubble } from './bubbles'
import { bubbleAt, chatterText, chunkText } from './chatter'
import { hitFromAbove, hitFromFront, incomingDamage } from './defense'
import { playFx } from './fx'
import { registerInspectable } from './inspect'
import { LEDGE_DEPTH, LEDGE_LOOKAHEAD, PIT_DEPTH, groundProbe, sameLevel, turnsAtLedge } from './ledge'
import type { Box } from './ledge'
import { approach, blinkDestination } from './motion'
import { dropShieldFragment } from './pickups'
import { hitReaction } from './reaction'
import { createStance, stanceMods, stepStance } from './stance'
import type { StanceMods } from './stance'
import {
  AGGRO_RELEASE,
  BLAST_RADIUS,
  BLINK_FLASH_MS,
  BLINK_MAX_MS,
  BLINK_MIN_MS,
  BLINK_REACH,
  BLINK_STAND_OFF,
  BOMB_FUSE_MS,
  BOMB_SLOTS,
  CONTACT_COOLDOWN_MS,
  CONTACT_KNOCKBACK,
  CONTACT_ACTIVE_MS,
  DEATH_MS,
  DIZZY_MIN_MS,
  FALL_LIMIT,
  GOLEM_DAMAGE,
  GOLEM_WINDUP_MS,
  GRAVITY,
  HIT_FLASH_MS,
  HIT_SQUASH,
  HIT_TILT_DEG,
  HIT_STUN_MS,
  HOVER_HEIGHT,
  INSPECT_DIM_DEPTH,
  HURTBOX_HEIGHT,
  HURTBOX_WIDTH,
  LAUNCH_GRACE_MS,
  LOB_GRAVITY,
  MAX_SPEED_X,
  MELEE,
  MINION_COUNT,
  MINION_DAMAGE_SHARE,
  MINION_HP_SHARE,
  PATROL_RADIUS,
  PROJECTILE_KNOCKBACK,
  RANGED,
  SQUASH_MS,
  STAGGER_RECOVER_MS,
  TERMINAL_FALL,
  WANDER_RADIUS,
} from './tuning'
import type { Mob, MobDeps } from './types'

const xpByMob = new WeakMap<Combatant, number>()
// Bodies of awake mobs per combat world, so a hit-stop can hold all of them in place.
const awakeBodies = new WeakMap<CombatWorld, Set<Phaser.Physics.Arcade.Body>>()
let nextId = 1

const NEUTRAL: StanceMods = { speed: 1, cooldown: 1, damageTaken: 1 }
const ZERO: Vec = { x: 0, y: 0 }
const TINT = { hit: 0xffffff, windup: 0xff7a3d, blink: 0xbfe9ff, aggressive: 0xff9d90, defensive: 0x93b4ff } as const

const HOP_SPEED = 340
const IMP_JUMP_SPEED = 380
const CHARGE_WINDUP_MS = 300
const CHARGE_RUN_MS = 700
const CHARGE_RECOVER_MS = 500
const CHARGE_COOLDOWN_MS = 1800
const CHARGE_FACTOR = 3.5
const DIVE_FACTOR = 2.6
const DIVE_MS = 900
const STEPS_PER_PROBE = 3
const RANGED_RECOVER_MS = 250

type MeleeKind = keyof typeof MELEE
type RangedKind = keyof typeof RANGED
type AttackPhase = 'idle' | 'windup' | 'recover'

interface Bomb {
  active: boolean
  x: number
  y: number
  vx: number
  vy: number
  ageMs: number
  handle: { cancel(): void } | null
}

function isMelee(kind: EnemyWeaponKind): kind is MeleeKind {
  return kind in MELEE
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function holdOnHitStop(combat: CombatWorld): Set<Phaser.Physics.Arcade.Body> {
  let bodies = awakeBodies.get(combat)
  if (!bodies) {
    const created = new Set<Phaser.Physics.Arcade.Body>()
    awakeBodies.set(combat, created)
    // The scene stops calling update() during a hit-stop, but Arcade keeps integrating velocity.
    // Mobs turn their bodies' movement off here and update() turns it back on.
    combat.on('hit', () => {
      if (combat.hitStopRemainingMs() <= 0) return
      for (const body of created) body.moves = false
    })
    bodies = created
  }
  return bodies
}

export function mobXp(target: Combatant): number {
  return xpByMob.get(target) ?? 0
}

// A weak slime that only touches. The label names its summoner, so the death screen does too.
function minionSpecOf(spec: MonsterSpec): MonsterSpec {
  return {
    ...spec,
    id: `${spec.id}${MINION_ID_SUFFIX}`,
    label: `${spec.label}${SUMMONED_SUFFIX}`,
    body: 'slime',
    size: 'small',
    xp: 0,
    stats: {
      hp: Math.max(1, Math.round(spec.stats.hp * MINION_HP_SHARE)),
      contactDamage: Math.max(1, Math.round(spec.stats.contactDamage * MINION_DAMAGE_SHARE)),
      speed: 50,
      aggroRange: Math.max(spec.stats.aggroRange, 240),
    },
  }
}

export function spawnMob(scene: Phaser.Scene, spec: MonsterSpec, deps: MobDeps, x: number, y: number): Mob {
  return createMob(scene, spec, deps, x, y, false)
}

function createMob(scene: Phaser.Scene, spec: MonsterSpec, deps: MobDeps, x: number, y: number, minion: boolean): Mob {
  const { combat, art, player } = deps
  const { weapon, stats } = spec
  const world = scene.physics.world
  const rng = deps.rng.fork(`mob:${spec.id}@${Math.round(x)},${Math.round(y)}`)
  const passive = minion ? null : spec.passive.kind
  const armed = !minion
  const flies = spec.body === 'wisp' || spec.body === 'bat'
  const awake = holdOnHitStop(combat)

  const ref = art.monster(scene, spec)
  const W = Math.max(8, Math.round(ref.width * HURTBOX_WIDTH))
  const H = Math.max(8, Math.round(ref.height * HURTBOX_HEIGHT))
  const halfW = W / 2
  // Flyers start in the air above the point the scene gives them.
  const startFeetY = y - (HOVER_HEIGHT[spec.body] ?? 0)
  const homeX = x
  const homeCy = startFeetY - H / 2

  const body = scene.physics.add.body(x - halfW, startFeetY - H, W, H)
  body.setAllowGravity(!flies)
  body.setGravityY(GRAVITY)
  body.setMaxVelocity(MAX_SPEED_X, TERMINAL_FALL)
  const hurt = new Phaser.Geom.Rectangle(0, 0, W, H)

  const sprite = scene.add.sprite(x, startFeetY, ref.textureKey).setDepth(DEPTH.enemies)
  applySpriteRef(sprite, ref)
  const baseScaleX = sprite.scaleX
  const baseScaleY = sprite.scaleY

  // A one-way platform only stops a body that was above it on the previous step.
  const processCollision = (a: unknown, b: unknown): boolean => {
    const other = bodyOf(a === body ? b : a)
    if (!other || !isOneWay(other)) return true
    return body.prev.y + H <= other.top + 1
  }
  const colliders = deps.colliders.map((target) => scene.physics.add.collider(body, target, undefined, processCollision))

  // State
  // Numbers that change every step live on one object. A number held in a closure variable is a
  // heap box that every write replaces, which adds up to garbage for dozens of awake mobs.
  const st = {
    hp: stats.hp,
    deathMs: 0,
    clockMs: rng.next() * 6000,
    px: 0,
    pcy: 0,
    pFeet: 0,
    pHalfW: 0,
    pHalfH: 0,
    dx: 0,
    stunMs: 0,
    flashMs: 0,
    contactMs: 0,
    attackCdMs: rng.int(0, Math.min(800, weapon.cooldownMs)),
    phaseMs: 0,
    targetVx: 0,
    wanderMs: rng.int(300, 1500),
    hopMs: rng.int(200, 900),
    jumpMs: rng.int(600, 1600),
    chargeMs: 0,
    chargeCdMs: rng.int(500, 1500),
    swoopMs: 0,
    swoopCdMs: rng.int(300, 1500),
    diveVx: 0,
    diveVy: 0,
    wispBase: homeCy,
    blinkCdMs: rng.int(BLINK_MIN_MS, BLINK_MAX_MS),
    blinkMs: 0,
    blinkX: 0,
    blinkCy: 0,
    chatterMs: 0,
    staggerMs: 0,
    squashMs: 0,
    tiltDir: 1,
    squashAmount: 0,
    airborneMs: 0,
  }
  let facing: 1 | -1 = 1
  let flipped = false
  let asleep = false
  let dead = false
  let destroyed = false

  let onGround = false
  let wallLeft = false
  let wallRight = false
  let ceiling = false
  let aggro = false
  let phase: AttackPhase = 'idle'
  let activeBox: { cancel(): void } | null = null
  let projectileRef: SpriteRef | null = null
  const bombs: Bomb[] = []
  let wanderDir: -1 | 0 | 1 = 0
  let routeDir: -1 | 1 = rng.chance(0.5) ? 1 : -1
  let charge: 'none' | 'windup' | 'run' | 'recover' = 'none'
  let swoop: 'perch' | 'dive' | 'rise' = 'perch'

  const probe: Box = { minX: 0, minY: 0, maxX: 0, maxY: 0 }
  const lookAhead = spec.body === 'slime' ? 34 : LEDGE_LOOKAHEAD
  let probeCount = 0
  let probedDir = 0
  let groundAheadCached = true
  let pitAheadCached = false

  const stance = passive === 'stanceShift' ? createStance(rng.int(0, 2900), rng.chance(0.5)) : null
  let mods = stance ? stanceMods(stance) : NEUTRAL
  const minions: Mob[] = []
  let summoned = false
  let ghost: Phaser.GameObjects.Sprite | null = null
  const lines = passive === 'chatter' ? chunkText(chatterText(spec.source.name, spec.source.value, spec.source.unit)) : []
  let bubble: Phaser.GameObjects.Text | null = null
  let shownLine = -1
  let bubbleUp = false
  let tintCode = 0
  let dizzy = false
  let dizzyStars: Phaser.GameObjects.Sprite[] | null = null
  let launched = false
  let inspectable = false
  let highlight = 0

  const cx = () => body.x + halfW
  const cy = () => body.y + H / 2
  const feetY = () => body.y + H

  // Perception

  function readWorld() {
    onGround = body.blocked.down
    wallLeft = body.blocked.left
    wallRight = body.blocked.right
    ceiling = body.blocked.up
    // Arcade clears these flags once per frame, so with several steps per frame they would go stale.
    body.resetFlags()
    const box = player.hurtbox()
    st.pHalfW = box.width / 2
    st.pHalfH = box.height / 2
    st.px = box.x + st.pHalfW
    st.pcy = box.y + box.height / 2
    st.pFeet = box.bottom
    st.dx = st.px - cx()
    const dyc = st.pcy - cy()
    const range = stats.aggroRange * (aggro ? AGGRO_RELEASE : 1)
    aggro = !player.isDead() && st.dx * st.dx + dyc * dyc <= range * range
  }

  // True when the walker has to stop or turn at the edge ahead of it. The probes refresh every few steps.
  function stopsAtLedge(dir: 1 | -1, chasing: boolean): boolean {
    if (dir !== probedDir || ++probeCount >= STEPS_PER_PROBE) {
      probeCount = 0
      probedDir = dir
      groundAheadCached = world.staticTree.collides(groundProbe(probe, cx(), feetY(), dir, halfW, lookAhead))
      // The deep probe only runs at an edge.
      pitAheadCached = !groundAheadCached && !world.staticTree.collides(groundProbe(probe, cx(), feetY(), dir, halfW, lookAhead, PIT_DEPTH))
    }
    return !groundAheadCached && turnsAtLedge(chasing, sameLevel(feetY(), st.pFeet), spec.body === 'crawler', pitAheadCached)
  }

  // Aims the walker at `speed` in `dir`. Returns false when a wall or a ledge stops it.
  function walk(dir: -1 | 0 | 1, speed: number, chasing: boolean): boolean {
    if (dir === 0) {
      st.targetVx = 0
      return true
    }
    facing = dir
    st.targetVx = 0
    if (dir > 0 ? wallRight : wallLeft) return false
    if (onGround && stopsAtLedge(dir, chasing)) return false
    st.targetVx = dir * speed
    return true
  }

  function faceTarget() {
    facing = st.dx >= 0 ? 1 : -1
  }

  // Movement

  // Back and forth along a fixed route, or along the whole platform for a crawler.
  function routeWalk(speed: number, radius: number | null) {
    if (radius !== null) {
      if (cx() >= homeX + radius) routeDir = -1
      else if (cx() <= homeX - radius) routeDir = 1
    }
    if (!walk(routeDir, speed, false)) routeDir = routeDir === 1 ? -1 : 1
  }

  function idleWalk(dt: number, speed: number) {
    st.wanderMs -= dt
    if (st.wanderMs <= 0) {
      const offset = cx() - homeX
      const roll = rng.next()
      if (Math.abs(offset) > WANDER_RADIUS) wanderDir = offset > 0 ? -1 : 1
      else wanderDir = roll < 0.35 ? 0 : roll < 0.675 ? -1 : 1
      st.wanderMs = wanderDir === 0 ? rng.int(600, 1800) : rng.int(600, 1500)
    }
    if (!walk(wanderDir, speed * 0.45, false) && wanderDir !== 0) {
      wanderDir = wanderDir === 1 ? -1 : 1
      st.wanderMs = rng.int(600, 1500)
    }
  }

  // Close enough to start swinging. Melee mobs stop short of the player, ranged ones keep distance.
  function holdsGround(): boolean {
    if (!armed) return Math.abs(st.dx) < 4
    const gap = Math.abs(st.dx) - halfW - st.pHalfW
    return isMelee(weapon.kind) ? gap <= weapon.range * 0.5 : Math.abs(st.dx) <= weapon.range * 0.7
  }

  function chaseWalk(speed: number) {
    faceTarget()
    if (holdsGround()) {
      st.targetVx = 0
      return
    }
    walk(facing, speed, true)
  }

  function thinkGround(dt: number) {
    const speed = stats.speed * mods.speed
    if (st.stunMs > 0 || st.blinkMs > 0 || phase !== 'idle') {
      st.targetVx = 0
      return
    }
    const chasing = aggro && passive !== 'patrol'
    switch (spec.body) {
      case 'turret':
        st.targetVx = 0
        if (aggro || passive === 'patrol') faceTarget()
        return
      case 'slime':
        thinkSlime(dt, speed, chasing)
        return
      case 'beetle':
        thinkBeetle(dt, speed, chasing)
        return
      case 'crawler':
        if (chasing) chaseWalk(speed)
        else routeWalk(speed * 0.7, passive === 'patrol' ? PATROL_RADIUS : null)
        return
      case 'imp':
        if (chasing) {
          chaseWalk(speed)
          st.jumpMs -= dt
          if (onGround && st.jumpMs <= 0) {
            const away = Math.abs(st.dx) < 50 ? -1 : 1
            st.targetVx = facing * away * speed * 1.4
            body.setVelocity(st.targetVx, -IMP_JUMP_SPEED)
            st.jumpMs = rng.int(1100, 2200)
          }
        } else if (passive === 'patrol') routeWalk(speed * 0.8, PATROL_RADIUS)
        else idleWalk(dt, speed)
        return
      default:
        if (chasing) chaseWalk(speed)
        else if (passive === 'patrol') routeWalk(speed * 0.8, PATROL_RADIUS)
        else idleWalk(dt, speed)
    }
  }

  function thinkSlime(dt: number, speed: number, chasing: boolean) {
    // Airborne hops keep their speed: air control is off for slimes.
    st.targetVx = 0
    if (!onGround) return
    st.hopMs -= dt
    if (st.hopMs > 0) return
    let dir: -1 | 1
    if (chasing) {
      faceTarget()
      if (holdsGround()) {
        st.hopMs = 200
        return
      }
      dir = facing
    } else if (passive === 'patrol') {
      if (cx() >= homeX + PATROL_RADIUS) routeDir = -1
      else if (cx() <= homeX - PATROL_RADIUS) routeDir = 1
      dir = routeDir
    } else {
      const offset = cx() - homeX
      dir = Math.abs(offset) > WANDER_RADIUS ? (offset > 0 ? -1 : 1) : rng.chance(0.5) ? 1 : -1
    }
    facing = dir
    if ((dir > 0 ? wallRight : wallLeft) || stopsAtLedge(dir, chasing)) {
      routeDir = dir === 1 ? -1 : 1
      st.hopMs = chasing ? 300 : 400
      return
    }
    const vx = dir * speed * (chasing || passive === 'patrol' ? 2.4 : 1.4)
    body.setVelocity(vx, -HOP_SPEED)
    st.targetVx = vx
    st.hopMs = chasing || passive === 'patrol' ? 650 : rng.int(1200, 2200)
  }

  function thinkBeetle(dt: number, speed: number, chasing: boolean) {
    st.chargeCdMs -= dt
    if (charge === 'windup') {
      st.targetVx = 0
      st.chargeMs -= dt
      if (st.chargeMs <= 0) {
        charge = 'run'
        st.chargeMs = CHARGE_RUN_MS
      }
      return
    }
    if (charge === 'run') {
      st.chargeMs -= dt
      if (!walk(facing, speed * CHARGE_FACTOR, true) || st.chargeMs <= 0) endCharge(CHARGE_RECOVER_MS)
      return
    }
    if (charge === 'recover') {
      st.targetVx = 0
      st.chargeMs -= dt
      if (st.chargeMs <= 0) charge = 'none'
      return
    }
    if (chasing && onGround && st.chargeCdMs <= 0 && Math.abs(st.pFeet - feetY()) < 36 && Math.abs(st.dx) > 60) {
      faceTarget()
      charge = 'windup'
      st.chargeMs = CHARGE_WINDUP_MS
      st.targetVx = 0
      return
    }
    if (chasing) chaseWalk(speed)
    else if (passive === 'patrol') routeWalk(speed * 0.8, PATROL_RADIUS)
    else idleWalk(dt, speed)
  }

  function endCharge(recoverMs: number) {
    charge = recoverMs > 0 ? 'recover' : 'none'
    st.chargeMs = recoverMs
    st.chargeCdMs = CHARGE_COOLDOWN_MS
  }

  function thinkFlying(dt: number) {
    const speed = stats.speed * mods.speed
    const seconds = dt / 1000
    if (st.stunMs > 0 || st.blinkMs > 0) {
      body.setVelocity(approach(body.velocity.x, 0, 600 * seconds), approach(body.velocity.y, 0, 600 * seconds))
      return
    }
    const chasing = aggro && passive !== 'patrol'
    const slow = phase === 'idle' ? 1 : 0.25
    if (spec.body === 'wisp') thinkWisp(dt, speed, chasing, slow)
    else thinkBat(dt, speed, chasing, slow)
  }

  function thinkWisp(dt: number, speed: number, chasing: boolean, slow: number) {
    // The sine runs in radians per millisecond: about a 2.4 s period.
    const w = st.clockMs * 0.0026
    const base = chasing ? clamp(st.pcy - 8, homeCy - 72, homeCy + 48) : homeCy
    st.wispBase += (base - st.wispBase) * Math.min(1, dt * 0.004)
    const wantY = st.wispBase + Math.sin(w) * 12
    const vy = clamp(Math.cos(w) * 31 + (wantY - cy()) * 6, -speed * 2, speed * 2)
    let vx: number
    if (chasing) {
      faceTarget()
      vx = Math.abs(st.dx) > 20 ? Math.sign(st.dx) * speed * 0.7 : 0
    } else if (passive === 'patrol') {
      if (cx() >= homeX + PATROL_RADIUS) routeDir = -1
      else if (cx() <= homeX - PATROL_RADIUS) routeDir = 1
      vx = routeDir * speed * 0.8
      facing = routeDir
    } else {
      vx = clamp((homeX + Math.sin(st.clockMs * 0.0017) * 24 - cx()) * 3, -speed, speed)
      if (Math.abs(vx) > 5) facing = vx > 0 ? 1 : -1
    }
    body.setVelocity(approach(body.velocity.x, vx * slow, 900 * (dt / 1000)), vy * slow)
  }

  function thinkBat(dt: number, speed: number, chasing: boolean, slow: number) {
    const seconds = dt / 1000
    if (swoop === 'dive') {
      st.swoopMs -= dt
      body.setVelocity(st.diveVx, st.diveVy)
      if (st.swoopMs <= 0 || cy() >= st.pcy + 8 || ceiling || wallLeft || wallRight || onGround) {
        swoop = 'rise'
        st.swoopCdMs = rng.int(1400, 2600)
      }
      return
    }
    if (swoop === 'rise') {
      const vy = clamp((homeCy - cy()) * 4, -speed * 1.2, speed * 1.2)
      body.setVelocity(facing * speed * 0.8, vy)
      if (Math.abs(cy() - homeCy) < 6) swoop = 'perch'
      return
    }
    st.swoopCdMs -= dt
    const sway = Math.sin(st.clockMs * 0.003) * 5
    const vy = clamp((homeCy + sway - cy()) * 4, -speed, speed)
    let vx: number
    if (chasing) {
      faceTarget()
      vx = Math.abs(st.dx) > 30 ? Math.sign(st.dx) * speed * 0.5 : 0
      if (st.swoopCdMs <= 0 && phase === 'idle') {
        const tx = st.px - cx()
        const ty = st.pcy - cy()
        const length = Math.hypot(tx, ty) || 1
        st.diveVx = (tx / length) * speed * DIVE_FACTOR
        st.diveVy = (ty / length) * speed * DIVE_FACTOR
        swoop = 'dive'
        st.swoopMs = DIVE_MS
        return
      }
    } else if (passive === 'patrol') {
      if (cx() >= homeX + PATROL_RADIUS) routeDir = -1
      else if (cx() <= homeX - PATROL_RADIUS) routeDir = 1
      vx = routeDir * speed * 0.8
      facing = routeDir
    } else {
      vx = clamp((homeX + Math.sin(st.clockMs * 0.0011) * 16 - cx()) * 3, -speed, speed)
      if (Math.abs(vx) > 5) facing = vx > 0 ? 1 : -1
    }
    body.setVelocity(approach(body.velocity.x, vx * slow, 900 * seconds), vy * slow)
  }

  function applyGroundVelocity(dt: number) {
    // Slimes and imps commit to a hop, everyone else steers a little in the air.
    const airAccel = spec.body === 'slime' || spec.body === 'imp' ? 0 : 500
    const accel = st.stunMs > 0 ? 600 : onGround ? 2400 : airAccel
    if (accel > 0) body.velocity.x = approach(body.velocity.x, st.targetVx, accel * (dt / 1000))
  }

  // Weapons

  function lockedByBody(): boolean {
    return charge !== 'none' || swoop === 'dive' || st.blinkMs > 0
  }

  function inReach(): boolean {
    if (isMelee(weapon.kind)) {
      const gap = Math.abs(st.dx) - halfW - st.pHalfW
      const h = Math.max(14, H * MELEE[weapon.kind].thickness * weapon.scale)
      return gap <= weapon.range && Math.abs(st.pcy - cy()) <= (H + h) / 2 + st.pHalfH
    }
    const dyc = st.pcy - cy()
    return st.dx * st.dx + dyc * dyc <= weapon.range * weapon.range
  }

  function windupMs(): number {
    const base = isMelee(weapon.kind) ? MELEE[weapon.kind].windupMs : RANGED[weapon.kind].windupMs
    return base + (spec.body === 'golem' ? GOLEM_WINDUP_MS : 0)
  }

  function updateAttack(dt: number) {
    st.attackCdMs -= dt
    if (phase === 'windup') {
      st.phaseMs -= dt
      if (st.phaseMs <= 0) {
        fire()
        phase = 'recover'
        st.phaseMs = isMelee(weapon.kind) ? MELEE[weapon.kind].recoverMs : RANGED_RECOVER_MS
      }
      return
    }
    if (phase === 'recover') {
      st.phaseMs -= dt
      if (st.phaseMs <= 0) phase = 'idle'
      return
    }
    if (st.attackCdMs > 0 || st.stunMs > 0 || lockedByBody()) return
    if (!(aggro || passive === 'patrol') || !inReach()) return
    faceTarget()
    phase = 'windup'
    st.phaseMs = windupMs()
  }

  function fire() {
    st.attackCdMs = weapon.cooldownMs * mods.cooldown
    if (isMelee(weapon.kind)) fireMelee(weapon.kind)
    else fireRanged(weapon.kind)
  }

  function fireMelee(kind: MeleeKind) {
    const tune = MELEE[kind]
    const golem = spec.body === 'golem'
    const h = Math.max(14, H * tune.thickness * weapon.scale)
    activeBox = combat.spawnHitbox({
      owner: mob,
      shape: { kind: 'rect', x: halfW - 2, y: -(H + h) / 2, w: weapon.range + 2, h },
      follow: true,
      activeMs: tune.activeMs,
      damage: Math.round(weapon.damage * (golem ? GOLEM_DAMAGE : 1)),
      knockback: { x: tune.knockback.x * (golem ? 1.3 : 1), y: tune.knockback.y },
      hitStopMs: 50,
      maxTargets: 1,
      tags: ['mob', 'melee'],
    })
  }

  function fireRanged(kind: RangedKind) {
    const tune = RANGED[kind]
    faceTarget()
    const anchor = ref.anchors.weapon
    const origin = { x: cx() + facing * anchor.x, y: feetY() + anchor.y }
    const playerVelocity = weapon.calibrated ? player.velocity() : ZERO
    projectileRef ??= art.projectile(scene, tune.art)
    const size = { w: tune.size.w * weapon.scale, h: tune.size.h * weapon.scale }
    const damage = weapon.damage
    const base = { owner: mob, textureKey: projectileRef.textureKey, animKey: projectileRef.animKey, pierce: 0, reflectable: true, hitStopMs: 40, maxTargets: 1, tags: ['mob', 'projectile'] }

    if (kind === 'bow' || kind === 'wand') {
      const velocity = aimVelocity(origin, { x: st.px, y: st.pcy }, playerVelocity, tune.speed, weapon.calibrated, rng.next())
      combat.spawnProjectile(
        {
          ...base,
          shape: kind === 'bow' ? { kind: 'rect', x: -size.w / 2, y: -size.h / 2, w: size.w, h: size.h } : { kind: 'circle', x: 0, y: 0, r: size.w / 2 },
          velocity,
          gravity: 0,
          lifetimeMs: ((weapon.range * 1.3) / tune.speed) * 1000,
          damage,
          knockback: PROJECTILE_KNOCKBACK,
        },
        origin,
      )
      return
    }

    const target = { x: st.px, y: kind === 'bomb' ? st.pFeet - 4 : st.pcy }
    const flightS = lobFlightS(Math.hypot(target.x - origin.x, target.y - origin.y))
    const velocity = lobVelocity(origin, target, playerVelocity, flightS, LOB_GRAVITY, weapon.calibrated, rng.next())
    if (kind === 'flask') {
      combat.spawnProjectile(
        { ...base, shape: { kind: 'circle', x: 0, y: 0, r: size.w / 2 }, velocity, gravity: LOB_GRAVITY, lifetimeMs: flightS * 1000, damage, knockback: PROJECTILE_KNOCKBACK },
        origin,
      )
      return
    }
    launchBomb(origin, velocity, projectileRef)
  }

  // The bomb flies as a harmless projectile (it can never hit anything) and the mob tracks the
  // same arc itself, since projectiles have no terrain contact.
  function launchBomb(origin: Vec, velocity: Vec, shot: SpriteRef) {
    let slot = bombs.find((bomb) => !bomb.active)
    if (!slot) {
      if (bombs.length >= BOMB_SLOTS) return
      slot = { active: false, x: 0, y: 0, vx: 0, vy: 0, ageMs: 0, handle: null }
      bombs.push(slot)
    }
    slot.active = true
    slot.x = origin.x
    slot.y = origin.y
    slot.vx = velocity.x
    slot.vy = velocity.y
    slot.ageMs = 0
    slot.handle = combat.spawnProjectile(
      {
        owner: mob,
        textureKey: shot.textureKey,
        animKey: shot.animKey,
        shape: { kind: 'circle', x: 0, y: 0, r: 0 },
        velocity,
        gravity: LOB_GRAVITY,
        lifetimeMs: BOMB_FUSE_MS + 50,
        pierce: 0,
        reflectable: false,
        damage: 0,
        knockback: ZERO,
        hitStopMs: 0,
        maxTargets: 0,
        tags: ['mob', 'bomb'],
      },
      origin,
    )
  }

  function updateBombs(dt: number) {
    if (bombs.length === 0) return
    const seconds = dt / 1000
    for (const bomb of bombs) {
      if (!bomb.active) continue
      const fromX = bomb.x
      const fromY = bomb.y
      // Move, then apply gravity, as the combat world does, so the sprite and the blast agree.
      bomb.x += bomb.vx * seconds
      bomb.y += bomb.vy * seconds
      bomb.vy += LOB_GRAVITY * seconds
      bomb.ageMs += dt
      let landed = false
      if (bomb.vy > 0) {
        probe.minX = Math.min(fromX, bomb.x) - 3
        probe.maxX = Math.max(fromX, bomb.x) + 3
        probe.minY = Math.min(fromY, bomb.y) - 3
        probe.maxY = Math.max(fromY, bomb.y) + 3
        landed = world.staticTree.collides(probe)
      }
      if (landed || bomb.ageMs >= BOMB_FUSE_MS) explode(bomb)
    }
  }

  function explode(bomb: Bomb) {
    bomb.active = false
    bomb.handle?.cancel()
    bomb.handle = null
    const r = BLAST_RADIUS * weapon.scale
    combat.spawnHitbox({
      owner: mob,
      // Shapes are relative to the feet and mirrored with the owner's facing.
      shape: { kind: 'circle', x: (bomb.x - cx()) * facing, y: bomb.y - feetY(), r },
      follow: false,
      activeMs: 120,
      damage: weapon.damage,
      knockback: { x: (st.px >= bomb.x ? 260 : -260) * facing, y: -220 },
      hitStopMs: 60,
      maxTargets: Infinity,
      tags: ['mob', 'explosion'],
    })
    playFx(scene, art, 'crit', bomb.x, bomb.y, r * 2)
  }

  function cancelAttacks() {
    activeBox?.cancel()
    activeBox = null
    for (const bomb of bombs) {
      bomb.handle?.cancel()
      bomb.handle = null
      bomb.active = false
    }
    phase = 'idle'
    st.phaseMs = 0
    charge = 'none'
    if (swoop === 'dive') swoop = 'rise'
    st.blinkMs = 0
    ghost?.setVisible(false)
  }

  // A stagger breaks the swing in progress. Bombs already thrown keep flying.
  function interruptAttack() {
    activeBox?.cancel()
    activeBox = null
    phase = 'idle'
    st.phaseMs = 0
    if (charge !== 'none') endCharge(300)
    if (swoop === 'dive') swoop = 'rise'
    if (st.blinkMs > 0) {
      st.blinkMs = 0
      ghost?.setVisible(false)
    }
  }

  function touchPlayer(dt: number) {
    st.contactMs -= dt
    if (st.contactMs > 0 || stats.contactDamage <= 0) return
    const box = player.hurtbox()
    if (box.x >= body.x + W || box.right <= body.x || box.y >= body.y + H || box.bottom <= body.y) return
    st.contactMs = CONTACT_COOLDOWN_MS
    // Knockback is relative to the facing, so a player behind the mob needs the negative side.
    const side = st.dx * facing >= 0 ? 1 : -1
    combat.spawnHitbox({
      owner: mob,
      shape: { kind: 'rect', x: -halfW, y: -H, w: W, h: H },
      follow: true,
      activeMs: CONTACT_ACTIVE_MS,
      damage: stats.contactDamage,
      knockback: { x: CONTACT_KNOCKBACK.x * side, y: CONTACT_KNOCKBACK.y },
      hitStopMs: 40,
      maxTargets: 1,
      tags: ['mob', 'contact'],
    })
  }

  // Passives

  function summon() {
    summoned = true
    const minionSpec = minionSpecOf(spec)
    for (let i = 0; i < MINION_COUNT; i++) {
      const offset = (i === 0 ? -1 : 1) * 16
      minions.push(createMob(scene, minionSpec, deps, cx() + offset, feetY(), true))
    }
  }

  function spotFree(centerX: number, centerY: number): boolean {
    probe.minX = centerX - halfW + 2
    probe.maxX = centerX + halfW - 2
    probe.minY = centerY - H / 2 + 2
    probe.maxY = centerY + H / 2 - 2
    if (world.staticTree.collides(probe)) return false
    if (flies) return true
    probe.minY = centerY + H / 2 - 2
    probe.maxY = centerY + H / 2 + LEDGE_DEPTH
    return world.staticTree.collides(probe)
  }

  function updateBlink(dt: number) {
    if (st.blinkMs > 0) {
      st.blinkMs -= dt
      ghost?.setAlpha(Math.floor(st.clockMs / 60) % 2 === 0 ? 0.7 : 0.25)
      if (st.blinkMs <= 0) {
        ghost?.setVisible(false)
        body.reset(st.blinkX - halfW, st.blinkCy - H / 2)
        st.blinkCdMs = rng.int(BLINK_MIN_MS, BLINK_MAX_MS)
      }
      return
    }
    st.blinkCdMs -= dt
    if (st.blinkCdMs > 0 || !aggro || phase !== 'idle' || st.stunMs > 0 || lockedByBody()) return
    const spot = blinkDestination({
      mob: { x: cx(), y: cy() },
      player: { x: st.px, y: st.pcy },
      flies,
      flank: rng.chance(0.4),
      reach: BLINK_REACH,
      standOff: BLINK_STAND_OFF,
    })
    if (!spot || !spotFree(spot.x, spot.y)) {
      st.blinkCdMs = 600
      return
    }
    st.blinkX = spot.x
    st.blinkCy = spot.y
    st.blinkMs = BLINK_FLASH_MS
    if (!ghost) {
      ghost = scene.add.sprite(spot.x, spot.y + H / 2, ref.textureKey).setDepth(DEPTH.enemies - 1)
      applySpriteRef(ghost, ref)
      ghost.setTint(TINT.hit).setTintMode(Phaser.TintModes.FILL)
    }
    ghost.setPosition(spot.x, spot.y + H / 2).setFlipX(flipped).setVisible(true)
  }

  function updateChatter(dt: number) {
    st.chatterMs += dt
    const state = bubbleAt(st.chatterMs, lines.length)
    bubble ??= acquireBubble(scene)
    if (state.index !== shownLine) {
      shownLine = state.index
      bubble.setText(lines[state.index])
    }
    if (state.visible !== bubbleUp) {
      bubbleUp = state.visible
      bubble.setVisible(state.visible)
    }
    bubble.setPosition(cx(), feetY() - ref.height - 3)
  }

  function dropBubble() {
    if (bubble) releaseBubble(scene, bubble)
    bubble = null
    shownLine = -1
    bubbleUp = false
  }

  // Looks

  function refreshTint() {
    const flicker = Math.floor(st.clockMs / 60) % 2 === 0
    let code = 0
    if (st.flashMs > 0) code = 1
    else if ((phase === 'windup' || charge === 'windup') && flicker) code = 2
    else if (st.blinkMs > 0 && flicker) code = 3
    else if (stance) code = stance.aggressive ? 4 : 5
    if (code === tintCode) return
    tintCode = code
    if (code === 0) sprite.clearTint()
    else if (code === 1) sprite.setTint(TINT.hit).setTintMode(Phaser.TintModes.FILL)
    else if (code === 2) sprite.setTint(TINT.windup).setTintMode(Phaser.TintModes.FILL)
    else if (code === 3) sprite.setTint(TINT.blink).setTintMode(Phaser.TintModes.FILL)
    else sprite.setTint(code === 4 ? TINT.aggressive : TINT.defensive).setTintMode(Phaser.TintModes.MULTIPLY)
  }

  function updateDizzy() {
    const show = dizzy && st.staggerMs > 0
    if (!show) {
      if (dizzyStars) for (const star of dizzyStars) star.setVisible(false)
      return
    }
    if (!dizzyStars) {
      const orb = art.projectile(scene, 'orb')
      dizzyStars = [0, 1, 2].map(() => {
        const star = scene.add.sprite(0, 0, orb.textureKey).setDepth(DEPTH.enemies + 3)
        applySpriteRef(star, { ...orb, width: 7, height: 7 })
        return star.setOrigin(0.5, 0.5).setTint(PALETTE.yellow)
      })
    }
    const top = feetY() - ref.height
    for (let i = 0; i < dizzyStars.length; i++) {
      const angle = st.clockMs / 200 + (i * Math.PI * 2) / dizzyStars.length
      dizzyStars[i].setVisible(true).setPosition(cx() + Math.cos(angle) * halfW, top + Math.sin(angle) * 4)
    }
  }

  function hideDizzy() {
    dizzy = false
    if (dizzyStars) for (const star of dizzyStars) star.setVisible(false)
  }

  // A quick squash and a lean away from the hit that relax together.
  function applySquash() {
    if (st.squashMs <= 0) {
      if (sprite.angle !== 0 || sprite.scaleY !== baseScaleY) sprite.setAngle(0).setScale(baseScaleX, baseScaleY)
      return
    }
    const t = (st.squashMs / SQUASH_MS) * st.squashAmount
    sprite.setAngle(st.tiltDir * HIT_TILT_DEG * t)
    sprite.setScale(baseScaleX * (1 + HIT_SQUASH * 0.8 * t), baseScaleY * (1 - HIT_SQUASH * t))
  }

  function syncSprite() {
    sprite.setPosition(cx(), feetY())
    const flip = facing === -1
    if (flip !== flipped) {
      flipped = flip
      sprite.setFlipX(flip)
    }
  }

  // Inspection

  function applyInspect() {
    if (destroyed) return
    const can = inspectable && !asleep && !dead
    if (can) {
      if (!sprite.input?.enabled) sprite.setInteractive({ useHandCursor: true })
    } else if (sprite.input?.enabled) sprite.disableInteractive()
  }

  function setHighlight(level: number) {
    if (destroyed || level === highlight) return
    highlight = level
    if (level <= 0) {
      tintCode = -1
      refreshTint()
      return
    }
    const grey = Math.round(0x18 + 0x40 * level)
    sprite.setTint((grey << 16) | (grey << 8) | grey).setTintMode(Phaser.TintModes.ADD)
    tintCode = -2
  }

  // Draws the sprite above the pause dim.
  function setRaised(on: boolean) {
    if (!destroyed) sprite.setDepth(on ? INSPECT_DIM_DEPTH + 1 : DEPTH.enemies)
  }

  function setInspectable(on: boolean) {
    inspectable = on
    for (const minionMob of minions) minionMob.setInspectable(on)
    if (!on) setHighlight(0)
    applyInspect()
  }

  // Life cycle

  function leaveWorld() {
    combat.unregister(mob)
    awake.delete(body)
    world.disableBody(body)
    for (const collider of colliders) collider.active = false
    applyInspect()
  }

  function die() {
    dead = true
    st.hp = 0
    leaveWorld()
    cancelAttacks()
    hideDizzy()
    dropBubble()
    st.flashMs = HIT_FLASH_MS
    playFx(scene, art, 'death', cx(), feetY() - H / 2, Math.max(ref.width, ref.height) * 1.1)
    if (passive === 'shieldDrop') dropShieldFragment(scene, cx(), feetY() - 10)
  }

  // A mob that fell out of the level leaves quietly: no effect, no drop.
  function vanish() {
    dead = true
    st.deathMs = DEATH_MS
    leaveWorld()
    cancelAttacks()
    hideDizzy()
    dropBubble()
    sprite.setVisible(false)
  }

  function updateMinions(dt: number) {
    let kept = 0
    for (const minionMob of minions) {
      if (minionMob.isGone()) {
        minionMob.destroy()
        continue
      }
      minionMob.update(dt)
      minions[kept++] = minionMob
    }
    minions.length = kept
  }

  // Dust where a launched mob comes down again.
  function checkLanding(dt: number) {
    st.airborneMs += dt
    if (st.airborneMs < LAUNCH_GRACE_MS || !onGround) return
    launched = false
    playFx(scene, art, 'dust', cx(), feetY() - 4, W * 1.4)
  }

  function update(dt: number) {
    if (asleep || destroyed) return
    body.moves = true
    st.clockMs += dt
    st.stunMs = Math.max(0, st.stunMs - dt)
    st.flashMs = Math.max(0, st.flashMs - dt)
    st.staggerMs = Math.max(0, st.staggerMs - dt)
    st.squashMs = Math.max(0, st.squashMs - dt)

    if (dead) {
      st.deathMs += dt
      sprite.setAlpha(clamp(1 - st.deathMs / DEATH_MS, 0, 1))
      updateMinions(dt)
      refreshTint()
      applySquash()
      return
    }

    readWorld()
    if (body.y > startFeetY + FALL_LIMIT) {
      vanish()
      return
    }

    if (stance && stepStance(stance, dt)) mods = stanceMods(stance)
    if (passive === 'summoner' && aggro && !summoned) summon()
    if (passive === 'blink') updateBlink(dt)
    // Before updateAttack, so a bomb launched in this step stays where it is. The combat world
    // moves its projectile for the first time on the next step.
    updateBombs(dt)
    if (armed) updateAttack(dt)

    if (flies) thinkFlying(dt)
    else {
      thinkGround(dt)
      applyGroundVelocity(dt)
    }

    if (st.staggerMs <= 0) touchPlayer(dt)
    if (launched) checkLanding(dt)
    if (passive === 'chatter') updateChatter(dt)
    if (minions.length > 0) updateMinions(dt)
    refreshTint()
    applySquash()
    updateDizzy()
    syncSprite()
  }

  function setAsleep(next: boolean) {
    if (next === asleep || destroyed) return
    asleep = next
    // A dead summoner's minions live on, so they sleep and wake with it.
    for (const minionMob of minions) minionMob.setAsleep(next)
    if (dead) return
    if (next) {
      cancelAttacks()
      hideDizzy()
      st.staggerMs = 0
      dropBubble()
      leaveWorld()
      sprite.setActive(false)
      return
    }
    world.add(body)
    body.moves = true
    // The body missed steps while it slept, so its previous position is stale.
    body.reset(body.x, body.y)
    for (const collider of colliders) collider.active = true
    awake.add(body)
    combat.register(mob)
    sprite.setActive(true)
    applyInspect()
  }

  function destroy(sceneDown = false) {
    if (destroyed) return
    destroyed = true
    scene.events.off('shutdown', onShutdown)
    for (const minionMob of minions) minionMob.destroy()
    minions.length = 0
    combat.unregister(mob)
    awake.delete(body)
    cancelAttacks()
    // Scene shutdown already took the physics world and every game object with it.
    if (sceneDown) return
    if (bubble) releaseBubble(scene, bubble)
    bubble = null
    for (const collider of colliders) collider.destroy()
    body.destroy()
    sprite.destroy()
    ghost?.destroy()
    for (const star of dizzyStars ?? []) star.destroy()
  }
  const onShutdown = () => destroy(true)

  const mob: Mob = {
    id: `${spec.id}#${nextId++}`,
    team: 'enemy',
    killer: { kind: 'mob', annotation: spec.source, label: spec.label },
    spec,
    // The same rectangle every call. Read it, do not keep it.
    hurtbox: () => hurt.setTo(body.x, body.y, W, H),
    facing: () => facing,
    position: () => ({ x: cx(), y: feetY() }),
    isInvulnerable: () => dead,
    isDead: () => dead,
    receiveHit(hit: HitEvent): number | void {
      if (dead) return
      const attacker = hit.attacker.position()
      const damage = incomingDamage(hit.damage, {
        armored: passive === 'armored',
        shieldUp: armed && weapon.kind === 'shield' && phase === 'idle',
        stanceFactor: mods.damageTaken,
        fromFront: hitFromFront(cx(), facing, attacker.x),
        fromAbove: hitFromAbove(attacker.y, body.y),
      })
      st.hp -= damage
      if (st.hp <= 0) {
        die()
        return damage
      }
      const reaction = hitReaction({
        size: spec.size,
        body: spec.body,
        heavy: hit.tags.includes('heavy'),
        armoredFront: passive === 'armored' && hitFromFront(cx(), facing, attacker.x) && !hitFromAbove(attacker.y, body.y),
        defensiveStance: mods.damageTaken < 1,
      })
      st.flashMs = HIT_FLASH_MS
      st.stunMs = Math.max(HIT_STUN_MS, reaction.staggerMs)
      st.squashMs = SQUASH_MS
      st.squashAmount = reaction.staggerMs > 0 ? 1 : 0.5
      st.tiltDir = hit.knockback.x >= 0 ? 1 : -1
      if (reaction.staggerMs > 0) {
        interruptAttack()
        st.staggerMs = Math.max(st.staggerMs, reaction.staggerMs)
        st.attackCdMs = reaction.staggerMs + STAGGER_RECOVER_MS
        dizzy = reaction.staggerMs > DIZZY_MIN_MS
      } else {
        if (charge === 'run' || charge === 'windup') endCharge(300)
        if (swoop === 'dive') swoop = 'rise'
      }
      if (spec.body === 'turret') return damage
      body.velocity.x = hit.knockback.x * 0.5 * reaction.knockbackScale
      if (flies) body.velocity.y = hit.knockback.y * 0.4 * reaction.knockbackScale
      else if (onGround) {
        body.velocity.y = reaction.launch > 0 ? -reaction.launch : -110 * Math.min(1, reaction.knockbackScale)
        if (reaction.launch > 0) {
          launched = true
          st.airborneMs = 0
        }
      }
      return damage
    },
    update,
    setAsleep,
    setInspectable,
    setHighlight,
    setRaised,
    isGone: () => dead && st.deathMs >= DEATH_MS && minions.every((minionMob) => minionMob.isGone()),
    destroy: () => destroy(false),
  }

  registerInspectable(sprite, mob)
  xpByMob.set(mob, minion ? 0 : spec.xp)
  awake.add(body)
  combat.register(mob)
  scene.events.once('shutdown', onShutdown)
  syncSprite()
  return mob
}
