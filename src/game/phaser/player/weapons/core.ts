import Phaser from 'phaser'
import type { Combatant, HitboxSpec, HitEvent, ProjectileSpec } from '../../../contracts/combat'
import type { LegendaryId, MechanicId, PlayerBuild } from '../../../contracts/progression'
import { createFxPool } from './fx'
import type { FxPool } from './fx'
import { aimedVelocity } from './helpers'
import type { DamageState, Point } from './helpers'
import type { LoadoutDeps } from './index'
import { createScheduler } from './scheduler'
import type { Scheduler } from './scheduler'

export type PassiveId = MechanicId | LegendaryId

export const PASSIVE_IDS: readonly PassiveId[] = [
  'doubleJump',
  'airDash',
  'wallJump',
  'tripleCombo',
  'groundSlam',
  'parry',
  'hatGlide',
  'lifesteal',
  'reflectDash',
  'echoStrike',
  'shockwaveHeavy',
  'familiar',
  'extraChoice',
  'serialDilution',
  'centrifugeSpin',
  'fumeHood',
  'sampleFreeze',
  'citationNeeded',
  'autoclave',
  'secondWind',
  'theOntology',
  'gitRevert',
  'doiExcalibur',
  'fairPrinciples',
  'peerReview',
  'peerPressure',
  'labCoat',
]

export interface Feature {
  sync(build: PlayerBuild): void
  // Once per fixed step, outside hit-stop.
  update(dtMs: number): void
  // Once per rendered frame, after the player has moved. Visuals that follow the mage go here.
  render?(): void
  resetFight?(): void
}

export interface ExtraBox {
  // Centre and size of the box in world units.
  cx: number
  cy: number
  w: number
  h: number
  face: 1 | -1
  // The final damage. The damage modifier leaves it unchanged.
  damage: number
  tags: string[]
  activeMs?: number
  knockback?: Point
  hitStopMs?: number
  maxTargets?: number
  // The boss stagger multiplier, see HitboxSpec.stagger.
  stagger?: number
}

// Secondary hits (echo, chain, reviewer, DOI) belong to a stand-in attacker on the wielder's team,
// who also names the wielder on the death screen (the FAIR trader wields a loadout too).
// The damage modifier and every player-hit listener skip them, so a secondary hit never triggers
// another one and its damage is exactly what the caller computed.
export interface ExtraAttacks {
  // Puts the stand-in at a world point and returns it, for specs that a caller builds itself.
  at(x: number, y: number, face: 1 | -1): Combatant
  box(box: ExtraBox): void
}

export interface Core {
  readonly deps: LoadoutDeps
  readonly scheduler: Scheduler
  readonly fx: FxPool
  readonly flags: Record<PassiveId, boolean>
  readonly damage: DamageState
  readonly extra: ExtraAttacks
  // Handlers for a lethal hit. The first one that returns true cancels the hit.
  readonly lethal: ((hit: HitEvent) => boolean)[]
  // Set by Peer Review to see every spec that the player's moves spawn.
  onPlayerSpec: ((spec: HitboxSpec | ProjectileSpec, origin: Point | null) => void) | null
  // Bumped by every sync, so cached move lists rebuild.
  version: number
  build: PlayerBuild
  // A small bolt of the player at the nearest enemy, shared by the familiar and the A letter.
  autoBolt(from: Point, to: Point, damage: number): void
  // Registers an unsubscribe function to call on destroy.
  own(unsubscribe: () => void): void
  destroy(): void
}

const NO_KNOCKBACK = { x: 0, y: 0 }
const AUTO_SPEED = 320

function createExtraAttacks(deps: LoadoutDeps): ExtraAttacks {
  const state = { x: 0, y: 0, face: 1 as 1 | -1 }
  const hurtbox = new Phaser.Geom.Rectangle(0, 0, 0, 0)
  const standIn: Combatant = {
    id: `${deps.player.id}-extra`,
    team: deps.player.team,
    killer: deps.player.killer,
    hurtbox: () => hurtbox,
    facing: () => state.face,
    position: () => state,
    isInvulnerable: () => true,
    receiveHit() {},
    isDead: () => false,
  }
  const at = (x: number, y: number, face: 1 | -1) => {
    state.x = x
    state.y = y
    state.face = face
    return standIn
  }
  return {
    at,
    box(box) {
      deps.combat.spawnHitbox({
        owner: at(box.cx, box.cy + box.h / 2, box.face),
        shape: { kind: 'rect', x: -box.w / 2, y: -box.h, w: box.w, h: box.h },
        follow: false,
        activeMs: box.activeMs ?? 60,
        damage: box.damage,
        knockback: box.knockback ?? NO_KNOCKBACK,
        hitStopMs: box.hitStopMs ?? 0,
        maxTargets: box.maxTargets ?? 1,
        tags: box.tags,
        stagger: box.stagger,
      })
    },
  }
}

export function createCore(deps: LoadoutDeps, build: PlayerBuild): Core {
  const flags = {} as Record<PassiveId, boolean>
  for (const id of PASSIVE_IDS) flags[id] = false
  const disposers: (() => void)[] = []
  const scheduler = createScheduler()
  const fx = createFxPool(deps.scene, deps.art)

  return {
    deps,
    scheduler,
    fx,
    flags,
    damage: { multiplier: 1, critChance: 0, critMultiplier: 1.5 },
    extra: createExtraAttacks(deps),
    lethal: [],
    onPlayerSpec: null,
    version: 0,
    build,
    autoBolt(from, to, damage) {
      const ref = deps.art.projectile(deps.scene, 'bolt')
      deps.combat.spawnProjectile(
        {
          owner: deps.player,
          shape: { kind: 'circle', x: 0, y: 0, r: 4 },
          textureKey: ref.textureKey,
          animKey: ref.animKey,
          velocity: aimedVelocity(from, to, AUTO_SPEED, deps.player.facing()),
          gravity: 0,
          lifetimeMs: 1300,
          pierce: 0,
          reflectable: false,
          damage,
          knockback: { x: 50, y: -20 },
          hitStopMs: 0,
          maxTargets: Infinity,
          tags: ['projectile', 'auto'],
        },
        from,
      )
    },
    own(unsubscribe) {
      disposers.push(unsubscribe)
    },
    destroy() {
      for (const dispose of disposers) dispose()
      disposers.length = 0
      scheduler.clear()
      fx.destroy()
    },
  }
}
