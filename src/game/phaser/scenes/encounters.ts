import Phaser from 'phaser'
import { DEPTH, TILE } from '../../contracts/constants'
import type { EncounterKind } from '../../model/run'
import { ARM_LENGTH, applySpriteRef, DATENKRAKE_ARMS, DATENKRAKE_HEIGHT, DATENKRAKE_WIDTH, datenkrakeArmArt, datenkrakeArt, TRADER_HEIGHT, TRADER_WIDTH, traderArt } from '../art'
import { acquireBubble } from '../mobs/bubbles'
import type { Player } from '../player/Player'
import type { RunDirector } from './RunDirector'

// The encounters of the waystation. Each kind of `model/run/encounters.ts` has a spawner here that
// puts it on the floor at the x of its slot. The waystation scene shows the interaction prompt and
// calls interact() when the player presses up within reach, or at once for an `auto` encounter.

// The player interacts from up to this far beyond either side of an encounter.
const REACH = TILE / 2
const GOODBYE_MS = 3800
const CALL_OUT_MS = 3200
const BUBBLE_WRAP = 150

// What the waystation offers its encounters.
export interface EncounterHost {
  readonly scene: Phaser.Scene
  readonly director: RunDirector
  // The node boss this waystation follows.
  readonly index: number
  readonly floorY: number
  readonly player: Player
  // Holds the world and opens the FAIR trade store of this waystation.
  openStore(): void
  // Holds the world while an encounter animates on its own.
  hold(on: boolean): void
  // Holds the world and opens the Datenkrake overlay.
  openDatenkrake(): void
}

export interface Encounter {
  // Where the player can interact. Empty for an encounter without an interaction.
  readonly zone: Phaser.Geom.Rectangle
  // The word of the prompt after the key, for example "Trade".
  readonly action: string
  // Interacts by itself when the player walks into the zone, without a prompt.
  readonly auto?: boolean
  // Where the prompt sits: over the middle of the top of the encounter.
  readonly promptX: number
  readonly promptY: number
  // The player pressed up within reach.
  interact(): void
  // The overlay interact() opened was closed again.
  closed(): void
  // The player came within reach or left it.
  near(near: boolean): void
  // The intro banner is gone and the player can move.
  arrived(): void
  // True while something is said over the encounter. The prompt waits for it.
  talking(): boolean
  update(dtMs: number): void
  // Every rendered frame, also while the world is held.
  frame?(deltaMs: number): void
}

export type EncounterSpawner = (host: EncounterHost, x: number) => Encounter

// The FAIR trader behind the stall. He calls out a greeting when the mage arrives, opens the store on
// up and says goodbye in a bubble when the store closes.
function spawnTrader(host: EncounterHost, x: number): Encounter {
  const { scene, director, floorY } = host
  const ref = traderArt(scene)
  const sprite = scene.add.sprite(x, floorY, ref.textureKey).setDepth(DEPTH.tiles + 1)
  applySpriteRef(sprite, ref)
  const top = floorY - TRADER_HEIGHT
  const zone = new Phaser.Geom.Rectangle(x - TRADER_WIDTH / 2 - REACH, top, TRADER_WIDTH + 2 * REACH, TRADER_HEIGHT)
  let bubble: Phaser.GameObjects.Text | null = null
  let bubbleMs = 0
  // A greeting called out across the room gives way to the prompt once the mage is near.
  let callOut = false

  const hide = () => {
    bubbleMs = 0
    bubble?.setVisible(false)
  }
  const say = (line: string, ms: number) => {
    bubble ??= acquireBubble(scene).setWordWrapWidth(BUBBLE_WRAP, true).setAlign('center')
    bubble.setText(line).setOrigin(0.5, 1).setPosition(x, top - 4).setVisible(true)
    bubbleMs = ms
  }

  return {
    zone,
    action: 'Trade',
    promptX: x,
    promptY: top - 4,
    interact() {
      hide()
      host.openStore()
    },
    closed() {
      callOut = false
      say(director.traderLine('goodbye'), GOODBYE_MS)
    },
    near(near) {
      if (near && callOut) hide()
    },
    arrived() {
      callOut = true
      say(director.traderLine('greeting'), CALL_OUT_MS)
    },
    talking: () => bubbleMs > 0,
    update(dtMs) {
      if (bubbleMs <= 0) return
      bubbleMs -= dtMs
      if (bubbleMs <= 0) hide()
    },
  }
}

// The Datenkrake reaches this far beyond the sides of its body.
const GRAB_REACH = TILE
const GRAB_MS = 380
const LIFT_MS = 320
const LIFT = 14
const RELEASE_MS = 320
const SWAY_MS = 1700
const SWAY = 0.2
// The grabbing tentacle comes out of the mantle here, from the bottom centre of the body, and holds
// the mage this far above its feet.
const GRAB_FROM = { x: -18, y: -30 }
const CHEST = 26

type KrakenPhase = 'idle' | 'reach' | 'lift' | 'held' | 'release' | 'done'

const ease = (t: number) => 1 - (1 - t) * (1 - t)

// The Datenkrake in front of its server rack. Its tentacles sway. When the mage walks into its
// reach it grabs the mage with a tentacle, lifts it a little and opens the overlay that asks for an
// augment. After the choice it lets go with a line of its own and never grabs again in this
// waystation. A build with nothing to take only gets mocked.
function spawnDatenkrake(host: EncounterHost, x: number): Encounter {
  const { scene, director, floorY, index, player } = host
  const ref = datenkrakeArt(scene)
  const armRef = datenkrakeArmArt(scene)
  const arms = DATENKRAKE_ARMS.map((arm) => {
    const sprite = scene.add.sprite(x + arm.x, floorY + arm.y, armRef.textureKey).setDepth(DEPTH.tiles + 1)
    applySpriteRef(sprite, armRef)
    return sprite.setRotation(arm.angle)
  })
  const body = scene.add.sprite(x, floorY, ref.textureKey).setDepth(DEPTH.tiles + 2)
  applySpriteRef(body, ref)
  const grab = scene.add.sprite(x + GRAB_FROM.x, floorY + GRAB_FROM.y, armRef.textureKey).setDepth(DEPTH.player + 1)
  applySpriteRef(grab, armRef)
  grab.setVisible(false)
  const armScaleY = grab.scaleY
  const top = floorY - DATENKRAKE_HEIGHT
  const zone = new Phaser.Geom.Rectangle(x - DATENKRAKE_WIDTH / 2 - GRAB_REACH, floorY - 4 * TILE, DATENKRAKE_WIDTH + 2 * GRAB_REACH, 4 * TILE)
  const feet = { x: 0, y: 0 }
  let phase: KrakenPhase = director.datenkrakeWaits(index) ? 'idle' : 'done'
  if (phase === 'done') zone.setEmpty()
  let phaseMs = 0
  let clock = 0
  let bubble: Phaser.GameObjects.Text | null = null
  let bubbleMs = 0

  const hide = () => {
    bubbleMs = 0
    bubble?.setVisible(false)
  }
  const say = (line: string, ms: number) => {
    bubble ??= acquireBubble(scene).setWordWrapWidth(BUBBLE_WRAP, true).setAlign('center')
    bubble.setText(line).setOrigin(0.5, 1).setPosition(x, top - 4).setVisible(true)
    bubbleMs = ms
  }
  // Points the grabbing tentacle at the mage, stretched to `share` of the way to `chestY`.
  const reach = (share: number, chestY: number) => {
    const fromX = x + GRAB_FROM.x
    const fromY = floorY + GRAB_FROM.y
    const dx = feet.x - fromX
    const dy = chestY - fromY
    const length = Math.max(1, Math.hypot(dx, dy) * share)
    grab.setRotation(Math.atan2(dx, -dy))
    grab.scaleY = (armScaleY * length) / ARM_LENGTH
  }

  return {
    zone,
    action: '',
    auto: true,
    promptX: x,
    promptY: top - 4,
    interact() {
      if (phase !== 'idle') return
      if (!director.datenkrakeHasPrey()) {
        phase = 'done'
        zone.setEmpty()
        say(director.datenkrakeLine('mock'), GOODBYE_MS)
        return
      }
      hide()
      const at = player.position()
      feet.x = at.x
      feet.y = at.y
      phase = 'reach'
      phaseMs = 0
      grab.setVisible(true)
      reach(0, feet.y - CHEST)
      host.hold(true)
    },
    closed() {
      phase = 'release'
      phaseMs = 0
      zone.setEmpty()
      say(director.datenkrakeLine(director.datenkrakeOutcome(index) === 'submitted' ? 'submit' : 'fight'), GOODBYE_MS)
    },
    near() {},
    arrived() {
      if (phase === 'idle') say(director.datenkrakeLine('arrive'), CALL_OUT_MS)
    },
    talking: () => bubbleMs > 0,
    update(dtMs) {
      if (bubbleMs <= 0) return
      bubbleMs -= dtMs
      if (bubbleMs <= 0) hide()
    },
    frame(deltaMs) {
      clock += deltaMs
      for (let i = 0; i < arms.length; i++) {
        arms[i].setRotation(DATENKRAKE_ARMS[i].angle + Math.sin((clock / SWAY_MS) * Math.PI * 2 + i * 1.3) * SWAY)
      }
      if (phase === 'idle' || phase === 'done' || phase === 'held') return
      phaseMs += deltaMs
      if (phase === 'reach') {
        const t = Math.min(1, phaseMs / GRAB_MS)
        reach(ease(t), feet.y - CHEST)
        if (t < 1) return
        phase = 'lift'
        phaseMs = 0
      } else if (phase === 'lift') {
        const t = Math.min(1, phaseMs / LIFT_MS)
        const lift = LIFT * ease(t)
        // A little struggle on the way up. The world is held, so the teleport is all that moves.
        player.teleport(feet.x + Math.sin(phaseMs * 0.06) * 1.5 * (1 - t), feet.y - lift)
        reach(1, feet.y - lift - CHEST)
        if (t < 1) return
        phase = 'held'
        host.openDatenkrake()
        host.hold(false)
      } else if (phase === 'release') {
        // The world runs again, so the mage drops back to the floor while the tentacle pulls back.
        const t = Math.min(1, phaseMs / RELEASE_MS)
        reach(1 - t, feet.y - LIFT - CHEST)
        if (t < 1) return
        phase = 'done'
        grab.setVisible(false)
      }
    },
  }
}

export const ENCOUNTER_SPAWNERS: Record<EncounterKind, EncounterSpawner> = {
  trader: spawnTrader,
  datenkrake: spawnDatenkrake,
}
