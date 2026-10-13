import type { CombatWorld, HitboxSpec, ProjectileSpec } from '../../../contracts/combat'
import type { AttackContext, AttackMove, WeaponMoveset } from '../../../contracts/player'
import type { WeaponSlot } from '../../../contracts/progression'
import type { Core, Feature } from './core'
import type { Point } from './helpers'
import { SUB_HITS, bindScheduler, heavyOf, spawnShockwaves } from './kit'
import type { HeavyDeclaration } from './kit'

export interface MoveLayer extends Feature {
  // Returns a moveset that runs the base moves and adds the combat effects of the mechanics.
  wrap(base: WeaponMoveset): WeaponMoveset
}

const PLUNGE_SPEED = 720
// A plunge that never lands (it was knocked off course, say) ends after this long.
const PLUNGE_MAX_MS = 2000
const POGO_BOUNCE = -480
const DOI_SHARE = 0.6

const SHOCKWAVE = { damage: 12, width: 14, height: 16, speed: 230, distance: 150 }

// The plunge move that a heavy press with down held plays in the air.
const PLUNGE_MOVE = { startupMs: 60, activeMs: 40, recoveryMs: 200, cancelAfterMs: 80 }

// Wraps the weapon movesets. Every move runs through a copy of the attack context whose combat
// world reports each spawned spec back (to Peer Review, and for DOI Excalibur the largest damage
// of a heavy move that declares none). The mechanics that change or extend a move live here:
//  - tripleCombo appends a spin finisher to the light string
//  - pogo turns a light attack in the air with down held into a downward stab that bounces
//  - groundSlam lets the heavy attack start in the air. The press decides at its start whether it
//    is a plunge (attackStarted carries the held keys, so down held in the air is a plunge), and
//    the heavy then plays a quick plunge move that slams on landing. Without down the heavy move
//    plays as usual.
//  - shockwaveHeavy and doiExcalibur add their hits when the main damage of a heavy move happens.
//    That is the start of the active phase, except for the Petri shield, whose bash comes later.
export function createMoveLayer(core: Core): MoveLayer {
  const { deps, flags } = core
  const { player, combat: real } = deps
  const tap = { active: false, maxDamage: 0 }
  let plunging = false
  let plungeMs = 0
  // Set by attackStarted: the heavy that just started is a plunge.
  let plunge = false

  const note = (hit: HitboxSpec | ProjectileSpec, origin: Point | null) => {
    if (tap.active && hit.damage > tap.maxDamage) tap.maxDamage = hit.damage
    if (hit.owner === player) core.onPlayerSpec?.(hit, origin)
  }

  const tapped: CombatWorld = {
    register: (combatant) => real.register(combatant),
    unregister: (combatant) => real.unregister(combatant),
    spawnHitbox(hit) {
      note(hit, null)
      return real.spawnHitbox(hit)
    },
    spawnProjectile(shot, origin) {
      note(shot, origin)
      return real.spawnProjectile(shot, origin)
    },
    cancelOwnedBy: (owner) => real.cancelOwnedBy(owner),
    livingCombatants: (team) => real.livingCombatants(team),
    on: (event, listener) => real.on(event, listener),
    setDamageModifier: (modifier) => real.setDamageModifier(modifier),
    update: (deltaMs) => real.update(deltaMs),
    hitStopRemainingMs: () => real.hitStopRemainingMs(),
    destroy: () => real.destroy(),
  }

  const pogoStab = (ctx: AttackContext) => {
    ctx.combat.spawnHitbox({
      owner: player,
      shape: { kind: 'rect', x: -11, y: -6, w: 22, h: 34 * ctx.rangeScale },
      follow: true,
      activeMs: 120 / ctx.player.getBuild().stats.attackSpeed,
      damage: 12,
      knockback: { x: 0, y: 220 },
      hitStopMs: 30,
      maxTargets: Infinity,
      tags: ['light', 'pogo'],
    })
  }

  // One box covers both sides, so an enemy that overlaps the middle is hit once. The combat world
  // mirrors knockback by the attacker's facing only, so every enemy flies the way the mage faces.
  const spin = (ctx: AttackContext) => {
    const scale = ctx.rangeScale
    ctx.combat.spawnHitbox({
      owner: player,
      shape: { kind: 'rect', x: -48 * scale, y: -40, w: 96 * scale, h: 40 },
      follow: true,
      activeMs: 120 / ctx.player.getBuild().stats.attackSpeed,
      damage: 14,
      knockback: { x: 220, y: -140 },
      hitStopMs: 50,
      maxTargets: Infinity,
      tags: ['light', 'finisher'],
    })
  }

  const finisher: AttackMove = {
    name: 'Spin finisher',
    startupMs: 80,
    activeMs: 120,
    recoveryMs: 260,
    cancelAfterMs: 160,
    lunge: 0,
    allowedInAir: true,
    onActive: (ctx) => run(ctx, 'light', spin),
  }

  const startPlunge = (ctx: AttackContext) => {
    plunging = true
    plungeMs = 0
    ctx.player.setVelocity(0, PLUNGE_SPEED)
  }

  const land = () => {
    plunging = false
    const feet = player.position()
    const scale = core.build.stats.meleeRange
    real.spawnHitbox({
      owner: player,
      shape: { kind: 'circle', x: 0, y: -8, r: 56 * scale },
      follow: false,
      activeMs: 110,
      damage: 30,
      knockback: { x: 240, y: -300 },
      hitStopMs: 80,
      maxTargets: Infinity,
      tags: ['heavy', 'slam'],
    })
    core.fx.burst(feet.x, feet.y - 6, 'crit', 2.5 * scale)
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

  // Runs a move body. A heavy move that declares its damage triggers the extras when that damage
  // happens. One that declares nothing (the staff slam) triggers them after the body, with the
  // largest damage the body spawned.
  function run(ctx: AttackContext, slot: WeaponSlot, body: (ctx: AttackContext) => void, heavy?: HeavyDeclaration) {
    if (slot === 'light' && flags.pogo && !player.isGrounded() && ctx.held.has('down')) {
      pogoStab({ ...ctx, combat: tapped })
      return
    }
    const wrapped: AttackContext = { ...ctx, combat: tapped }
    tap.maxDamage = 0
    tap.active = true
    try {
      body(wrapped)
    } finally {
      tap.active = false
    }
    if (slot !== 'heavy') return
    if (!heavy) {
      heavyExtras(wrapped, tap.maxDamage)
      return
    }
    const delayMs = (heavy.delayMs ?? 0) / core.build.stats.attackSpeed
    if (delayMs > 0) core.scheduler.at(delayMs, () => heavyExtras(wrapped, heavy.damage), SUB_HITS)
    else heavyExtras(wrapped, heavy.damage)
  }

  // The heavy move of a mage in the air with Ground Slam. The attack machine picks the move before
  // attackStarted says whether down was held, and it reads the timing of the move on every step.
  // So the timing follows `plunge`, which that event sets.
  const airHeavy = (move: AttackMove, heavy: HeavyDeclaration | undefined): AttackMove => ({
    name: move.name,
    get startupMs() {
      return plunge ? PLUNGE_MOVE.startupMs : move.startupMs
    },
    get activeMs() {
      return plunge ? PLUNGE_MOVE.activeMs : move.activeMs
    },
    get recoveryMs() {
      return plunge ? PLUNGE_MOVE.recoveryMs : move.recoveryMs
    },
    get cancelAfterMs() {
      return plunge ? PLUNGE_MOVE.cancelAfterMs : move.cancelAfterMs
    },
    get lunge() {
      return plunge ? 0 : move.lunge
    },
    allowedInAir: true,
    onActive: (ctx) => (plunge ? startPlunge(ctx) : run(ctx, 'heavy', move.onActive, heavy)),
  })

  const build = (base: WeaponMoveset, slot: WeaponSlot, tier: 1 | 2, air: boolean): AttackMove[] => {
    const moves = base.moves(slot, tier).map((move): AttackMove => {
      const heavy = slot === 'heavy' ? heavyOf(move) : undefined
      if (air) return airHeavy(move, heavy)
      return { ...move, onActive: (ctx) => run(ctx, slot, move.onActive, heavy) }
    })
    if (slot === 'light' && flags.tripleCombo) moves.push(finisher)
    return moves
  }

  core.own(
    real.on('hit', (event) => {
      if (event.attacker !== player || !event.tags.includes('pogo')) return
      player.setVelocity(player.velocity().x, POGO_BOUNCE)
    }),
  )
  core.own(bindScheduler(deps.scene, core.scheduler))
  core.own(
    player.on('attackStarted', ({ slot, held }) => {
      // A new attack ends a plunge that is still falling.
      plunging = false
      plunge = slot === 'heavy' && flags.groundSlam && !player.isGrounded() && held.has('down')
    }),
  )
  // A hit or a dash cancels the attack, so its sub-hits and a plunge in flight stop with it.
  const interrupt = () => {
    plunging = false
    core.scheduler.cancel(SUB_HITS)
  }
  core.own(player.on('damaged', interrupt))
  core.own(player.on('dashed', interrupt))

  return {
    wrap(base) {
      const ground: (AttackMove[] | undefined)[] = [undefined, undefined, undefined, undefined]
      const air: (AttackMove[] | undefined)[] = [undefined, undefined]
      let version = -1
      return {
        id: base.id,
        moves(slot, tier) {
          if (version !== core.version) {
            ground.fill(undefined)
            air.fill(undefined)
            version = core.version
          }
          if (slot === 'heavy' && flags.groundSlam && !player.isGrounded()) return (air[tier - 1] ??= build(base, slot, tier, true))
          return (ground[(slot === 'light' ? 0 : 2) + tier - 1] ??= build(base, slot, tier, false))
        },
      }
    },
    sync() {},
    update(dtMs) {
      if (!plunging) return
      plungeMs += dtMs
      if (player.isGrounded()) land()
      // The plunge sets a downward speed, so an upward one means a jump has taken over.
      else if (plungeMs > PLUNGE_MAX_MS || player.isDead() || player.velocity().y < 0) plunging = false
    },
  }
}
