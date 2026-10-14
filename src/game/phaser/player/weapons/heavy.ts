import type { AttackContext, AttackMove, WeaponMoveset } from '../../../contracts/player'
import type { FlameDirection } from './flame'
import { flameVisual } from './flame'
import { aimedVelocity } from './helpers'
import type { MeleeHit, Shot, Timing } from './kit'
import {
  activeMs,
  burst,
  fallMs,
  fireShot,
  groundBelow,
  later,
  linger,
  memoMoves,
  memoTier,
  move,
  overheadBox,
  spawnMelee,
  spawnShockwaves,
  variantTiming,
} from './kit'
import { orbitVisual } from './orbit'
import { UNGROUPED } from './scheduler'
import { NO_UP_HEAVY } from './variants'

// The four heavy weapons. The catalog puts them in the heavy slot only, so each one defines a
// heavy move, an air heavy, a dash heavy and an up heavy and nothing for the light slot.

const HEAVY_TAGS = ['heavy']

const heavyTiming = (startupMs: number, activeMs: number, recoveryMs: number, cancelAfterMs: number, lunge = 0): Timing => ({
  startupMs,
  activeMs,
  recoveryMs,
  cancelAfterMs,
  lunge,
  allowedInAir: false,
})

// Centrifuge disc: flies out 160 units and comes back to the thrower. The return is a second
// projectile that starts where the first one expires and aims at the player's hand. The return is
// ungrouped, so a hit on the mage does not make the disc vanish in flight.
const DISC_SPEED = 320
const DISC_REACH = 160
const DISC_DAMAGE = 20

const disc = (damage: number, lifetimeMs: number, velocity: { x: number; y: number }, tags: string[]): Shot => ({
  art: 'disc',
  velocity,
  damage,
  radius: 7,
  lifetimeMs,
  pierce: 99,
  knockback: { x: 120, y: -80 },
  tags,
})

function throwDisc(ctx: AttackContext, height: number, damage: number): void {
  const feet = ctx.player.position()
  const dir = ctx.player.facing()
  const origin = { x: feet.x + dir * 12, y: feet.y + height }
  const outMs = (DISC_REACH / DISC_SPEED) * 1000
  fireShot(ctx, origin, disc(damage, outMs, { x: dir * DISC_SPEED, y: 0 }, ['heavy', 'projectile']))
  later(
    ctx,
    outMs,
    () => {
      const turn = { x: origin.x + dir * DISC_REACH, y: origin.y }
      const hand = ctx.player.position()
      const target = { x: hand.x, y: hand.y + height }
      const back = aimedVelocity(turn, target, DISC_SPEED * 1.1, dir === 1 ? -1 : 1)
      const flightMs = (Math.hypot(target.x - turn.x, target.y - turn.y) / (DISC_SPEED * 1.1)) * 1000 + 60
      fireShot(ctx, turn, disc(damage * 0.6, flightMs, back, ['heavy', 'projectile']))
    },
    UNGROUPED,
  )
}

// Disc variants. Spin Drop throws the disc straight down, and it splits into two that roll along
// the floor. Orbit keeps a disc circling.
const DROP_SPEED = 520

function spinDrop(tier: 1 | 2): AttackMove {
  const roller = tier === 2 ? { damage: 16, speed: 320, ms: 700 } : { damage: 12, speed: 300, ms: 550 }
  return move(
    'Spin Drop',
    // The lock roots the mage after the throw, which earns the discs their 'heavy' stagger.
    variantTiming(90, 70, 200, 140, { hover: { ms: 160 }, lockMs: 150 }),
    (ctx) => {
      const feet = ctx.player.position()
      const from = { x: feet.x, y: feet.y - 10 }
      const floor = groundBelow(ctx, from.x, from.y, 420)
      const dropMs = floor === null ? 700 : ((floor - from.y) / DROP_SPEED) * 1000
      fireShot(ctx, from, disc(16, dropMs, { x: 0, y: DROP_SPEED }, HEAVY_TAGS))
      if (floor === null) return
      const at = { x: from.x, y: floor - 8 }
      // Ungrouped like the return of the thrown disc: once it flies, a hit on the mage does not stop it.
      later(
        ctx,
        dropMs,
        () => {
          for (const dir of [1, -1]) {
            fireShot(ctx, at, { ...disc(roller.damage, roller.ms, { x: dir * roller.speed, y: 0 }, HEAVY_TAGS), knockback: { x: 160, y: -120 } })
          }
          burst(ctx, at.x, at.y + 6, 'dust', 1.5)
        },
        UNGROUPED,
      )
    },
    { damage: 16 },
  )
}

const ORBIT_MS = 1000
const ORBIT_TICKS = 4

function orbit(tier: 1 | 2): AttackMove {
  const damage = tier === 2 ? 9 : 7
  return move(
    'Orbit',
    variantTiming(60, 80, 200, 120, { keepsMomentum: true }),
    (ctx) => {
      orbitVisual(ctx.scene, ctx.art).show(ctx.player, ORBIT_MS, tier === 2 ? 2 : 1, 34)
      const ring = () =>
        ctx.combat.spawnHitbox({
          owner: ctx.player,
          shape: { kind: 'circle', x: 0, y: -22, r: 38 },
          follow: true,
          activeMs: 120,
          damage,
          knockback: { x: 140, y: -100 },
          hitStopMs: 20,
          maxTargets: Infinity,
          tags: ['heavy', 'orbit'],
        })
      ring()
      // Ungrouped, so the disc keeps circling through a dash or a hit.
      for (let i = 1; i < ORBIT_TICKS; i++) later(ctx, (i * ORBIT_MS) / ORBIT_TICKS, ring, UNGROUPED)
    },
    { damage },
  )
}

export const discMoveset: WeaponMoveset = {
  id: 'centrifugeDisc',
  ...NO_UP_HEAVY,
  airHeavy: memoTier(spinDrop),
  dashHeavy: memoTier(orbit),
  moves: memoMoves((slot, tier) => {
    if (slot === 'light') return []
    // Tier 2 throws a high and a low disc at once.
    const heights = tier === 2 ? [-40, -12] : [-26]
    return [
      move(
        'Disc throw',
        heavyTiming(200, 80, 300, 180),
        (ctx) => {
          for (const height of heights) throwDisc(ctx, height, DISC_DAMAGE)
        },
        { damage: DISC_DAMAGE },
      ),
    ]
  }),
}

// Beaker variants. Big Splash is the hardest landing of all. Pendulum swings up from the dash and
// launches. Uppercut launches straight up.
const SPLASH = { speed: 760 }

function bigSplash(tier: 1 | 2): AttackMove {
  const slam = tier === 2 ? { r: 84, damage: 40 } : { r: 70, damage: 34 }
  const wave = tier === 2
    ? { damage: 13, width: 20, height: 24, speed: 240, distance: 190 }
    : { damage: 9, width: 12, height: 14, speed: 220, distance: 130 }
  return move(
    'Big Splash',
    variantTiming(120, 0, 300, 200, {
      hover: { ms: 120 },
      plunge: SPLASH,
      landingLockMs: 350,
      onLand(ctx) {
        const feet = ctx.player.position()
        const r = slam.r * ctx.rangeScale
        ctx.combat.spawnHitbox({
          owner: ctx.player,
          shape: { kind: 'circle', x: 0, y: -10, r },
          follow: false,
          activeMs: 120,
          damage: slam.damage,
          knockback: { x: 120, y: -360 },
          hitStopMs: 90,
          maxTargets: Infinity,
          tags: ['heavy', 'slam'],
        })
        spawnShockwaves(ctx, wave)
        burst(ctx, feet.x, feet.y - 8, 'crit', r / 22)
        burst(ctx, feet.x, feet.y, 'dust', r / 26)
      },
    }),
    (ctx) => spawnMelee(ctx, fallMs(ctx, SPLASH.speed), { x: -14, y: -12, w: 28, h: 26, damage: 10, knockback: { x: 60, y: 220 }, hitStopMs: 20, tags: HEAVY_TAGS }),
    { damage: slam.damage },
  )
}

function pendulum(tier: 1 | 2): AttackMove {
  const hit: MeleeHit = { x: -6, y: -80, w: 64, h: 80, damage: tier === 2 ? 36 : 30, knockback: { x: 140, y: -520 }, hitStopMs: 90, tags: HEAVY_TAGS }
  return move(
    'Pendulum',
    variantTiming(110, 140, 300, 220, { keepsMomentum: true, lockMs: 300 }),
    (ctx, self) => spawnMelee(ctx, activeMs(ctx, self), hit),
    { damage: hit.damage },
  )
}

function uppercut(tier: 1 | 2): AttackMove {
  const damage = tier === 2 ? 34 : 30
  return move(
    'Uppercut',
    variantTiming(260, 110, 300, 200),
    (ctx, self) => {
      overheadBox(ctx, 90, 50, activeMs(ctx, self), damage, { x: 80, y: -520 }, 90, HEAVY_TAGS)
      const feet = ctx.player.position()
      burst(ctx, feet.x, feet.y - 30 - 90 * ctx.rangeScale, 'hit', 1.5)
    },
    { damage },
  )
}

// Beaker hammer: a slow overhead smash and flat shockwaves running along the ground both ways.
export const beakerMoveset: WeaponMoveset = {
  id: 'beakerHammer',
  airHeavy: memoTier(bigSplash),
  dashHeavy: memoTier(pendulum),
  upHeavy: memoTier(uppercut),
  moves: memoMoves((slot, tier) => {
    if (slot === 'light') return []
    // The beaker head lands about 60 units ahead of the feet at the strike (tier 2).
    const smash: MeleeHit = {
      x: -6,
      y: -62,
      w: 64,
      h: 62,
      damage: tier === 2 ? 30 : 28,
      knockback: { x: 240, y: -280 },
      hitStopMs: 80,
      tags: HEAVY_TAGS,
    }
    const wave = tier === 2
      ? { damage: 13, width: 20, height: 24, speed: 240, distance: 190 }
      : { damage: 9, width: 12, height: 14, speed: 220, distance: 130 }
    return [
      move(
        'Beaker smash',
        heavyTiming(340, 120, 360, 240, 60),
        (ctx, self) => {
          spawnMelee(ctx, activeMs(ctx, self), smash)
          spawnShockwaves(ctx, wave)
        },
        { damage: smash.damage },
      ),
    ]
  }),
}

// Bunsen staff: a flame cone in front of the player, built from short hitboxes that widen and
// reach further. The sprites come from flameVisual and the pulses run on the loadout scheduler.
interface Cone {
  length: number
  pulses: number
  damage: number
  tags: string[]
}

const PULSE_GAP_MS = 100
const PULSE_MS = 110

function flameCone(ctx: AttackContext, cone: Cone): void {
  const speed = ctx.player.getBuild().stats.attackSpeed
  flameVisual(ctx.scene, ctx.art).show(ctx.player, (cone.pulses * PULSE_GAP_MS + 60) / speed, cone.length * ctx.rangeScale)
  for (let i = 0; i < cone.pulses; i++) {
    const growth = cone.pulses > 1 ? i / (cone.pulses - 1) : 1
    const height = 16 + growth * 22
    const pulse: MeleeHit = {
      x: 6,
      y: -24 - height / 2,
      w: cone.length * (0.55 + 0.45 * growth),
      h: height,
      damage: cone.damage,
      knockback: { x: 60, y: -20 },
      hitStopMs: i === cone.pulses - 1 ? 30 : 0,
      tags: cone.tags,
    }
    const fire = () => spawnMelee(ctx, PULSE_MS / speed, pulse)
    if (i === 0) fire()
    else later(ctx, (i * PULSE_GAP_MS) / speed, fire)
  }
}

// A flame column straight up or down from the mage, as pulses like the cone. Its length grows
// with the melee range.
function flameColumn(ctx: AttackContext, direction: Exclude<FlameDirection, 'forward'>, cone: Cone, knockback: { x: number; y: number }): void {
  const speed = ctx.player.getBuild().stats.attackSpeed
  const length = cone.length * ctx.rangeScale
  flameVisual(ctx.scene, ctx.art).show(ctx.player, (cone.pulses * PULSE_GAP_MS + 60) / speed, length, direction)
  for (let i = 0; i < cone.pulses; i++) {
    const fire = () =>
      ctx.combat.spawnHitbox({
        owner: ctx.player,
        shape: direction === 'up' ? { kind: 'rect', x: -14, y: -34 - length, w: 28, h: length } : { kind: 'rect', x: -14, y: -8, w: 28, h: length },
        follow: true,
        activeMs: PULSE_MS / speed,
        damage: cone.damage,
        knockback,
        hitStopMs: i === cone.pulses - 1 ? 30 : 0,
        maxTargets: Infinity,
        tags: cone.tags,
      })
    if (i === 0) fire()
    else later(ctx, (i * PULSE_GAP_MS) / speed, fire)
  }
}

// Bunsen variants. Flame Jet fires down, which slows the fall, and leaves a fire patch where the
// mage lands. Flare Burst rings the mage in fire. Chimney sends a flame column up.
const JET = { speed: 160, maxMs: 450 }
const FLARES = 8

function flameJet(tier: 1 | 2): AttackMove {
  const jet = { length: 60, pulses: 5, damage: tier === 2 ? 6 : 5, tags: HEAVY_TAGS }
  const patch = { width: tier === 2 ? 72 : 52, damage: tier === 2 ? 5 : 4 }
  return move(
    'Flame Jet',
    variantTiming(70, 0, 200, 140, {
      plunge: JET,
      // The fire patch staggers ('heavy'), so the landing roots the mage briefly.
      landingLockMs: 150,
      onLand(ctx) {
        const feet = ctx.player.position()
        const width = patch.width * ctx.rangeScale
        linger(
          ctx,
          { x: feet.x, y: feet.y - 6 },
          {
            art: 'flame',
            shape: { kind: 'rect', x: -width / 2, y: -8, w: width, h: 14 },
            damage: patch.damage,
            knockback: { x: 30, y: -80 },
            lifetimeMs: 190,
            tags: ['heavy', 'fire'],
          },
          5,
          200,
        )
      },
    }),
    (ctx) => flameColumn(ctx, 'down', jet, { x: 40, y: 120 }),
    { damage: jet.pulses * jet.damage },
  )
}

function flareBurst(tier: 1 | 2): AttackMove {
  const r = tier === 2 ? 64 : 52
  const damage = tier === 2 ? 32 : 26
  return move(
    'Flare Burst',
    variantTiming(90, 80, 260, 190, { lockMs: 200 }),
    (ctx) => {
      ctx.combat.spawnHitbox({
        owner: ctx.player,
        shape: { kind: 'circle', x: 0, y: -22, r },
        follow: false,
        activeMs: 100,
        damage,
        knockback: { x: 150, y: -200 },
        hitStopMs: 60,
        maxTargets: Infinity,
        tags: ['heavy', 'fire'],
      })
      // Flames flying outward show the ring. They only show and hit nothing.
      const feet = ctx.player.position()
      const centre = { x: feet.x, y: feet.y - 22 }
      const flightMs = 200
      const speed = (r / flightMs) * 1000
      for (let i = 0; i < FLARES; i++) {
        const angle = (i / FLARES) * Math.PI * 2
        fireShot(ctx, centre, {
          art: 'flame',
          velocity: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
          damage: 0,
          radius: 4,
          lifetimeMs: flightMs,
          knockback: { x: 0, y: 0 },
          tags: ['fire'],
          maxTargets: 0,
        })
      }
    },
    { damage },
  )
}

function chimney(tier: 1 | 2): AttackMove {
  const column = { length: tier === 2 ? 110 : 90, pulses: 4, damage: tier === 2 ? 8 : 7, tags: HEAVY_TAGS }
  return move(
    'Chimney',
    variantTiming(160, 400, 220, 140),
    (ctx) => flameColumn(ctx, 'up', column, { x: 30, y: -260 }),
    { damage: column.pulses * column.damage },
  )
}

export const bunsenMoveset: WeaponMoveset = {
  id: 'bunsenStaff',
  airHeavy: memoTier(flameJet),
  dashHeavy: memoTier(flareBurst),
  upHeavy: memoTier(chimney),
  moves: memoMoves((slot, tier) => {
    if (slot === 'light') return []
    const cone = { length: tier === 2 ? 105 : 70, pulses: 4, damage: tier === 2 ? 8 : 7, tags: HEAVY_TAGS }
    // The extras of the heavy move read the total of the pulses, once per move.
    const declared = { damage: cone.pulses * cone.damage }
    return [move('Flame cone', heavyTiming(180, 400, 240, 140), (ctx) => flameCone(ctx, cone), declared)]
  }),
}

// Petri shield: a block stance followed by a bash. The stance is a 'reflect' hitbox that sends
// enemy projectiles back. It does not stop melee or contact damage, because the player has no
// way to ignore a hit for a set time. Tier 2 holds the stance longer and bashes harder.
function reflectStance(ctx: AttackContext, durationMs: number): void {
  const scale = ctx.rangeScale
  ctx.combat.spawnHitbox({
    owner: ctx.player,
    shape: { kind: 'rect', x: 6 * scale, y: -46, w: 28 * scale, h: 50 },
    follow: true,
    activeMs: durationMs,
    damage: 0,
    knockback: { x: 0, y: 0 },
    hitStopMs: 0,
    maxTargets: 0,
    tags: ['reflect'],
  })
}

// Petri variants. Shield Surf rides the shield down, turning shots back, and bashes on landing.
// Shield Charge holds the shield forward through a long dash.
// Lid Lift raises the shield overhead against shots from above, then bashes up.
const SURF = { speed: 600 }

function shieldSurf(tier: 1 | 2): AttackMove {
  const bash = { damage: tier === 2 ? 40 : 30, w: tier === 2 ? 76 : 60 }
  return move(
    'Shield Surf',
    variantTiming(60, 0, 220, 160, {
      plunge: SURF,
      landingLockMs: 200,
      onLand(ctx) {
        const w = bash.w * ctx.rangeScale
        ctx.combat.spawnHitbox({
          owner: ctx.player,
          shape: { kind: 'rect', x: -w / 2, y: -40, w, h: 40 },
          follow: false,
          activeMs: 100,
          damage: bash.damage,
          knockback: { x: 220, y: -260 },
          hitStopMs: 80,
          maxTargets: Infinity,
          tags: ['heavy', 'bash'],
        })
        const feet = ctx.player.position()
        burst(ctx, feet.x, feet.y - 4, 'dust', w / 40)
      },
    }),
    (ctx) => {
      const duration = fallMs(ctx, SURF.speed)
      ctx.combat.spawnHitbox({
        owner: ctx.player,
        shape: { kind: 'rect', x: -20, y: -48, w: 40, h: 60 },
        follow: true,
        activeMs: duration,
        damage: 0,
        knockback: { x: 0, y: 0 },
        hitStopMs: 0,
        maxTargets: 0,
        tags: ['reflect'],
      })
      spawnMelee(ctx, duration, { x: -16, y: -8, w: 32, h: 20, damage: 10, knockback: { x: 60, y: 200 }, hitStopMs: 20, tags: HEAVY_TAGS })
    },
    { damage: bash.damage },
  )
}

function shieldCharge(tier: 1 | 2): AttackMove {
  const hit: MeleeHit = { x: 0, y: -46, w: 34, h: 48, damage: tier === 2 ? 34 : 26, knockback: { x: 360, y: -140 }, hitStopMs: 60, tags: ['heavy', 'bash'] }
  return move(
    'Shield Charge',
    variantTiming(50, 260, 240, 190, { keepsMomentum: true, lockMs: 150 }),
    (ctx, self) => {
      const duration = activeMs(ctx, self)
      reflectStance(ctx, duration)
      spawnMelee(ctx, duration, hit)
    },
    { damage: hit.damage },
  )
}

const LID_MS = 300

function lidLift(tier: 1 | 2): AttackMove {
  const damage = tier === 2 ? 32 : 24
  return move(
    'Lid Lift',
    variantTiming(70, LID_MS + 60, 240, 180),
    (ctx) => {
      const speed = ctx.player.getBuild().stats.attackSpeed
      const scale = ctx.rangeScale
      ctx.combat.spawnHitbox({
        owner: ctx.player,
        shape: { kind: 'rect', x: -26 * scale, y: -84, w: 52 * scale, h: 40 },
        follow: true,
        activeMs: LID_MS / speed,
        damage: 0,
        knockback: { x: 0, y: 0 },
        hitStopMs: 0,
        maxTargets: 0,
        tags: ['reflect'],
      })
      later(ctx, LID_MS / speed, () => {
        if (!ctx.player.isDead()) overheadBox(ctx, 50, 48 * scale, 80 / speed, damage, { x: 40, y: -420 }, 70, ['heavy', 'bash'])
      })
    },
    { damage, delayMs: LID_MS },
  )
}

export const petriMoveset: WeaponMoveset = {
  id: 'petriShield',
  airHeavy: memoTier(shieldSurf),
  dashHeavy: memoTier(shieldCharge),
  upHeavy: memoTier(lidLift),
  moves: memoMoves((slot, tier) => {
    if (slot === 'light') return []
    const stanceMs = tier === 2 ? 700 : 500
    const bash: MeleeHit = {
      x: 0,
      y: -48,
      w: tier === 2 ? 60 : 46,
      h: 52,
      damage: tier === 2 ? 40 : 28,
      knockback: { x: 320, y: -200 },
      hitStopMs: 80,
      tags: ['heavy', 'bash'],
    }
    const timing = heavyTiming(70, stanceMs + 80, 260, 200)
    // The bash is the main damage, so the extras of the heavy move wait for it as well.
    const stance: AttackMove = move(
      'Shield stance',
      timing,
      (ctx) => {
        const speed = ctx.player.getBuild().stats.attackSpeed
        reflectStance(ctx, stanceMs / speed)
        later(ctx, stanceMs / speed, () => {
          if (!ctx.player.isDead()) spawnMelee(ctx, 80 / speed, bash)
        })
      },
      { damage: bash.damage, delayMs: stanceMs },
    )
    return [stance]
  }),
}
