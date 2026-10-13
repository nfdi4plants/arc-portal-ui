import type { CombatWorld, HitboxSpec, ProjectileSpec } from '../../../contracts/combat'
import { PALETTE } from '../../../contracts/constants'
import type { AttackContext, AttackMove, WeaponMoveset } from '../../../contracts/player'
import type { WeaponSlot } from '../../../contracts/progression'
import type { Core, Feature } from './core'
import type { Point } from './helpers'
import { spawnShockwaves } from './kit'

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

// Wraps the weapon movesets. Every move runs through a copy of the attack context whose combat
// world reports each spawned spec back (the largest damage for DOI Excalibur, the specs for
// Peer Review). The mechanics that change or extend a move live here:
//  - tripleCombo appends a spin finisher to the light string
//  - pogo turns a light attack in the air with down held into a downward stab that bounces
//  - groundSlam turns a heavy attack in the air with down held into a plunge. It also lets the
//    heavy attack start in the air, because the attack machine decides that before it can see
//    the held keys. Without down the heavy move plays as usual.
//  - shockwaveHeavy and doiExcalibur add their hits after every heavy move
export function createMoveLayer(core: Core): MoveLayer {
  const { deps, flags } = core
  const { player, combat: real } = deps
  const tap = { active: false, maxDamage: 0 }
  let plunging = false
  let plungeMs = 0

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

  // Both sides get their own box, so knockback pushes enemies away from the player on either side.
  const spin = (ctx: AttackContext) => {
    const scale = ctx.rangeScale
    const activeMs = 120 / ctx.player.getBuild().stats.attackSpeed
    for (const side of [1, -1]) {
      ctx.combat.spawnHitbox({
        owner: player,
        shape: { kind: 'rect', x: side === 1 ? 0 : -48 * scale, y: -40, w: 48 * scale, h: 40 },
        follow: true,
        activeMs,
        damage: 14,
        knockback: { x: side * 220, y: -140 },
        hitStopMs: 50,
        maxTargets: Infinity,
        tags: ['light', 'finisher'],
      })
    }
  }

  const finisher: AttackMove = {
    name: 'Spin finisher',
    startupMs: 80,
    activeMs: 120,
    recoveryMs: 260,
    cancelAfterMs: 160,
    lunge: 0,
    allowedInAir: true,
    onActive: (ctx) => run(ctx, 'light', spin, false),
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
    core.fx.burst(feet.x, feet.y - 6, 56 * scale, PALETTE.cream, 220)
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
      core.fx.burst(cx, cy, 16, PALETTE.yellow, 260)
    }
  }

  // Runs a move body. `extras` is false for bodies that add nothing after the move.
  function run(ctx: AttackContext, slot: WeaponSlot, body: (ctx: AttackContext) => void, extras = true) {
    const airborne = !player.isGrounded()
    const down = ctx.held.has('down')
    if (slot === 'light' && flags.pogo && airborne && down) {
      pogoStab({ ...ctx, combat: tapped })
      return
    }
    if (slot === 'heavy' && flags.groundSlam && airborne && down) {
      startPlunge(ctx)
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
    if (slot !== 'heavy' || !extras) return
    const moveDamage = tap.maxDamage
    if (flags.shockwaveHeavy) spawnShockwaves(wrapped, SHOCKWAVE)
    if (flags.doiExcalibur && moveDamage > 0) doiHits(moveDamage)
  }

  const build = (base: WeaponMoveset, slot: WeaponSlot, tier: 1 | 2, air: boolean): AttackMove[] => {
    const moves = base.moves(slot, tier).map(
      (move): AttackMove => ({ ...move, allowedInAir: move.allowedInAir || air, onActive: (ctx) => run(ctx, slot, move.onActive) }),
    )
    if (slot === 'light' && flags.tripleCombo) moves.push(finisher)
    return moves
  }

  core.own(
    real.on('hit', (event) => {
      if (event.attacker !== player || !event.tags.includes('pogo')) return
      player.setVelocity(player.velocity().x, POGO_BOUNCE)
    }),
  )
  core.own(player.on('damaged', () => (plunging = false)))

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
      else if (plungeMs > PLUNGE_MAX_MS || player.isDead()) plunging = false
    },
  }
}
