import type { CombatWorld } from '../../../contracts/combat'
import type { AttackContext, AttackMove, WeaponMoveset } from '../../../contracts/player'
import { overheadShape, upwardKnockback } from './helpers'
import { burst, declareHeavy, heavyOf } from './kit'

// The air, dash and up versions of a weapon's moves. A moveset that defines a variant gets it
// as is. For the others a fallback is derived from the slot's moves. Fallbacks are cached by the
// move they come from, so the attack machine can ask on every attack.

type Derive = (source: AttackMove) => AttackMove

function cached(cache: WeakMap<AttackMove, AttackMove>, source: AttackMove, make: Derive): AttackMove {
  let result = cache.get(source)
  if (!result) {
    result = make(source)
    const heavy = heavyOf(source)
    if (heavy) declareHeavy(result, heavy)
    cache.set(source, result)
  }
  return result
}

const PLUNGE_DAMAGE = 30

const plunges = new WeakMap<AttackMove, AttackMove>()
const dashLights = new WeakMap<AttackMove, AttackMove>()
const dashHeavies = new WeakMap<AttackMove, AttackMove>()
const ups = new WeakMap<AttackMove, AttackMove>()
const overheads = new WeakMap<CombatWorld, CombatWorld>()

// A plain plunge that slams on landing with the heavy move's damage.
const genericPlunge: Derive = (heavy) => {
  const damage = heavyOf(heavy)?.damage ?? PLUNGE_DAMAGE
  return {
    name: 'Plunge',
    startupMs: 80,
    activeMs: 0,
    recoveryMs: 220,
    cancelAfterMs: 150,
    allowedInAir: true,
    hover: { ms: 80 },
    plunge: { speed: 720 },
    landingLockMs: 200,
    onActive() {},
    onLand(ctx) {
      const feet = ctx.player.position()
      ctx.combat.spawnHitbox({
        owner: ctx.player,
        shape: { kind: 'circle', x: 0, y: -8, r: 52 * ctx.rangeScale },
        follow: false,
        activeMs: 110,
        damage,
        knockback: { x: 100, y: -320 },
        hitStopMs: 80,
        maxTargets: Infinity,
        tags: ['heavy', 'slam'],
      })
      burst(ctx, feet.x, feet.y - 6, 'crit', 2.5 * ctx.rangeScale)
    },
  }
}

const momentumLight: Derive = (light) => ({ ...light, keepsMomentum: true, cancelAfterMs: 0, allowedInAir: true })

const airborneHeavy: Derive = (heavy) => ({ ...heavy, allowedInAir: true })

// A combat world that spawns hitboxes overhead and leaves projectiles alone, so a weapon that
// shoots at the pointer keeps doing that.
function overhead(real: CombatWorld): CombatWorld {
  let world = overheads.get(real)
  if (world) return world
  world = {
    register: (combatant) => real.register(combatant),
    unregister: (combatant) => real.unregister(combatant),
    spawnHitbox: (spec) => real.spawnHitbox({ ...spec, shape: overheadShape(spec.shape), knockback: upwardKnockback(spec.knockback) }),
    spawnProjectile: (spec, origin) => real.spawnProjectile(spec, origin),
    cancelOwnedBy: (owner) => real.cancelOwnedBy(owner),
    livingCombatants: (team) => real.livingCombatants(team),
    on: (event, listener) => real.on(event, listener),
    setDamageModifier: (modifier) => real.setDamageModifier(modifier),
    update: (deltaMs) => real.update(deltaMs),
    hitStopRemainingMs: () => real.hitStopRemainingMs(),
    destroy: () => real.destroy(),
  }
  overheads.set(real, world)
  return world
}

// The move with its hitboxes turned overhead. A forward lunge would carry the mage away from a
// target above, so it is dropped.
export const upward: Derive = (source) => ({
  ...source,
  lunge: 0,
  allowedInAir: true,
  onActive: (ctx: AttackContext) => source.onActive({ ...ctx, combat: overhead(ctx.combat) }),
})

export function airHeavyOf(set: WeaponMoveset, tier: 1 | 2): AttackMove | null {
  if (set.airHeavy) return set.airHeavy(tier)
  const heavy = set.moves('heavy', tier)[0]
  return heavy ? cached(plunges, heavy, genericPlunge) : null
}

export function dashLightOf(set: WeaponMoveset, tier: 1 | 2): AttackMove | null {
  if (set.dashLight) return set.dashLight(tier)
  const light = set.moves('light', tier)[0]
  return light ? cached(dashLights, light, momentumLight) : null
}

export function dashHeavyOf(set: WeaponMoveset, tier: 1 | 2): AttackMove | null {
  if (set.dashHeavy) return set.dashHeavy(tier)
  const heavy = set.moves('heavy', tier)[0]
  return heavy ? cached(dashHeavies, heavy, airborneHeavy) : null
}

export function upLightOf(set: WeaponMoveset, tier: 1 | 2, comboIndex: number): AttackMove | null {
  if (set.upLight) return set.upLight(tier, comboIndex)
  const moves = set.moves('light', tier)
  return moves.length > 0 ? cached(ups, moves[comboIndex % moves.length], upward) : null
}

export function upHeavyOf(set: WeaponMoveset, tier: 1 | 2): AttackMove | null {
  if (set.upHeavy) return set.upHeavy(tier)
  const heavy = set.moves('heavy', tier)[0]
  return heavy ? cached(ups, heavy, upward) : null
}

// Upward overrides for the ranged weapons, which aim at the pointer instead.
export const NO_UP: Pick<WeaponMoveset, 'upLight' | 'upHeavy'> = {
  upLight: () => null,
  upHeavy: () => null,
}
