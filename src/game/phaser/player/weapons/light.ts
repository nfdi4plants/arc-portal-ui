import type { AttackContext, AttackMove, WeaponMoveset } from '../../../contracts/player'
import { aimedVelocity } from './helpers'
import type { MeleeHit, Shot, Timing } from './kit'
import { activeMs, dashLightTiming, fireShot, later, memoMoves, memoTier, move, muzzle, overheadBox, spawnMelee, streak, variantTiming } from './kit'
import { NO_UP_LIGHT } from './variants'

// The four light weapons. The catalog puts them in the light slot only, so each one defines a
// light string, a dash light and an up light and nothing for the heavy slot.

const LIGHT_TAGS = ['light']

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

// A one-hit melee box that lasts the active phase. Dual Scalpels add a second hit 40 ms later.
const strike = (hit: MeleeHit, dual = false) => (ctx: AttackContext, self: AttackMove) => swing(ctx, self, hit, dual)


// Wand variant. Slipshot fires along the dash.
function slipshot(tier: 1 | 2): AttackMove {
  const bolt = WAND_BOLT(10)
  return move('Slipshot', dashLightTiming(30, 40, 120), (ctx) => {
    const dir = ctx.player.facing()
    const from = muzzle(ctx)
    // Faster than the dash, so the mage does not run into its own bolt.
    if (tier === 1) fireShot(ctx, from, { ...bolt, velocity: { x: dir * 760, y: 0 } })
    else for (const spread of [-0.08, 0.08]) fireShot(ctx, from, { ...bolt, velocity: { x: dir * Math.cos(spread) * 760, y: Math.sin(spread) * 760 } })
  })
}

export const wandMoveset: WeaponMoveset = {
  id: 'wand',
  ...NO_UP_LIGHT,
  dashLight: memoTier(slipshot),
  moves: memoMoves((slot, tier) => {
    if (slot === 'heavy') return []
    return [
      wandShot('Bolt', lightTiming(120, 40, 240, 220), 13, tier),
      wandShot('Bolt', lightTiming(120, 40, 240, 220), 13, tier),
      wandShot('Bolt volley', lightTiming(140, 40, 320, 280), 20, tier),
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

// Pipette variant. Spray covers the retreat with droplets behind the dash.
function spray(tier: 1 | 2): AttackMove {
  return move('Spray', dashLightTiming(30, 60, 110), (ctx) => {
    const from = muzzle(ctx)
    const back = -ctx.player.facing()
    for (const spread of [-0.25, 0, 0.25]) {
      fireShot(ctx, from, { ...DROPLET(5, tier), lifetimeMs: 260, velocity: { x: back * Math.cos(spread) * 320, y: Math.sin(spread) * 320 } })
    }
  })
}

export const pipetteMoveset: WeaponMoveset = {
  id: 'pipettePistol',
  ...NO_UP_LIGHT,
  dashLight: memoTier(spray),
  moves: memoMoves((slot, tier) => {
    if (slot === 'heavy') return []
    return [
      dropletShot(lightTiming(100, 40, 220, 190), 14, tier),
      dropletShot(lightTiming(100, 40, 220, 190), 14, tier),
      dropletShot(lightTiming(100, 40, 220, 190), 14, tier),
      dropletShot(lightTiming(120, 40, 280, 230), 17, tier),
    ]
  }),
}

// Scalpel: a very fast short string of four. Tier 2 (Dual Scalpels) hits twice per move.
// The scalpel is drawn 34 to 36 units long, so the cut reaches about 52 units ahead of the feet.
const stab = (damage: number, knockback: { x: number; y: number }, hitStopMs: number): MeleeHit => ({
  x: 2,
  y: -38,
  w: 50,
  h: 34,
  damage,
  knockback,
  hitStopMs,
  tags: LIGHT_TAGS,
})

function scalpelMove(name: string, timing: Timing, hit: MeleeHit, tier: 1 | 2): AttackMove {
  return move(name, timing, (ctx, self) => swing(ctx, self, hit, tier === 2))
}

// Scalpel variants. Pass Cut leaves a cut along the dash line. Rising Cut opens upward.
function passCut(tier: 1 | 2): AttackMove {
  const hit: MeleeHit = { x: -50, y: -38, w: 104, h: 36, damage: 10, knockback: { x: 90, y: -50 }, hitStopMs: 25, tags: LIGHT_TAGS }
  return move('Pass Cut', dashLightTiming(30, 80, 110), strike(hit, tier === 2))
}

function risingCut(tier: 1 | 2): AttackMove {
  const knockback = { x: 60, y: -240 }
  return move('Rising Cut', variantTiming(95, 60, 200, 175), (ctx, self) => {
    const ms = activeMs(ctx, self)
    if (tier === 1) {
      overheadBox(ctx, 46, 30, ms, 12, knockback, 25, LIGHT_TAGS)
      return
    }
    overheadBox(ctx, 46, 30, ms, 12 * DUAL_SHARE, knockback, 25, LIGHT_TAGS)
    later(ctx, 40, () => overheadBox(ctx, 46, 30, ms, 12 * DUAL_SHARE, knockback, 25, LIGHT_TAGS))
  })
}

export const scalpelMoveset: WeaponMoveset = {
  id: 'scalpel',
  dashLight: memoTier(passCut),
  upLight: memoTier(risingCut),
  moves: memoMoves((slot, tier) => {
    if (slot === 'heavy') return []
    const quick = { x: 70, y: -20 }
    return [
      scalpelMove('Scalpel cut', lightTiming(95, 50, 200, 175, 120), stab(12, quick, 25), tier),
      scalpelMove('Scalpel cut', lightTiming(95, 50, 200, 175, 120), stab(12, quick, 25), tier),
      scalpelMove('Scalpel cut', lightTiming(95, 50, 200, 175, 120), stab(12, quick, 25), tier),
      scalpelMove('Scalpel slash', lightTiming(115, 60, 280, 215, 200), stab(20, { x: 200, y: -120 }, 45), tier),
    ]
  }),
}

// Sequence whip: a long hitbox, tall enough for the drawn whip and its smear. Tier 2 pulls
// hit enemies towards the player (negative knockback x).
const lash = (damage: number, push: number, hitStopMs: number, tier: 1 | 2): MeleeHit => ({
  x: 4,
  y: -38,
  w: 70,
  h: 30,
  damage,
  knockback: tier === 2 ? { x: -120, y: -30 } : { x: push, y: -40 },
  hitStopMs,
  tags: LIGHT_TAGS,
})

// Whip variants. Crack trails the dash and snaps behind. Sky Lash reaches straight up.
function crack(tier: 1 | 2): AttackMove {
  // Behind the mage a negative push sends the enemy further back. Tier 2 pulls it in, as its lash does.
  const hit: MeleeHit = {
    x: -78,
    y: -28,
    w: 74,
    h: 10,
    damage: tier === 2 ? 13 : 11,
    knockback: tier === 2 ? { x: 120, y: -30 } : { x: -130, y: -40 },
    hitStopMs: 30,
    tags: LIGHT_TAGS,
  }
  return move('Crack', dashLightTiming(30, 70, 120), (ctx, self) => {
    spawnMelee(ctx, activeMs(ctx, self), hit)
    const feet = ctx.player.position()
    const dir = ctx.player.facing()
    streak(ctx, feet.x, feet.y - 24, feet.x - dir * 78 * ctx.rangeScale, feet.y - 22, 140)
  })
}

function skyLash(tier: 1 | 2): AttackMove {
  // Tier 2 drags a flyer down towards the mage, as its lash pulls enemies in.
  const knockback = tier === 2 ? { x: 0, y: 160 } : { x: 20, y: -220 }
  return move('Sky Lash', variantTiming(130, 75, 260, 185), (ctx, self) => {
    overheadBox(ctx, 92, 24, activeMs(ctx, self), 14, knockback, 35, LIGHT_TAGS)
    const feet = ctx.player.position()
    streak(ctx, feet.x + ctx.player.facing() * 4, feet.y - 34, feet.x, feet.y - 30 - 92 * ctx.rangeScale, 140)
  })
}

export const whipMoveset: WeaponMoveset = {
  id: 'sequenceWhip',
  dashLight: memoTier(crack),
  upLight: memoTier(skyLash),
  moves: memoMoves((slot, tier) => {
    if (slot === 'heavy') return []
    return [
      move('Whip lash', lightTiming(130, 75, 260, 185, 60), (ctx, self) => spawnMelee(ctx, activeMs(ctx, self), lash(13, 130, 30, tier))),
      move('Whip crack', lightTiming(150, 85, 320, 235, 100), (ctx, self) => spawnMelee(ctx, activeMs(ctx, self), lash(17, 200, 45, tier))),
    ]
  }),
}
