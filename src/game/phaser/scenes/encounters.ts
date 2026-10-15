import Phaser from 'phaser'
import { DEPTH, TILE } from '../../contracts/constants'
import type { EncounterKind } from '../../model/run'
import { applySpriteRef, TRADER_HEIGHT, TRADER_WIDTH, traderArt } from '../art'
import { acquireBubble } from '../mobs/bubbles'
import type { RunDirector } from './RunDirector'

// The encounters of the waystation. Each kind of `model/run/encounters.ts` has a spawner here that
// puts it on the floor at the x of its slot. The waystation scene shows the interaction prompt and
// calls interact() when the player presses up within reach.

// The player interacts from up to this far beyond either side of an encounter.
const REACH = TILE / 2
const GOODBYE_MS = 3800
const CALL_OUT_MS = 3200
const BUBBLE_WRAP = 150

// What the waystation offers its encounters.
export interface EncounterHost {
  readonly scene: Phaser.Scene
  readonly director: RunDirector
  readonly floorY: number
  // Holds the world and opens the FAIR trade store of this waystation.
  openStore(): void
}

export interface Encounter {
  // Where the player can interact. Empty for an encounter without an interaction.
  readonly zone: Phaser.Geom.Rectangle
  // The word of the prompt after the key, for example "Trade".
  readonly action: string
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

export const ENCOUNTER_SPAWNERS: Record<EncounterKind, EncounterSpawner> = {
  trader: spawnTrader,
}
