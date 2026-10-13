import type Phaser from 'phaser'
import type { ProjectileArt, ScribbleArt } from '../../contracts/art'
import type { Combatant, CombatWorld, HitShape } from '../../contracts/combat'
import type { BossArchetype, BossAttackKind, BossAttackSpec } from '../../contracts/content'
import type { PlayerHandle } from '../../contracts/player'
import type { Rng } from '../../contracts/rng'
import type { Adds } from './adds'
import type { Arena } from './index'
import type { TelegraphPool, Zone, ZoneSpec } from './telegraph'
import { clamp, flightMs, insideAny, knockback, openIntervals, safeIntervals, toOwnerShape } from './zones'
import type { Facing, Interval } from './zones'

// The eight attack kinds. Each one is written once. It takes its damage and timing from the spec,
// its reach from the arena and its look from the boss archetype. The boss runs every attack through
// the same cycle: begin (the wind-up starts and the target is locked), windup (every step until the
// telegraph is full), fire (the hitboxes appear) and active (every step while the attack lasts).

export interface BossBody {
  // Centre. The floor is arena.floorY.
  x: number
  // Height of the feet above the floor.
  lift: number
  facing: Facing
  alpha: number
  // Extra tilt in radians, for leaning into an attack.
  lean: number
  // Hurtbox size and sprite height, world units.
  hurtW: number
  hurtH: number
  height: number
}

export interface Cancelable {
  cancel(): void
}

export type AttackPhase = 'none' | 'windup' | 'active' | 'recovery'

interface Wave {
  at: number
  x: number
  dir: Facing
  lifeMs: number
  fired: boolean
}

// The running attack. One object per boss, reset for each attack, so a step allocates nothing.
export interface AttackRun {
  spec: BossAttackSpec
  phase: AttackPhase
  elapsedMs: number
  windupMs: number
  // Set by fire(): how long the attack lasts.
  activeMs: number
  zones: Zone[]
  boxes: Cancelable[]
  shots: Cancelable[]
  safe: Interval[]
  waves: Wave[]
  dir: Facing
  variant: number
  startX: number
  targetX: number
  angle: number
  length: number
  top: number
  bottom: number
  timerMs: number
  intervalMs: number
  count: number
  speed: number
}

export function createRun(): AttackRun {
  return {
    spec: { id: '', name: '', kind: 'slam', heavy: false, telegraphMs: 0, damage: 0, cooldownMs: 0 },
    phase: 'none',
    elapsedMs: 0,
    windupMs: 0,
    activeMs: 0,
    zones: [],
    boxes: [],
    shots: [],
    safe: [],
    waves: [],
    dir: 1,
    variant: 0,
    startX: 0,
    targetX: 0,
    angle: 0,
    length: 0,
    top: 0,
    bottom: 0,
    timerMs: 0,
    intervalMs: 0,
    count: 0,
    speed: 0,
  }
}

export function resetRun(run: AttackRun, spec: BossAttackSpec, windupMs: number): void {
  run.spec = spec
  run.phase = 'windup'
  run.elapsedMs = 0
  run.windupMs = windupMs
  run.activeMs = 0
  run.zones.length = 0
  run.boxes.length = 0
  run.shots.length = 0
  run.safe = []
  run.waves = []
  run.variant = 0
  run.timerMs = 0
}

export interface AttackEnv {
  scene: Phaser.Scene
  combat: CombatWorld
  art: ScribbleArt
  player: PlayerHandle
  rng: Rng
  arena: Arena
  telegraphs: TelegraphPool
  body: BossBody
  self: Combatant
  adds: Adds
  // Changes with the phase of the final boss.
  archetype: BossArchetype
  safeZones: number
  // Height the boss floats at when idle (the glitch daemon), otherwise 0.
  hover: number
  minX: number
  maxX: number
  // Texture key for a projectile of this art kind.
  shotKey(kind: ProjectileArt): string
}

interface AttackKind {
  begin(run: AttackRun, env: AttackEnv): void
  windup?(run: AttackRun, env: AttackEnv, progress: number): void
  fire(run: AttackRun, env: AttackEnv): void
  active?(run: AttackRun, env: AttackEnv, dtMs: number): void
}

const SAFE_WIDTH = 64
const SAFE_MARGIN = 8
// Where rain starts above the floor.
const SKY = 300

const SHOT_ART: Record<BossArchetype, ProjectileArt> = {
  rootTreant: 'arrow',
  specimenJar: 'droplet',
  reagentGolem: 'flame',
  glitchDaemon: 'bolt',
}

// Scratch points, read right after the call that filled them.
const aimPoint = { x: 0, y: 0 }
const muzzlePoint = { x: 0, y: 0 }

function playerCentre(env: AttackEnv): { x: number; y: number } {
  const box = env.player.hurtbox()
  aimPoint.x = box.centerX
  aimPoint.y = box.centerY
  return aimPoint
}

// Turns the boss toward x and returns the side it now faces.
function faceToward(env: AttackEnv, x: number): Facing {
  env.body.facing = x >= env.body.x ? 1 : -1
  return env.body.facing
}

function show(run: AttackRun, env: AttackEnv, spec: ZoneSpec): void {
  // Light attacks only warn with the body flash. Safe spots show for every area attack.
  if (!run.spec.heavy && !spec.safe) return
  run.zones.push(env.telegraphs.show(spec))
}

function showSafe(run: AttackRun, env: AttackEnv, y: number, h: number): void {
  for (const spot of run.safe) {
    show(run, env, { shape: 'rect', x: (spot.from + spot.to) / 2, y, w: spot.to - spot.from, h, fill: 'radial', safe: true })
  }
}

function hit(run: AttackRun, env: AttackEnv, shape: HitShape, activeMs: number, knock: { x: number; y: number }, follow = false): void {
  const heavy = run.spec.heavy
  run.boxes.push(
    env.combat.spawnHitbox({
      owner: env.self,
      shape: follow ? shape : toOwnerShape(shape, env.self.position(), env.self.facing()),
      follow,
      activeMs,
      damage: run.spec.damage,
      knockback: knock,
      hitStopMs: heavy ? 70 : 35,
      maxTargets: Infinity,
      tags: [heavy ? 'heavy' : 'light'],
    }),
  )
}

interface Shot {
  x: number
  y: number
  vx: number
  vy: number
  gravity: number
  lifetimeMs: number
  radius: number
  knock: { x: number; y: number }
  reflectable: boolean
  rect?: { w: number; h: number }
}

function shoot(run: AttackRun, env: AttackEnv, kind: ProjectileArt, shot: Shot): void {
  const heavy = run.spec.heavy
  run.shots.push(
    env.combat.spawnProjectile(
      {
        owner: env.self,
        shape: shot.rect
          ? { kind: 'rect', x: -shot.rect.w / 2, y: -shot.rect.h / 2, w: shot.rect.w, h: shot.rect.h }
          : { kind: 'circle', x: 0, y: 0, r: shot.radius },
        damage: run.spec.damage,
        knockback: shot.knock,
        hitStopMs: heavy ? 50 : 30,
        maxTargets: Infinity,
        tags: ['projectile', heavy ? 'heavy' : 'light'],
        textureKey: env.shotKey(kind),
        velocity: { x: shot.vx, y: shot.vy },
        gravity: shot.gravity,
        lifetimeMs: shot.lifetimeMs,
        pierce: 0,
        reflectable: shot.reflectable,
      },
      { x: shot.x, y: shot.y },
    ),
  )
}

// Slam: the boss comes down on the player's position. A treant smashes with a root arm, the others
// leap there (the daemon blinks over). A heavy slam of a boss with safe zones sometimes shakes the
// whole arena instead and leaves the safe spots untouched.
const LEAP_MS = 450
const LEAP_RADIUS = 48
const SMASH = { w: 52, h: 84 }
const QUAKE_HEIGHT = 44

const slam: AttackKind = {
  begin(run, env) {
    const { arena, body } = env
    const quake = run.spec.heavy && env.safeZones > 0 && env.rng.chance(0.5)
    const playerX = env.player.position().x
    run.variant = quake ? 2 : env.archetype === 'rootTreant' ? 1 : 0
    run.startX = body.x
    run.targetX = quake ? body.x : clamp(playerX, env.minX, env.maxX)
    run.dir = faceToward(env, quake ? playerX : run.targetX)
    const floor = arena.floorY
    if (run.variant === 0) {
      show(run, env, { shape: 'circle', x: run.targetX, y: floor - 6, w: LEAP_RADIUS * 2, h: LEAP_RADIUS * 2, fill: 'radial' })
    } else if (run.variant === 1) {
      show(run, env, { shape: 'rect', x: run.targetX, y: floor, w: SMASH.w, h: SMASH.h, fill: 'up' })
    } else {
      run.safe = safeIntervals(env.rng, arena.left, arena.right, env.safeZones, SAFE_WIDTH)
      show(run, env, { shape: 'rect', x: (arena.left + arena.right) / 2, y: floor - QUAKE_HEIGHT / 2, w: arena.right - arena.left, h: QUAKE_HEIGHT, fill: 'wide' })
      showSafe(run, env, floor - QUAKE_HEIGHT / 2, QUAKE_HEIGHT + 6)
    }
  },
  windup(run, env, progress) {
    const { body } = env
    if (run.variant === 1) {
      body.lean = run.dir * 0.22 * progress
      return
    }
    // The boss crouches first and spends the last LEAP_MS in the air, so it lands as the zone fills.
    const leapMs = Math.min(run.windupMs, LEAP_MS)
    const u = clamp((run.elapsedMs - (run.windupMs - leapMs)) / leapMs, 0, 1)
    const daemon = env.archetype === 'glitchDaemon'
    const peak = run.variant === 2 ? 56 : daemon ? 28 : env.archetype === 'reagentGolem' ? 56 : 84
    body.lift = env.hover + 4 * u * (1 - u) * peak
    if (run.variant === 2) return
    if (daemon) {
      body.x = u < 0.5 ? run.startX : run.targetX
      body.alpha = u > 0.3 && u < 0.7 ? 0.25 : 1
    } else {
      body.x = run.startX + (run.targetX - run.startX) * u
    }
  },
  fire(run, env) {
    const { arena, body } = env
    body.lean = 0
    body.alpha = 1
    body.lift = env.hover
    if (run.variant !== 2) body.x = run.targetX
    const floor = arena.floorY
    const away: Facing = env.player.position().x >= run.targetX ? 1 : -1
    const knock = knockback(away, env.self.facing(), 190, 210)
    if (run.variant === 0) {
      hit(run, env, { kind: 'circle', x: run.targetX, y: floor - 6, r: LEAP_RADIUS }, 180, knock)
    } else if (run.variant === 1) {
      hit(run, env, { kind: 'rect', x: run.targetX - SMASH.w / 2, y: floor - SMASH.h, w: SMASH.w, h: SMASH.h }, 200, knock)
    } else {
      for (const part of openIntervals(arena.left, arena.right, run.safe)) {
        hit(run, env, { kind: 'rect', x: part.from, y: floor - QUAKE_HEIGHT, w: part.to - part.from, h: QUAKE_HEIGHT }, 200, knock)
      }
    }
    run.activeMs = 240
  },
}

// Sweep: a horizontal zone in front of the boss, either on the ground (jump it) or at head height
// (dash through it or jump high).
const sweep: AttackKind = {
  begin(run, env) {
    const floor = env.arena.floorY
    run.dir = faceToward(env, env.player.position().x)
    run.variant = env.rng.chance(0.5) ? 0 : 1
    run.targetX = env.body.x + run.dir * (env.body.hurtW / 2)
    run.length = run.spec.heavy ? 150 : 115
    run.top = floor - (run.variant === 0 ? 24 : 64)
    run.bottom = floor - (run.variant === 0 ? 0 : 36)
    show(run, env, {
      shape: 'rect',
      x: run.targetX,
      y: (run.top + run.bottom) / 2,
      w: run.length,
      h: run.bottom - run.top,
      fill: run.dir === 1 ? 'right' : 'left',
    })
  },
  windup(run, env, progress) {
    env.body.lean = -run.dir * 0.18 * progress
  },
  fire(run, env) {
    const x = run.dir === 1 ? run.targetX : run.targetX - run.length
    hit(run, env, { kind: 'rect', x, y: run.top, w: run.length, h: run.bottom - run.top }, 170, knockback(run.dir, env.self.facing(), 200, 150))
    run.activeMs = 220
  },
  active(run, env) {
    env.body.lean = run.dir * 0.3 * Math.max(0, 1 - run.elapsedMs / run.activeMs)
  },
}

// Projectile fan: 5, 7 or 9 shots spread around the line to the player.
const FAN_GAP = 0.17
const FAN_SPEED = 190

function muzzle(env: AttackEnv): { x: number; y: number } {
  const { body, arena } = env
  muzzlePoint.x = body.x + body.facing * body.hurtW * 0.3
  muzzlePoint.y = arena.floorY - body.lift - body.height * 0.55
  return muzzlePoint
}

const projectileFan: AttackKind = {
  begin(run, env) {
    run.dir = faceToward(env, env.player.position().x)
    const from = muzzle(env)
    const aim = playerCentre(env)
    run.angle = Math.atan2(aim.y - from.y, aim.x - from.x)
    show(run, env, { shape: 'cone', x: from.x, y: from.y, w: 220, h: 130, rotation: run.angle, fill: 'right' })
  },
  fire(run, env) {
    const from = muzzle(env)
    const aim = playerCentre(env)
    const angle = Math.atan2(aim.y - from.y, aim.x - from.x)
    const count = 5 + 2 * env.rng.int(0, 2)
    const kind = SHOT_ART[env.archetype]
    for (let i = 0; i < count; i++) {
      const a = angle + (i - (count - 1) / 2) * FAN_GAP
      const vx = Math.cos(a) * FAN_SPEED
      const vy = Math.sin(a) * FAN_SPEED
      shoot(run, env, kind, {
        x: from.x,
        y: from.y,
        vx,
        vy,
        gravity: 0,
        lifetimeMs: flightMs(env.arena, env.arena.floorY - SKY, from, vx, vy, 3000),
        radius: 6,
        knock: { x: 110, y: -90 },
        reflectable: true,
      })
    }
    run.activeMs = 200
  },
}

// Charge: the boss dashes along the lane it showed, toward the player's side of the arena. Only its
// lower body hurts, so a well-timed jump or dash clears it.
const CHARGE_HEIGHT = 56

const charge: AttackKind = {
  begin(run, env) {
    const { arena, body } = env
    run.dir = faceToward(env, env.player.position().x)
    const edge = body.x + run.dir * (body.hurtW / 2)
    const toWall = run.dir === 1 ? arena.right - edge : edge - arena.left
    run.length = Math.max(40, run.spec.heavy ? toWall : Math.min(280, toWall))
    run.startX = body.x
    run.targetX = clamp(body.x + run.dir * run.length, env.minX, env.maxX)
    show(run, env, {
      shape: 'rect',
      x: edge,
      y: arena.floorY - CHARGE_HEIGHT / 2,
      w: run.length,
      h: CHARGE_HEIGHT,
      fill: run.dir === 1 ? 'right' : 'left',
    })
  },
  windup(run, env, progress) {
    env.body.lean = -run.dir * 0.2 * progress
  },
  fire(run, env) {
    const { body } = env
    body.lean = run.dir * 0.12
    run.speed = run.spec.heavy ? 560 : 660
    const travelMs = (Math.abs(run.targetX - body.x) / run.speed) * 1000
    hit(
      run,
      env,
      { kind: 'rect', x: -body.hurtW / 2 - 4, y: -CHARGE_HEIGHT, w: body.hurtW + 8, h: CHARGE_HEIGHT },
      travelMs + 40,
      knockback(run.dir, env.self.facing(), 240, 170),
      true,
    )
    run.activeMs = travelMs + 160
  },
  active(run, env, dtMs) {
    const { body } = env
    if ((run.targetX - body.x) * run.dir <= 0) return
    body.x += run.dir * run.speed * (dtMs / 1000)
    if ((run.targetX - body.x) * run.dir <= 0) body.x = run.targetX
  },
}

// Rain: drops fall across the whole arena, except over the safe spots. Some of them aim at where
// the player stands.
const RAIN_RADIUS = 7
const RAIN_BAND = 48

function dropRain(run: AttackRun, env: AttackEnv): void {
  const { arena, rng } = env
  const aimed = rng.chance(0.45)
  let x = aimed ? env.player.position().x + (rng.next() - 0.5) * 48 : arena.left + rng.next() * (arena.right - arena.left)
  for (let tries = 0; insideAny(x, run.safe, SAFE_MARGIN) || x < arena.left || x > arena.right; tries++) {
    if (tries >= 4) return
    x = arena.left + rng.next() * (arena.right - arena.left)
  }
  shoot(run, env, SHOT_ART[env.archetype], {
    x,
    y: arena.floorY - SKY,
    vx: 0,
    vy: 60,
    gravity: 760,
    lifetimeMs: 800,
    radius: RAIN_RADIUS,
    knock: { x: 40, y: -140 },
    reflectable: false,
  })
}

const rain: AttackKind = {
  begin(run, env) {
    const { arena } = env
    run.dir = faceToward(env, env.player.position().x)
    run.safe = safeIntervals(env.rng, arena.left, arena.right, env.safeZones, SAFE_WIDTH)
    show(run, env, { shape: 'rect', x: (arena.left + arena.right) / 2, y: arena.floorY - RAIN_BAND / 2, w: arena.right - arena.left, h: RAIN_BAND, fill: 'wide' })
    showSafe(run, env, arena.floorY - RAIN_BAND / 2, RAIN_BAND + 6)
  },
  fire(run) {
    run.count = run.spec.heavy ? 18 : 10
    run.intervalMs = run.spec.heavy ? 70 : 100
    run.timerMs = 0
    run.activeMs = run.count * run.intervalMs + 200
  },
  active(run, env, dtMs) {
    run.timerMs -= dtMs
    while (run.timerMs <= 0 && run.count > 0) {
      dropRain(run, env)
      run.count--
      run.timerMs += run.intervalMs
    }
  },
}

// Beam: a line from the boss, level with the ground or aimed at the player. The combat world only
// has axis-aligned rectangles and circles, so a diagonal beam is a chain of circles.
const BEAM_LENGTH = 420
const BEAM_THICKNESS = 16
const BEAM_STEP = 18

const beam: AttackKind = {
  begin(run, env) {
    const { arena, body } = env
    run.dir = faceToward(env, env.player.position().x)
    run.variant = env.rng.chance(0.5) ? 0 : 1
    const ox = body.x + run.dir * body.hurtW * 0.4
    let oy = arena.floorY - 30
    if (run.variant === 0) {
      run.angle = run.dir === 1 ? 0 : Math.PI
    } else {
      oy = arena.floorY - body.lift - body.height * 0.5
      const aim = playerCentre(env)
      run.angle = Math.atan2(aim.y - oy, aim.x - ox)
    }
    const cos = Math.cos(run.angle)
    const sin = Math.sin(run.angle)
    let length = BEAM_LENGTH
    if (cos > 0.01) length = Math.min(length, (arena.right - ox) / cos)
    else if (cos < -0.01) length = Math.min(length, (ox - arena.left) / -cos)
    if (sin > 0.01) length = Math.min(length, (arena.floorY - 4 - oy) / sin)
    run.length = Math.max(60, length)
    run.startX = ox
    run.top = oy
    show(run, env, { shape: 'line', x: ox, y: oy, w: run.length, h: BEAM_THICKNESS, rotation: run.angle, fill: 'right' })
  },
  windup(run, env, progress) {
    env.body.lean = -run.dir * 0.12 * progress
  },
  fire(run, env) {
    env.body.lean = 0
    const cos = Math.cos(run.angle)
    const sin = Math.sin(run.angle)
    const knock = knockback(cos >= 0 ? 1 : -1, env.self.facing(), 150, 130)
    if (run.variant === 0) {
      const x = run.dir === 1 ? run.startX : run.startX - run.length
      hit(run, env, { kind: 'rect', x, y: run.top - BEAM_THICKNESS / 2, w: run.length, h: BEAM_THICKNESS }, 420, knock)
    } else {
      for (let d = 12; d <= run.length; d += BEAM_STEP) {
        hit(run, env, { kind: 'circle', x: run.startX + cos * d, y: run.top + sin * d, r: 11 }, 420, knock)
      }
    }
    run.activeMs = 460
  },
}

// Summon: two small adds run in from both sides of the boss.
const summon: AttackKind = {
  begin(run, env) {
    run.dir = faceToward(env, env.player.position().x)
  },
  fire(run, env) {
    const { body } = env
    for (const side of [-1, 1]) env.adds.spawn(body.x + side * (body.hurtW / 2 + 30), run.spec.damage)
    run.activeMs = 150
  },
}

// Shockwave: a low wave runs along the floor to both walls. It is low enough to jump. Where a safe
// spot lies, the wave is cut in pieces so the spot stays empty.
const WAVE_SPEED = 250
const WAVE_BAND = 18

const shockwave: AttackKind = {
  begin(run, env) {
    const { arena, body } = env
    run.dir = faceToward(env, env.player.position().x)
    run.safe = safeIntervals(env.rng, arena.left, arena.right, env.safeZones, SAFE_WIDTH)
    const y = arena.floorY - WAVE_BAND / 2
    const left = body.x - body.hurtW / 2
    const right = body.x + body.hurtW / 2
    if (left - arena.left > 10) show(run, env, { shape: 'rect', x: left, y, w: left - arena.left, h: WAVE_BAND, fill: 'left' })
    if (arena.right - right > 10) show(run, env, { shape: 'rect', x: right, y, w: arena.right - right, h: WAVE_BAND, fill: 'right' })
    showSafe(run, env, y, WAVE_BAND + 8)
  },
  fire(run, env) {
    const { arena, body } = env
    let end = 0
    for (const dir of [-1, 1] as const) {
      const edge = body.x + dir * (body.hurtW / 2)
      const far = dir === 1 ? arena.right : arena.left
      for (const part of openIntervals(Math.min(edge, far), Math.max(edge, far), run.safe)) {
        const start = dir === 1 ? part.from : part.to
        const stop = dir === 1 ? part.to : part.from
        const at = (Math.abs(start - edge) / WAVE_SPEED) * 1000
        const lifeMs = (Math.abs(stop - start) / WAVE_SPEED) * 1000
        run.waves.push({ at, x: start, dir, lifeMs, fired: false })
        end = Math.max(end, at + lifeMs)
      }
    }
    run.timerMs = 0
    run.activeMs = end + 100
  },
  active(run, env, dtMs) {
    run.timerMs += dtMs
    for (const wave of run.waves) {
      if (wave.fired || run.timerMs < wave.at) continue
      wave.fired = true
      shoot(run, env, 'orb', {
        x: wave.x,
        y: env.arena.floorY - WAVE_BAND / 2,
        vx: wave.dir * WAVE_SPEED,
        vy: 0,
        gravity: 0,
        lifetimeMs: wave.lifeMs,
        radius: 0,
        rect: { w: 14, h: WAVE_BAND },
        knock: { x: 90, y: -230 },
        reflectable: false,
      })
    }
  },
}

export const ATTACK_KINDS: Record<BossAttackKind, AttackKind> = {
  slam,
  sweep,
  projectileFan,
  charge,
  rain,
  beam,
  summon,
  shockwave,
}
