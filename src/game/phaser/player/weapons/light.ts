import type { AttackContext, AttackMove, WeaponMoveset } from '../../../contracts/player'
import { aimedVelocity } from './helpers'
import type { MeleeHit, Shot, Timing } from './kit'
import { activeMs, burst, dashLightTiming, fallMs, fireShot, groundBelow, later, linger, memoMoves, memoTier, move, muzzle, overheadBox, spawnArea, spawnMelee, streak, variantTiming } from './kit'
import { UNGROUPED } from './scheduler'
import { NO_UP } from './variants'

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

// A one-hit melee box that lasts the active phase. Dual Scalpels add a second hit 40 ms later.
const strike = (hit: MeleeHit, dual = false) => (ctx: AttackContext, self: AttackMove) => swing(ctx, self, hit, dual)


// Wand variants. Starfall rains bolts down ahead while the mage hangs in the air. Slipshot fires
// along the dash. Blink Nova bursts where the dash carried the mage.
const STARFALL_ANGLES = [0.55, 0.9, 1.25, 0.72, 1.08]

function starfall(tier: 1 | 2): AttackMove {
  const count = tier === 2 ? 5 : 3
  const bolt = { ...WAND_BOLT(tier === 2 ? 14 : 12), radius: 6, pierce: 1, hitStopMs: 30, tags: ['heavy', 'projectile'] }
  return move(
    'Starfall',
    variantTiming(80, 170, 200, 120, { hover: { ms: 250 } }),
    (ctx) => {
      const fire = (i: number) => {
        const angle = STARFALL_ANGLES[i]
        const dir = ctx.player.facing()
        fireShot(ctx, muzzle(ctx), { ...bolt, velocity: { x: dir * Math.cos(angle) * 400, y: Math.sin(angle) * 400 } })
      }
      fire(0)
      for (let i = 1; i < count; i++) later(ctx, (i * 170) / count, () => fire(i))
    },
    { damage: bolt.damage * 2 },
  )
}

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

function blinkNova(tier: 1 | 2): AttackMove {
  const damage = tier === 2 ? 32 : 26
  const r = tier === 2 ? 56 : 44
  return move(
    'Blink Nova',
    variantTiming(90, 60, 240, 170, { keepsMomentum: true, lockMs: 180 }),
    (ctx) => {
      ctx.combat.spawnHitbox({
        owner: ctx.player,
        shape: { kind: 'circle', x: 0, y: -22, r },
        follow: false,
        activeMs: 90,
        damage,
        knockback: { x: 160, y: -220 },
        hitStopMs: 60,
        maxTargets: Infinity,
        tags: ['heavy', 'nova'],
      })
      const feet = ctx.player.position()
      burst(ctx, feet.x, feet.y - 22, 'levelUp', r / 30)
      burst(ctx, feet.x, feet.y - 22, 'crit', r / 26)
    },
    { damage },
  )
}

export const wandMoveset: WeaponMoveset = {
  id: 'wand',
  ...NO_UP,
  airHeavy: memoTier(starfall),
  dashLight: memoTier(slipshot),
  dashHeavy: memoTier(blinkNova),
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

// Pipette variants. Drip Bomb hangs and drops a cluster that splashes on the floor below. Spray
// covers the retreat with droplets behind the dash. Puddle leaves a pool that keeps hitting.
const DRIP_GRAVITY = 1100
const DRIP_DROP_SPEED = 80

function dripBomb(tier: 1 | 2): AttackMove {
  const splash = tier === 2 ? { r: 44, damage: 30 } : { r: 34, damage: 24 }
  return move(
    'Drip Bomb',
    variantTiming(60, 140, 200, 140, { hover: { ms: 200 } }),
    (ctx) => {
      const from = muzzle(ctx)
      const floor = groundBelow(ctx, from.x, from.y, 420)
      // Time to fall to the floor from v0 under constant gravity: d = v0 t + g t^2 / 2.
      const depth = floor === null ? 0 : floor - from.y
      const fallS = floor === null ? 0.7 : (-DRIP_DROP_SPEED + Math.sqrt(DRIP_DROP_SPEED ** 2 + 2 * DRIP_GRAVITY * depth)) / DRIP_GRAVITY
      for (const vx of [-50, 0, 50]) {
        fireShot(ctx, from, {
          ...DROPLET(6, tier),
          velocity: { x: vx, y: DRIP_DROP_SPEED },
          gravity: DRIP_GRAVITY,
          lifetimeMs: fallS * 1000,
          tags: ['heavy', 'projectile'],
        })
      }
      if (floor === null) return
      const at = { x: from.x, y: floor - 8 }
      // Ungrouped: the cluster is already falling, so a hit on the mage does not stop the splash.
      later(
        ctx,
        fallS * 1000,
        () => {
          spawnArea(ctx, at, {
            art: 'droplet',
            shape: { kind: 'circle', x: 0, y: 0, r: splash.r },
            damage: splash.damage,
            knockback: { x: 60, y: -240 },
            lifetimeMs: 120,
            hitStopMs: 60,
            tags: ['heavy', 'splash'],
          })
          burst(ctx, at.x, at.y, 'hit', splash.r / 20)
        },
        UNGROUPED,
      )
    },
    { damage: splash.damage },
  )
}

function spray(tier: 1 | 2): AttackMove {
  return move('Spray', dashLightTiming(30, 60, 110), (ctx) => {
    const from = muzzle(ctx)
    const back = -ctx.player.facing()
    for (const spread of [-0.25, 0, 0.25]) {
      fireShot(ctx, from, { ...DROPLET(5, tier), lifetimeMs: 260, velocity: { x: back * Math.cos(spread) * 320, y: Math.sin(spread) * 320 } })
    }
  })
}

function puddle(tier: 1 | 2): AttackMove {
  const width = tier === 2 ? 96 : 72
  const damage = tier === 2 ? 8 : 6
  return move(
    'Puddle',
    variantTiming(70, 60, 220, 160, { keepsMomentum: true, lockMs: 150 }),
    (ctx) => {
      const feet = ctx.player.position()
      linger(
        ctx,
        { x: feet.x, y: feet.y - 4 },
        {
          art: 'droplet',
          shape: { kind: 'rect', x: -width / 2, y: -6, w: width, h: 10 },
          damage,
          knockback: { x: 40, y: -120 },
          lifetimeMs: 190,
          tags: ['heavy', 'puddle'],
        },
        5,
        200,
      )
      burst(ctx, feet.x, feet.y - 4, 'hit', 1.4)
    },
    { damage: damage * 3 },
  )
}

export const pipetteMoveset: WeaponMoveset = {
  id: 'pipettePistol',
  ...NO_UP,
  airHeavy: memoTier(dripBomb),
  dashLight: memoTier(spray),
  dashHeavy: memoTier(puddle),
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

// Scalpel variants. Incision Dive stabs down and forward on the way to the floor. Pass Cut leaves
// a cut along the dash line. Cross Section is an X of two slashes. Rising Cut opens upward.
const DIVE = { speed: 560, drift: 300 }

function incisionDive(tier: 1 | 2): AttackMove {
  const stabHit: MeleeHit = { x: -4, y: -26, w: 34, h: 34, damage: tier === 2 ? 15 : 20, knockback: { x: 160, y: 120 }, hitStopMs: 30, tags: HEAVY_TAGS }
  const cut: MeleeHit = { x: -10, y: -30, w: 52, h: 30, damage: tier === 2 ? 18 : 14, knockback: { x: 220, y: -180 }, hitStopMs: 60, tags: HEAVY_TAGS }
  return move(
    'Incision Dive',
    variantTiming(60, 0, 160, 100, { hover: { ms: 60 }, plunge: DIVE, landingLockMs: 120, onLand: (ctx) => spawnMelee(ctx, 90, cut) }),
    (ctx) => {
      const duration = fallMs(ctx, DIVE.speed)
      spawnMelee(ctx, duration, stabHit)
      if (tier === 2) later(ctx, 40, () => spawnMelee(ctx, duration, stabHit))
    },
    { damage: cut.damage + stabHit.damage },
  )
}

function passCut(tier: 1 | 2): AttackMove {
  const hit: MeleeHit = { x: -50, y: -34, w: 80, h: 18, damage: 10, knockback: { x: 90, y: -50 }, hitStopMs: 25, tags: LIGHT_TAGS }
  return move('Pass Cut', dashLightTiming(30, 80, 110), strike(hit, tier === 2))
}

function crossSection(tier: 1 | 2): AttackMove {
  const damage = tier === 2 ? 20 : 16
  const slash = (knockback: { x: number; y: number }): MeleeHit => ({ x: 0, y: -52, w: 52, h: 52, damage, knockback, hitStopMs: 40, tags: HEAVY_TAGS })
  const first = slash({ x: 160, y: -220 })
  const second = slash({ x: 260, y: -60 })
  return move(
    'Cross Section',
    variantTiming(80, 100, 260, 200, { keepsMomentum: true, lockMs: 200 }),
    (ctx, self) => {
      const duration = activeMs(ctx, self) / 2
      const feet = ctx.player.position()
      const dir = ctx.player.facing()
      const reach = 56 * ctx.rangeScale
      spawnMelee(ctx, duration, first)
      streak(ctx, feet.x + dir * 6, feet.y - 56, feet.x + dir * reach, feet.y - 4, 160)
      later(ctx, 50, () => {
        const now = ctx.player.position()
        spawnMelee(ctx, duration, second)
        streak(ctx, now.x + dir * 6, now.y - 4, now.x + dir * reach, now.y - 56, 160)
      })
    },
    { damage: damage * 2 },
  )
}


function risingCut(tier: 1 | 2): AttackMove {
  const knockback = { x: 60, y: -240 }
  return move('Rising Cut', variantTiming(50, 60, 110, 60), (ctx, self) => {
    const ms = activeMs(ctx, self)
    if (tier === 1) {
      overheadBox(ctx, 46, 30, ms, 9, knockback, 25, LIGHT_TAGS)
      return
    }
    overheadBox(ctx, 46, 30, ms, 9 * DUAL_SHARE, knockback, 25, LIGHT_TAGS)
    later(ctx, 40, () => overheadBox(ctx, 46, 30, ms, 9 * DUAL_SHARE, knockback, 25, LIGHT_TAGS))
  })
}

export const scalpelMoveset: WeaponMoveset = {
  id: 'scalpel',
  airHeavy: memoTier(incisionDive),
  dashLight: memoTier(passCut),
  dashHeavy: memoTier(crossSection),
  upLight: memoTier(risingCut),
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

// Whip variants. Lasso Drop lands and pulls both sides in. Crack trails the dash and snaps behind.
// Whirl spins the whip all the way round. Sky Lash reaches straight up.
const LASSO = { speed: 640 }

function lassoDrop(tier: 1 | 2): AttackMove {
  const reach = tier === 2 ? 120 : 90
  const damage = tier === 2 ? 20 : 16
  return move(
    'Lasso Drop',
    variantTiming(80, 0, 200, 140, {
      hover: { ms: 80 },
      plunge: LASSO,
      landingLockMs: 150,
      onLand(ctx) {
        const feet = ctx.player.position()
        const length = reach * ctx.rangeScale
        // One half per side, each facing outward, so the negative knockback pulls both sides in
        // towards the landing point. An enemy right under the mage is in both halves.
        for (const face of [1, -1] as const) {
          spawnArea(ctx, { x: feet.x, y: feet.y }, {
            art: 'bolt',
            shape: { kind: 'rect', x: 4, y: -26, w: length - 4, h: 26 },
            damage,
            knockback: { x: -260, y: -60 },
            lifetimeMs: 110,
            hitStopMs: 50,
            tags: ['heavy', 'pull'],
            face,
          })
          streak(ctx, feet.x, feet.y - 14, feet.x + face * length, feet.y - 8, 200)
        }
      },
    }),
    () => {},
    { damage },
  )
}

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

function whirl(tier: 1 | 2): AttackMove {
  const r = tier === 2 ? 85 : 70
  const damage = tier === 2 ? 34 : 28
  return move(
    'Whirl',
    variantTiming(90, 160, 260, 200, { lockMs: 250 }),
    (ctx, self) => {
      ctx.combat.spawnHitbox({
        owner: ctx.player,
        shape: { kind: 'circle', x: 0, y: -24, r: r * ctx.rangeScale },
        follow: true,
        activeMs: activeMs(ctx, self),
        damage,
        knockback: { x: 200, y: -180 },
        hitStopMs: 70,
        maxTargets: Infinity,
        tags: HEAVY_TAGS,
      })
      const feet = ctx.player.position()
      burst(ctx, feet.x, feet.y - 24, 'hit', (r * ctx.rangeScale) / 24)
    },
    { damage },
  )
}

function skyLash(tier: 1 | 2): AttackMove {
  // Tier 2 drags a flyer down towards the mage, as its lash pulls enemies in.
  const knockback = tier === 2 ? { x: 0, y: 160 } : { x: 20, y: -220 }
  return move('Sky Lash', variantTiming(90, 70, 170, 90), (ctx, self) => {
    overheadBox(ctx, 92, 14, activeMs(ctx, self), 12, knockback, 35, LIGHT_TAGS)
    const feet = ctx.player.position()
    streak(ctx, feet.x + ctx.player.facing() * 4, feet.y - 34, feet.x, feet.y - 30 - 92 * ctx.rangeScale, 140)
  })
}

export const whipMoveset: WeaponMoveset = {
  id: 'sequenceWhip',
  airHeavy: memoTier(lassoDrop),
  dashLight: memoTier(crack),
  dashHeavy: memoTier(whirl),
  upLight: memoTier(skyLash),
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
