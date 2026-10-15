import type Phaser from 'phaser'
import type { ScribbleArt } from '../../contracts/art'
import type { Combatant, CombatWorld, KillerInfo } from '../../contracts/combat'
import type { Action, InputFrame } from '../../contracts/input'
import type { PlayerWeaponId } from '../../contracts/progression'
import { traderFighterArt } from '../art'
import { frameName } from '../art/layout'
import type { InputLayer } from '../input/InputLayer'
import { acquireBubble, releaseBubble } from '../mobs/bubbles'
import { createPlayer, type Player } from '../player/Player'
import { attachLoadout } from '../player/weapons'
import type { HudBoss } from './context'
import type { RunDirector } from './RunDirector'
import { createTraderBrain, type Reach, type TraderSense } from './traderAi'

// The fight against the FAIR trader after the fourth strike. He is the mage's own body (Player)
// with his own look, on the enemy team, with a loadout of his own (traderBuild: his legendary
// weapons, every legendary augment and a common card per level) and the brain of traderAi.ts on
// the buttons. The waystation steps him, holds him with the world and shows his hp on the HUD.

export const TRADER_BOSS_NAME = 'The FAIR Trader (unFAIR mode)'
// He clears the counter before he starts to think.
const VAULT_MS = 650
const VAULT_SPEED = { x: 150, y: -340 }
// He fades out over this long after he falls, then the loot opens.
const DEFEAT_MS = 1600
const BUBBLE_MS = 1700
const BUBBLE_WRAP = 140

// How each of his weapons wants to be used.
const REACH: Partial<Record<PlayerWeaponId, Reach>> = { arcitect: 'melee', arcCommander: 'ranged', gitLfs: 'ranged', publicationPress: 'melee' }

export interface TraderFightDeps {
  scene: Phaser.Scene
  combat: CombatWorld
  art: ScribbleArt
  director: RunDirector
  // The waystation after node boss `index`.
  index: number
  // The mage.
  player: Player
  colliders: Phaser.Types.Physics.Arcade.ArcadeColliderType[]
  room: { left: number; right: number }
}

export interface TraderFight {
  readonly fighter: Combatant
  readonly hud: HudBoss
  // Once per fixed step outside hit-stop.
  step(dtMs: number): void
  // Every rendered frame: the speech bubble and the fade after the defeat.
  frame(deltaMs: number): void
  setFrozen(frozen: boolean): void
  // His hp ran out.
  defeated(): boolean
  // He has faded out after the defeat.
  done(): boolean
  // What he said as he fell.
  defeatLine(): string
  destroy(): void
}

// Puts him on the counter at (x, counterY) and lets him vault towards the mage.
export function startTraderFight(deps: TraderFightDeps, x: number, counterY: number): TraderFight {
  const { scene, combat, art, director, index, player } = deps
  const build = director.traderFighter(index)
  const killer: KillerInfo = { kind: 'trader', line: director.traderFightLine('kill') }

  // His buttons. The brain writes what he holds each step, and the presses and releases are the
  // difference to the step before. The Player reads one frame per step, so a second read in the
  // same step (while frozen) gets no edges and nothing is pressed twice.
  const held = new Set<Action>()
  const before = new Set<Action>()
  const pressed = new Set<Action>()
  const released = new Set<Action>()
  const none = new Set<Action>()
  const aim = { x: 0, y: 0 }
  const live: InputFrame = { held, pressed, released, aim }
  const spent: InputFrame = { held, pressed: none, released: none, aim }
  let fresh = false
  const input: InputLayer = {
    frame() {
      if (!fresh) return spent
      fresh = false
      return live
    },
    setBindings() {},
    setEnabled() {},
    destroy() {},
  }

  const ref = traderFighterArt(scene)
  const fighter = createPlayer(
    scene,
    {
      combat,
      art,
      input,
      build,
      colliders: deps.colliders,
      identity: { id: 'trader', team: 'enemy', killer },
      look: { texture: ref.textureKey, frame: frameName(0) },
      // Light hits only cost him hp. Heavy ones make him flinch and fly like the mage does.
      hits: { iframesMs: 0, poise: (hit) => !hit.tags.includes('heavy') },
    },
    x,
    counterY,
  )
  const foes: readonly Combatant[] = [player]
  const loadout = attachLoadout({ scene, combat, art, player: fighter, rng: director.rng.fork(`traderLoadout/${index}`), enemies: () => foes })
  loadout.sync(build)
  loadout.resetFight()
  const dir = player.position().x >= x ? 1 : -1
  fighter.setVelocity(dir * VAULT_SPEED.x, VAULT_SPEED.y)

  const brain = createTraderBrain(
    {
      light: REACH[build.weapons.light.id] ?? 'melee',
      heavy: REACH[build.weapons.heavy.id] ?? 'melee',
      pressureSlot: build.abilitySlots.indexOf('peerPressure'),
      preprintSlot: build.abilitySlots.indexOf('labCoat'),
    },
    director.rng.fork(`traderAi/${index}`),
  )
  const sense: TraderSense = {
    self: { x: 0, y: 0, grounded: false },
    foe: { x: 0, y: 0, dead: false, heavyWindup: false },
    room: deps.room,
    pressureReady: false,
    preprintReady: false,
  }

  let clock = 0
  // When the mage's heavy wind-up ends, for the dodge, and the name of his own heavy for the HUD.
  let foeHeavyUntil = 0
  let attackName: string | null = null
  let attackLeftMs = 0
  let defeatedAt = -1
  let fadeMs = 0
  let bubble: Phaser.GameObjects.Text | null = null
  let bubbleMs = 0
  let destroyed = false
  let lastWords = ''

  const say = (line: string) => {
    bubble ??= acquireBubble(scene).setWordWrapWidth(BUBBLE_WRAP, true).setAlign('center')
    bubble.setText(line).setOrigin(0.5, 1).setVisible(true)
    bubbleMs = BUBBLE_MS
  }

  const stops = [
    player.on('attackStarted', ({ slot, move }) => {
      if (slot === 'heavy') foeHeavyUntil = clock + move.startupMs / player.getBuild().stats.attackSpeed
    }),
    fighter.on('attackStarted', ({ slot, move }) => {
      if (slot !== 'heavy') return
      // His heavies are named on the HUD from the wind-up on, like a boss attack.
      attackName = `${move.name}!`
      attackLeftMs = (move.startupMs + move.activeMs) / build.stats.attackSpeed
    }),
  ]

  const ready = (slot: number) => slot >= 0 && fighter.abilityCooldownRemainingMs(slot) <= 0

  const hud: HudBoss = {
    hpFraction: () => Math.max(0, fighter.hp()) / build.stats.maxHp,
    showHpBar: () => defeatedAt < 0,
    currentAttackName: () => (attackLeftMs > 0 && defeatedAt < 0 ? attackName : null),
    staggerFraction: () => 0,
    staggerState: () => null,
  }

  return {
    fighter,
    hud,
    step(dtMs) {
      if (destroyed) return
      clock += dtMs
      if (bubbleMs > 0) {
        bubbleMs -= dtMs
        if (bubbleMs <= 0) bubble?.setVisible(false)
      }
      if (defeatedAt >= 0) return
      if (fighter.isDead()) {
        defeatedAt = clock
        held.clear()
        fresh = true
        combat.cancelOwnedBy(fighter)
        loadout.destroy()
        lastWords = director.traderFightLine('defeat')
        say(lastWords)
        return
      }
      attackLeftMs = Math.max(0, attackLeftMs - dtMs)
      const self = fighter.position()
      const foe = player.hurtbox()
      aim.x = foe.centerX
      aim.y = foe.centerY
      if (clock < VAULT_MS) {
        held.clear()
      } else {
        sense.self.x = self.x
        sense.self.y = self.y
        sense.self.grounded = fighter.isGrounded()
        sense.foe.x = foe.centerX
        sense.foe.y = foe.bottom
        sense.foe.dead = player.isDead()
        sense.foe.heavyWindup = clock < foeHeavyUntil
        sense.pressureReady = ready(build.abilitySlots.indexOf('peerPressure'))
        sense.preprintReady = ready(build.abilitySlots.indexOf('labCoat'))
        if (brain.think(sense, dtMs, held) === 'pressure') say(director.traderFightLine('pressure'))
      }
      pressed.clear()
      released.clear()
      for (const action of held) if (!before.has(action)) pressed.add(action)
      for (const action of before) if (!held.has(action)) released.add(action)
      before.clear()
      for (const action of held) before.add(action)
      fresh = true
      loadout.update(dtMs)
    },
    frame(deltaMs) {
      if (destroyed) return
      if (bubble && bubbleMs > 0) {
        const box = fighter.hurtbox()
        bubble.setPosition(box.centerX, box.y - 8)
      }
      if (defeatedAt < 0) return
      fadeMs += deltaMs
      fighter.gameObject.setAlpha(Math.max(0, 1 - fadeMs / DEFEAT_MS))
    },
    setFrozen(frozen) {
      if (!destroyed) fighter.setFrozen(frozen)
    },
    defeated: () => defeatedAt >= 0,
    done: () => defeatedAt >= 0 && fadeMs >= DEFEAT_MS,
    defeatLine: () => lastWords,
    destroy() {
      if (destroyed) return
      destroyed = true
      for (const stop of stops) stop()
      if (bubble) releaseBubble(scene, bubble)
      bubble = null
      loadout.destroy()
      fighter.destroy()
    },
  }
}
