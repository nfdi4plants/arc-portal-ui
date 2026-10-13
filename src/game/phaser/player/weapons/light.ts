import type { AttackContext, AttackMove, WeaponMoveset } from '../../../contracts/player'
import { aimedVelocity } from './helpers'
import type { MeleeHit, Shot, Timing } from './kit'
import { activeMs, fireShot, later, memoMoves, move, muzzle, spawnMelee } from './kit'

// The four light weapons. Each has a light string, plus one heavy move for the case that the
// weapon sits in the heavy slot. The catalog never puts it there, so the fallback stays simple.

const TIER2_HEAVY = 1.25
const LIGHT_TAGS = ['light']
const HEAVY_TAGS = ['heavy']

const heavyTiming = (startupMs: number, activeMs: number, recoveryMs: number, cancelAfterMs: number, lunge = 0): Timing => ({
  startupMs,
  activeMs,
  recoveryMs,
  cancelAfterMs,
  lunge,
  allowedInAir: false,
})

const lightTiming = (startupMs: number, activeMs: number, recoveryMs: number, cancelAfterMs: number, lunge = 0): Timing => ({
  startupMs,
  activeMs,
  recoveryMs,
  cancelAfterMs,
  lunge,
  allowedInAir: true,
})

interface Volley {
  shot: Omit<Shot, 'velocity'>
  speed: number
  count: number
  // Angle between neighbouring shots, in radians.
  fan: number
}

// Fires `count` shots at the aim point, spread evenly around the aim line.
function fireVolley(ctx: AttackContext, volley: Volley): void {
  const from = muzzle(ctx)
  const dir = ctx.player.facing()
  for (let i = 0; i < volley.count; i++) {
    const spread = (i - (volley.count - 1) / 2) * volley.fan
    fireShot(ctx, from, { ...volley.shot, velocity: aimedVelocity(from, ctx.aim, volley.speed, dir, spread) })
  }
}

// Each of the two hits of tier 2 deals this share of the damage.
const DUAL_SHARE = 0.75

// Two hits for tier 2, 40 ms apart, each at 75% damage. One hit at full damage for tier 1.
function swing(ctx: AttackContext, self: AttackMove, hit: MeleeHit, dual: boolean): void {
  const duration = activeMs(ctx, self)
  if (!dual) {
    spawnMelee(ctx, duration, hit)
    return
  }
  const part = { ...hit, damage: hit.damage * DUAL_SHARE }
  spawnMelee(ctx, duration, part)
  later(ctx, 40, () => spawnMelee(ctx, duration, part))
}

// Wand: bolts towards the pointer. Tier 2 fires two bolts per shot.
const WAND_BOLT = (damage: number): Omit<Shot, 'velocity'> => ({
  art: 'bolt',
  damage,
  radius: 5,
  lifetimeMs: 900,
  knockback: { x: 70, y: -20 },
  hitStopMs: 20,
  tags: ['light', 'projectile'],
})

function wandShot(name: string, timing: Timing, damage: number, tier: 1 | 2): AttackMove {
  return move(name, timing, (ctx) =>
    fireVolley(ctx, { shot: WAND_BOLT(damage), speed: 360, count: tier === 2 ? 2 : 1, fan: 0.16 }),
  )
}

export const wandMoveset: WeaponMoveset = {
  id: 'wand',
  moves: memoMoves((slot, tier) => {
    if (slot === 'heavy') {
      const big = { ...WAND_BOLT(30 * (tier === 2 ? TIER2_HEAVY : 1)), radius: 9, pierce: 2, hitStopMs: 60, tags: ['heavy', 'projectile'] }
      return [
        move('Charged bolt', heavyTiming(260, 60, 300, 180), (ctx) => fireVolley(ctx, { shot: big, speed: 300, count: 1, fan: 0 }), { damage: big.damage }),
      ]
    }
    return [
      wandShot('Bolt', lightTiming(70, 40, 150, 70), 9, tier),
      wandShot('Bolt', lightTiming(70, 40, 150, 70), 9, tier),
      wandShot('Bolt volley', lightTiming(90, 40, 230, 130), 14, tier),
    ]
  }),
}

// Pipette pistol: rapid droplets. Tier 2 pierces one target.
const DROPLET = (damage: number, tier: 1 | 2): Omit<Shot, 'velocity'> => ({
  art: 'droplet',
  damage,
  radius: 4,
  lifetimeMs: 700,
  pierce: tier === 2 ? 1 : 0,
  knockback: { x: 40, y: -10 },
  tags: ['light', 'projectile'],
})

function dropletShot(timing: Timing, damage: number, tier: 1 | 2): AttackMove {
  return move('Droplet', timing, (ctx) => fireVolley(ctx, { shot: DROPLET(damage, tier), speed: 440, count: 1, fan: 0 }))
}

export const pipetteMoveset: WeaponMoveset = {
  id: 'pipettePistol',
  moves: memoMoves((slot, tier) => {
    if (slot === 'heavy') {
      const spray = { ...DROPLET(7, tier), tags: ['heavy', 'projectile'] }
      return [
        move('Droplet spray', heavyTiming(200, 100, 300, 180), (ctx) => fireVolley(ctx, { shot: spray, speed: 420, count: 5, fan: 0.2 }), { damage: spray.damage }),
      ]
    }
    return [
      dropletShot(lightTiming(40, 40, 100, 50), 8, tier),
      dropletShot(lightTiming(40, 40, 100, 50), 8, tier),
      dropletShot(lightTiming(40, 40, 100, 50), 8, tier),
      dropletShot(lightTiming(50, 40, 170, 100), 10, tier),
    ]
  }),
}

// Scalpel: a very fast short string of four. Tier 2 (Dual Scalpels) hits twice per move.
const stab = (damage: number, knockback: { x: number; y: number }, hitStopMs: number): MeleeHit => ({
  x: 2,
  y: -30,
  w: 30,
  h: 18,
  damage,
  knockback,
  hitStopMs,
  tags: LIGHT_TAGS,
})

function scalpelMove(name: string, timing: Timing, hit: MeleeHit, tier: 1 | 2, heavy = false): AttackMove {
  const total = tier === 2 ? hit.damage * 2 * DUAL_SHARE : hit.damage
  return move(name, timing, (ctx, self) => swing(ctx, self, hit, tier === 2), heavy ? { damage: total } : undefined)
}

export const scalpelMoveset: WeaponMoveset = {
  id: 'scalpel',
  moves: memoMoves((slot, tier) => {
    if (slot === 'heavy') {
      const cut: MeleeHit = {
        x: 2,
        y: -42,
        w: 48,
        h: 34,
        damage: 30,
        knockback: { x: 260, y: -200 },
        hitStopMs: 70,
        tags: HEAVY_TAGS,
      }
      return [scalpelMove('Deep cut', heavyTiming(240, 90, 320, 200, 100), cut, tier, true)]
    }
    const quick = { x: 70, y: -20 }
    return [
      scalpelMove('Scalpel cut', lightTiming(45, 45, 100, 55, 120), stab(8, quick, 25), tier),
      scalpelMove('Scalpel cut', lightTiming(45, 45, 100, 55, 120), stab(8, quick, 25), tier),
      scalpelMove('Scalpel cut', lightTiming(45, 45, 100, 55, 120), stab(8, quick, 25), tier),
      scalpelMove('Scalpel slash', lightTiming(55, 55, 190, 110, 200), stab(12, { x: 200, y: -120 }, 45), tier),
    ]
  }),
}

// Sequence whip: a long thin hitbox. Tier 2 pulls hit enemies towards the player (negative
// knockback x).
const lash = (damage: number, push: number, hitStopMs: number, tier: 1 | 2): MeleeHit => ({
  x: 4,
  y: -26,
  w: 70,
  h: 10,
  damage,
  knockback: tier === 2 ? { x: -120, y: -30 } : { x: push, y: -40 },
  hitStopMs,
  tags: LIGHT_TAGS,
})

export const whipMoveset: WeaponMoveset = {
  id: 'sequenceWhip',
  moves: memoMoves((slot, tier) => {
    if (slot === 'heavy') {
      const heavyLash: MeleeHit = { ...lash(28, 260, 70, tier), y: -32, w: 92, h: 16, tags: HEAVY_TAGS }
      return [
        move('Heavy lash', heavyTiming(280, 110, 330, 200), (ctx, self) => spawnMelee(ctx, activeMs(ctx, self), heavyLash), { damage: heavyLash.damage }),
      ]
    }
    return [
      move('Whip lash', lightTiming(90, 70, 170, 90, 60), (ctx, self) => spawnMelee(ctx, activeMs(ctx, self), lash(11, 130, 30, tier))),
      move('Whip crack', lightTiming(100, 80, 240, 130, 100), (ctx, self) => spawnMelee(ctx, activeMs(ctx, self), lash(14, 200, 45, tier))),
    ]
  }),
}
