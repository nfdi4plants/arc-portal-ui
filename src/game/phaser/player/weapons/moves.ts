import type { CombatWorld, HitboxSpec, ProjectileSpec } from '../../../contracts/combat'
import type { AttackContext, AttackMove, WeaponMoveset } from '../../../contracts/player'
import type { WeaponSlot } from '../../../contracts/progression'
import type { Core, Feature } from './core'
import { forgivingShape } from './helpers'
import type { Point } from './helpers'
import { SUB_HITS, bindFx, bindScheduler, heavyOf, spawnShockwaves, streak } from './kit'
import type { HeavyDeclaration } from './kit'
import { airHeavyOf, dashHeavyOf, dashLightOf, upHeavyOf, upLightOf, upward } from './variants'

export interface MoveLayer extends Feature {
  // Returns a moveset that runs the base moves and adds the combat effects of the mechanics.
  wrap(base: WeaponMoveset): WeaponMoveset
}

const DOI_SHARE = 0.6

// Shockwave Heavy follows every heavy move, also the dash and up heavies that leave the mage free to
// move, so its waves carry no 'heavy' tag and never stagger.
const SHOCKWAVE = { damage: 12, width: 14, height: 16, speed: 230, distance: 150, tags: ['shockwave'] }

// Ground Slam: the landing of every air heavy covers 50% more and sends two waves along the ground.
const SLAM_AREA = 1.5
const SLAM_WAVES = { damage: 12, width: 16, height: 18, speed: 240, distance: 160 }

// Reach of the Triple Combo spin behind and ahead of the feet.
const SPIN_BACK = 56
const SPIN_FRONT = 80

// Wraps the weapon movesets, including their air, dash and up variants (or the fallbacks from
// variants.ts). Every move runs through a copy of the attack context whose combat world makes the
// player's hitboxes a little more forgiving (forgivingShape) and reports each spawned spec back (to
// Peer Review, and for DOI Excalibur the largest damage of a heavy move that declares none). The
// mechanics that change or extend a move live here:
//  - tripleCombo appends a spin finisher to the light string
//  - groundSlam makes every air heavy land harder: its landing hits use 1.5 times the melee range,
//    and two waves run along the ground. An air heavy without a landing hit gets the waves only.
//  - shockwaveHeavy and doiExcalibur add their hits when the main damage of a heavy move happens.
//    That is the start of the active phase (later for a move that declares a delay), or the
//    landing for an air heavy that has one. Dash and up heavies count as heavy moves.
// echoStrike needs nothing here: it repeats every hit tagged 'light', dash lights included.
export function createMoveLayer(core: Core): MoveLayer {
  const { deps, flags } = core
  const { player, combat: real } = deps
  const tap = { active: false, maxDamage: 0 }

  const note = (hit: HitboxSpec | ProjectileSpec, origin: Point | null) => {
    if (tap.active && hit.damage > tap.maxDamage) tap.maxDamage = hit.damage
    if (hit.owner === player) core.onPlayerSpec?.(hit, origin)
  }

  const tapped: CombatWorld = {
    register: (combatant) => real.register(combatant),
    unregister: (combatant) => real.unregister(combatant),
    spawnHitbox(spec) {
      const hit = spec.owner === player ? { ...spec, shape: forgivingShape(spec.shape) } : spec
      note(hit, null)
      return real.spawnHitbox(hit)
    },
    spawnProjectile(shot, origin) {
      note(shot, origin)
      return real.spawnProjectile(shot, origin)
    },
    cancelOwnedBy: (owner) => real.cancelOwnedBy(owner),
    addSlowZone: (zone) => real.addSlowZone(zone),
    cancelShots: (team, area) => real.cancelShots(team, area),
    livingCombatants: (team) => real.livingCombatants(team),
    on: (event, listener) => real.on(event, listener),
    setDamageModifier: (modifier) => real.setDamageModifier(modifier),
    update: (deltaMs) => real.update(deltaMs),
    hitStopRemainingMs: () => real.hitStopRemainingMs(),
    destroy: () => real.destroy(),
  }

  const tappedCtx = (ctx: AttackContext): AttackContext => ({ ...ctx, combat: tapped })

  // One box covers both sides, so an enemy that overlaps the middle is hit once. The combat world
  // mirrors knockback by the attacker's facing only, so every enemy flies the way the mage faces.
  // It reaches as far ahead as the staff thrust, and the lunge closes the gap the knockback of the
  // string's last hit opened.
  const spin = (ctx: AttackContext) => {
    const scale = ctx.rangeScale
    const feet = ctx.player.position()
    const face = ctx.player.facing()
    ctx.combat.spawnHitbox({
      owner: player,
      shape: { kind: 'rect', x: -SPIN_BACK * scale, y: -48, w: (SPIN_BACK + SPIN_FRONT) * scale, h: 48 },
      follow: true,
      activeMs: 120 / ctx.player.getBuild().stats.attackSpeed,
      damage: 20,
      knockback: { x: 220, y: -140 },
      hitStopMs: 50,
      maxTargets: Infinity,
      tags: ['light', 'finisher'],
    })
    streak(ctx, feet.x - face * SPIN_BACK * scale, feet.y - 26, feet.x + face * SPIN_FRONT * scale, feet.y - 22, 140)
  }

  const finisherBase: AttackMove = {
    name: 'Spin finisher',
    startupMs: 130,
    activeMs: 120,
    recoveryMs: 320,
    cancelAfterMs: 240,
    lunge: 120,
    allowedInAir: true,
    spin: true,
    onActive: spin,
  }

  const doiHits = (moveDamage: number) => {
    const view = deps.scene.cameras.main.worldView
    const damage = moveDamage * DOI_SHARE * core.damage.multiplier
    const face = player.facing()
    for (const enemy of deps.enemies()) {
      if (enemy.isDead()) continue
      const hb = enemy.hurtbox()
      if (hb.right < view.x || hb.x > view.right || hb.bottom < view.y || hb.y > view.bottom) continue
      const cx = hb.x + hb.width / 2
      const cy = hb.y + hb.height / 2
      core.extra.box({ cx, cy, w: hb.width, h: hb.height, face, damage, tags: ['extra', 'doi'], knockback: { x: 0, y: -40 } })
      core.fx.burst(cx, cy, 'hit')
    }
  }

  const heavyExtras = (ctx: AttackContext, moveDamage: number) => {
    if (flags.shockwaveHeavy) spawnShockwaves(ctx, SHOCKWAVE)
    if (flags.doiExcalibur && moveDamage > 0) doiHits(moveDamage)
  }

  // Runs a move body and returns the largest damage it spawned.
  const measure = (ctx: AttackContext, body: (ctx: AttackContext) => void): number => {
    tap.maxDamage = 0
    tap.active = true
    try {
      body(ctx)
    } finally {
      tap.active = false
    }
    return tap.maxDamage
  }

  // A heavy move that declares its damage triggers the extras when that damage happens. One that
  // declares nothing (the staff moves) triggers them right after the body, with the largest damage
  // the body spawned.
  const extrasAfter = (ctx: AttackContext, heavy: HeavyDeclaration | undefined, spawned: number, useDelay: boolean) => {
    if (!heavy) {
      heavyExtras(ctx, spawned)
      return
    }
    const delayMs = useDelay ? (heavy.delayMs ?? 0) / core.build.stats.attackSpeed : 0
    if (delayMs > 0) core.scheduler.at(delayMs, () => heavyExtras(ctx, heavy.damage), SUB_HITS)
    else heavyExtras(ctx, heavy.damage)
  }

  const light = (move: AttackMove): AttackMove => ({
    ...move,
    onActive: (ctx) => move.onActive(tappedCtx(ctx)),
  })

  const heavy = (move: AttackMove): AttackMove => {
    const declared = heavyOf(move)
    return {
      ...move,
      onActive(ctx) {
        const wrapped = tappedCtx(ctx)
        extrasAfter(wrapped, declared, measure(wrapped, move.onActive), true)
      },
    }
  }

  const land = (ctx: AttackContext, landing: AttackMove['onLand'], declared: HeavyDeclaration | undefined) => {
    const wrapped = tappedCtx(ctx)
    const slam = flags.groundSlam
    if (landing) {
      const area = slam ? { ...wrapped, rangeScale: wrapped.rangeScale * SLAM_AREA } : wrapped
      extrasAfter(wrapped, declared, measure(area, (c) => landing(c)), false)
    }
    if (slam) spawnShockwaves(wrapped, SLAM_WAVES)
  }

  const airHeavy = (move: AttackMove): AttackMove => {
    const declared = heavyOf(move)
    const landing = move.onLand
    return {
      ...move,
      onActive(ctx) {
        const wrapped = tappedCtx(ctx)
        const spawned = measure(wrapped, move.onActive)
        // A move that lands has its main damage on the landing.
        if (!landing) extrasAfter(wrapped, declared, spawned, true)
      },
      onLand: landing || flags.groundSlam ? (ctx) => land(ctx, landing, declared) : undefined,
    }
  }

  const buildList = (base: WeaponMoveset, slot: WeaponSlot, tier: 1 | 2): AttackMove[] => {
    const moves = base.moves(slot, tier).map((move) => (slot === 'light' ? light(move) : heavy(move)))
    // A heavy weapon has no light string, so it gets no finisher either.
    if (slot === 'light' && flags.tripleCombo && moves.length > 0) moves.push(light(finisherBase))
    return moves
  }

  core.own(bindScheduler(deps.scene, core.scheduler))
  core.own(bindFx(deps.scene, core.fx))
  // A hit or a dash cancels the attack, so its sub-hits stop with it.
  const interrupt = () => core.scheduler.cancel(SUB_HITS)
  core.own(player.on('damaged', interrupt))
  core.own(player.on('dashed', interrupt))

  return {
    wrap(base) {
      const lists: (AttackMove[] | undefined)[] = [undefined, undefined, undefined, undefined]
      // Air heavy, dash light, dash heavy and up heavy, two tiers each. Null is a cached "none".
      const singles: (AttackMove | null | undefined)[] = Array.from({ length: 8 }, () => undefined)
      const upLights = [new Map<number, AttackMove | null>(), new Map<number, AttackMove | null>()]
      let version = -1
      const fresh = () => {
        if (version === core.version) return
        lists.fill(undefined)
        singles.fill(undefined)
        for (const map of upLights) map.clear()
        version = core.version
      }
      const single = (kind: number, tier: 1 | 2, make: () => AttackMove | null): AttackMove | null => {
        fresh()
        const index = kind * 2 + tier - 1
        let result = singles[index]
        if (result === undefined) {
          result = make()
          singles[index] = result
        }
        return result
      }
      const list = (slot: WeaponSlot, tier: 1 | 2): AttackMove[] => {
        fresh()
        return (lists[(slot === 'light' ? 0 : 2) + tier - 1] ??= buildList(base, slot, tier))
      }
      return {
        id: base.id,
        moves: list,
        airHeavy: (tier) =>
          single(0, tier, () => {
            const move = airHeavyOf(base, tier)
            return move && airHeavy(move)
          }),
        dashLight: (tier) =>
          single(1, tier, () => {
            const move = dashLightOf(base, tier)
            return move && light(move)
          }),
        dashHeavy: (tier) =>
          single(2, tier, () => {
            const move = dashHeavyOf(base, tier)
            return move && heavy(move)
          }),
        upHeavy: (tier) =>
          single(3, tier, () => {
            const move = upHeavyOf(base, tier)
            return move && heavy(move)
          }),
        upLight(tier, comboIndex) {
          fresh()
          const cache = upLights[tier - 1]
          let result = cache.get(comboIndex)
          if (result !== undefined) return result
          // Past the end of the weapon's own string comes the Triple Combo finisher.
          const own = base.moves('light', tier).length
          // The finisher turns overhead only for a weapon whose lights do, so a wand keeps aiming.
          let move = upLightOf(base, tier, Math.min(comboIndex, Math.max(0, own - 1)))
          if (move && comboIndex >= own) move = flags.tripleCombo ? upward(finisherBase) : null
          result = move && light(move)
          cache.set(comboIndex, result)
          return result
        },
      }
    },
    sync() {},
    update() {},
  }
}
