import type { AttackContext, AttackMove, WeaponMoveset } from '../../../contracts/player'
import { flameVisual } from './flame'
import { aimedVelocity } from './helpers'
import type { MeleeHit, Shot, Timing } from './kit'
import { activeMs, fireShot, later, memoMoves, move, spawnMelee, spawnShockwaves } from './kit'
import { UNGROUPED } from './scheduler'

// The four heavy weapons. Each has one heavy move, plus a quick light move for the case that the
// weapon sits in the light slot. The catalog never puts it there, so the fallback stays simple.

const TIER2_LIGHT = 1.25
const HEAVY_TAGS = ['heavy']
const LIGHT_TAGS = ['light']

const heavyTiming = (startupMs: number, activeMs: number, recoveryMs: number, cancelAfterMs: number, lunge = 0): Timing => ({
  startupMs,
  activeMs,
  recoveryMs,
  cancelAfterMs,
  lunge,
  allowedInAir: false,
})

const lightTiming = (startupMs: number, activeMs: number, recoveryMs: number, cancelAfterMs: number): Timing => ({
  startupMs,
  activeMs,
  recoveryMs,
  cancelAfterMs,
  allowedInAir: true,
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

function throwDisc(ctx: AttackContext, height: number, damage: number, returns: boolean): void {
  const feet = ctx.player.position()
  const dir = ctx.player.facing()
  const origin = { x: feet.x + dir * 12, y: feet.y + height }
  const reach = returns ? DISC_REACH : 100
  const outMs = (reach / DISC_SPEED) * 1000
  fireShot(ctx, origin, disc(damage, outMs, { x: dir * DISC_SPEED, y: 0 }, returns ? ['heavy', 'projectile'] : LIGHT_TAGS))
  if (!returns) return
  later(
    ctx,
    outMs,
    () => {
      const turn = { x: origin.x + dir * reach, y: origin.y }
      const hand = ctx.player.position()
      const target = { x: hand.x, y: hand.y + height }
      const back = aimedVelocity(turn, target, DISC_SPEED * 1.1, dir === 1 ? -1 : 1)
      const flightMs = (Math.hypot(target.x - turn.x, target.y - turn.y) / (DISC_SPEED * 1.1)) * 1000 + 60
      fireShot(ctx, turn, disc(damage * 0.6, flightMs, back, ['heavy', 'projectile']))
    },
    UNGROUPED,
  )
}

export const discMoveset: WeaponMoveset = {
  id: 'centrifugeDisc',
  moves: memoMoves((slot, tier) => {
    if (slot === 'light') {
      const damage = 11 * (tier === 2 ? TIER2_LIGHT : 1)
      return [move('Disc flick', lightTiming(90, 40, 170, 100), (ctx) => throwDisc(ctx, -26, damage, false))]
    }
    // Tier 2 throws a high and a low disc at once.
    const heights = tier === 2 ? [-40, -12] : [-26]
    return [
      move(
        'Disc throw',
        heavyTiming(200, 80, 300, 180),
        (ctx) => {
          for (const height of heights) throwDisc(ctx, height, DISC_DAMAGE, true)
        },
        { damage: DISC_DAMAGE },
      ),
    ]
  }),
}

// Beaker hammer: a slow overhead smash and flat shockwaves running along the ground both ways.
export const beakerMoveset: WeaponMoveset = {
  id: 'beakerHammer',
  moves: memoMoves((slot, tier) => {
    if (slot === 'light') {
      const tap: MeleeHit = {
        x: 2,
        y: -40,
        w: 40,
        h: 30,
        damage: 13 * (tier === 2 ? TIER2_LIGHT : 1),
        knockback: { x: 160, y: -80 },
        hitStopMs: 40,
        tags: LIGHT_TAGS,
      }
      return [move('Beaker tap', lightTiming(100, 70, 180, 100), (ctx, self) => spawnMelee(ctx, activeMs(ctx, self), tap))]
    }
    const smash: MeleeHit = {
      x: -6,
      y: -62,
      w: 60,
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

export const bunsenMoveset: WeaponMoveset = {
  id: 'bunsenStaff',
  moves: memoMoves((slot, tier) => {
    if (slot === 'light') {
      const puff = { length: 55, pulses: 1, damage: 9 * (tier === 2 ? TIER2_LIGHT : 1), tags: LIGHT_TAGS }
      return [move('Flame puff', lightTiming(90, 70, 180, 100), (ctx) => flameCone(ctx, puff))]
    }
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

export const petriMoveset: WeaponMoveset = {
  id: 'petriShield',
  moves: memoMoves((slot, tier) => {
    if (slot === 'light') {
      const bash: MeleeHit = {
        x: 4,
        y: -42,
        w: 34,
        h: 38,
        damage: 12 * (tier === 2 ? TIER2_LIGHT : 1),
        knockback: { x: 240, y: -80 },
        hitStopMs: 40,
        tags: LIGHT_TAGS,
      }
      return [move('Shield bash', lightTiming(110, 70, 200, 110), (ctx, self) => spawnMelee(ctx, activeMs(ctx, self), bash))]
    }
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
