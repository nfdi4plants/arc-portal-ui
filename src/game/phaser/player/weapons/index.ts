import type Phaser from 'phaser'
import type { ScribbleArt } from '../../../contracts/art'
import type { Combatant, CombatWorld } from '../../../contracts/combat'
import type { AbilityHandler, PlayerHandle, WeaponMoveset } from '../../../contracts/player'
import type { PlayerBuild } from '../../../contracts/progression'
import type { BossCharge } from '../../../model/progression'
import type { Rng } from '../../../contracts/rng'
import {
  createAutoclave,
  createCentrifugeSpin,
  createCitationNeeded,
  createFumeHood,
  createLabCoat,
  createPeerPressure,
  createSampleFreeze,
  createSecondWind,
} from './abilities'
import { PASSIVE_IDS, createCore } from './core'
import { createCorruption } from './corrupted'
import { CORRUPTION } from '../../../model/progression'
import type { Feature } from './core'
import { beakerMoveset, bunsenMoveset, discMoveset, petriMoveset } from './heavy'
import { createDamageModifier, damageMultiplier } from './helpers'
import { createFairPrinciples, createGitRevert, createOntology, createPeerReview } from './legendaries'
import { pipetteMoveset, scalpelMoveset, wandMoveset, whipMoveset } from './light'
import { createEcho, createFamiliar, createParry, createReflectDash } from './mechanics'
import { createMoveLayer } from './moves'
import { staffMoveset } from '../staffMoveset'

export interface LoadoutDeps {
  scene: Phaser.Scene
  combat: CombatWorld
  art: ScribbleArt
  player: PlayerHandle
  rng: Rng
  // Living enemies the scene knows about, for effects that target or chain.
  enemies(): readonly Combatant[]
  // The run's Second Wind charge, which recharges when a boss falls. Without it (the sandboxes)
  // the loadout keeps its own and recharges it at the start of every boss fight.
  secondWind?: BossCharge
}

export interface Loadout {
  // Applies a new build: registers movesets, sets ability handlers per build.abilitySlots,
  // updates damage modifier and passive effects. Idempotent.
  sync(build: PlayerBuild): void
  // Once per fixed step, skipped during hit-stop.
  update(dtMs: number): void
  // Called by the scene when a boss fight starts, for once-per-fight effects (gitRevert charge).
  resetFight(): void
  destroy(): void
}

export type LoadoutWithStatus = Loadout & {
  // True while Git Revert is owned and its once-per-fight rewind is still available.
  gitRevertCharged(): boolean
  // True while Second Wind is owned and its heal is still available until the next boss falls.
  secondWindCharged(): boolean
  // Terms of Service: after a level-up card the mage reads the EULA. Nothing without the augment.
  readEula(): void
}

// The eight new weapons. The staff stays with the player and is wrapped inside the loadout.
export const WEAPON_MOVESETS: readonly WeaponMoveset[] = [
  wandMoveset,
  pipetteMoveset,
  scalpelMoveset,
  whipMoveset,
  discMoveset,
  beakerMoveset,
  bunsenMoveset,
  petriMoveset,
]

export function attachLoadout(deps: LoadoutDeps): LoadoutWithStatus {
  const { scene, combat, player } = deps
  const core = createCore(deps, player.getBuild())

  const moves = createMoveLayer(core)
  const parry = createParry(core)
  const familiar = createFamiliar(core)
  const gitRevert = createGitRevert(core)
  const abilities = {
    centrifugeSpin: createCentrifugeSpin(core),
    fumeHood: createFumeHood(core),
    sampleFreeze: createSampleFreeze(core),
    citationNeeded: createCitationNeeded(core),
    autoclave: createAutoclave(core),
    secondWind: createSecondWind(core),
    peerPressure: createPeerPressure(core),
    labCoat: createLabCoat(core),
  }
  const corruption = createCorruption(core)
  const features: Feature[] = [
    moves,
    corruption,
    createEcho(core),
    createReflectDash(core),
    parry,
    familiar,
    createOntology(core),
    gitRevert,
    createFairPrinciples(core),
    createPeerReview(core),
    ...Object.values(abilities),
  ]
  const handlers: Record<string, AbilityHandler> = {
    parry: parry.handler,
    familiar: familiar.handler,
    gitRevert: gitRevert.handler,
  }
  for (const [id, ability] of Object.entries(abilities)) handlers[id] = ability.handler
  // Rogue Admin: every ability waits three times as long. The same handler with a longer cooldown.
  const slowHandlers: Record<string, AbilityHandler> = {}
  for (const [id, handler] of Object.entries(handlers)) {
    slowHandlers[id] = {
      get cooldownMs() {
        return handler.cooldownMs * CORRUPTION.rogueAdmin.abilityCooldown
      },
      activate: (ctx) => handler.activate(ctx),
    }
  }
  let slowAbilities = false
  const movesets = [...WEAPON_MOVESETS, staffMoveset].map((moveset) => moves.wrap(moveset))
  const critRoll = deps.rng.fork('loadout-crit')
  const modifier = createDamageModifier(player, core.damage, () => critRoll.next(), corruption.damage)
  // Ids last given to each ability slot, so a sync keeps the cooldown of a slot that did not change.
  const applied: (string | null | undefined)[] = [undefined, undefined, undefined, undefined]
  let destroyed = false

  // event.damage is what the target took, after armour and weak points. Secondary hits belong to
  // the stand-in attacker, so they never heal.
  core.own(
    combat.on('hit', (event) => {
      if (event.attacker !== player || core.build.stats.lifesteal <= 0) return
      player.heal(event.damage * core.build.stats.lifesteal)
    }),
  )

  player.setLethalHitInterceptor((hit) => {
    for (const handler of core.lethal) if (handler(hit)) return true
    return false
  })

  const render = () => {
    for (const feature of features) feature.render?.()
  }
  scene.events.on('postupdate', render)

  const destroy = () => {
    if (destroyed) return
    destroyed = true
    scene.events.off('postupdate', render)
    scene.events.off('shutdown', destroy)
    combat.setDamageModifier(null)
    player.setLethalHitInterceptor(null)
    for (let slot = 0; slot < applied.length; slot++) if (applied[slot]) player.setAbilityHandler(slot, null)
    core.destroy()
  }
  scene.events.once('shutdown', destroy)

  return {
    sync(build) {
      core.build = build
      const owned = new Set<string>([...build.mechanics, ...build.legendaries])
      for (const id of PASSIVE_IDS) core.flags[id] = owned.has(id)
      core.damage.multiplier = damageMultiplier(build.stats.damage, core.flags.fairPrinciples)
      // Rogue Admin: every hit crits.
      core.damage.critChance = build.corrupted.includes('rogueAdmin') ? 1 : build.stats.critChance
      core.damage.critMultiplier = build.stats.critMultiplier
      combat.setDamageModifier(modifier)
      core.version++

      for (const moveset of movesets) player.registerMoveset(moveset)
      const slow = build.corrupted.includes('rogueAdmin')
      if (slow !== slowAbilities) applied.fill(undefined)
      slowAbilities = slow
      const table = slow ? slowHandlers : handlers
      for (let slot = 0; slot < applied.length; slot++) {
        const id = build.abilitySlots[slot] ?? null
        if (applied[slot] === id) continue
        applied[slot] = id
        player.setAbilityHandler(slot, id ? (table[id] ?? null) : null)
      }
      for (const feature of features) feature.sync(build)
    },
    update(dtMs) {
      core.scheduler.update(dtMs)
      for (const feature of features) feature.update(dtMs)
      core.fx.update(dtMs)
    },
    resetFight() {
      for (const feature of features) feature.resetFight?.()
    },
    destroy,
    gitRevertCharged: gitRevert.charged,
    readEula: () => corruption.readEula(),
    secondWindCharged: abilities.secondWind.charged,
  }
}
