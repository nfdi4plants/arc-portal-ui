import Phaser from 'phaser'
import { MAGE_FRAME, MAGE_TEXTURE, PALETTE, SCENE } from '../contracts/constants'
import type { CreateGame } from '../contracts/events'
import type { Bindings } from '../contracts/input'
import type { RunPlan } from '../contracts/run'
import { preloadCoreAssets } from './assets'
import { baseGameConfig } from './dev/bootSandbox'
import { createGameHandle, createLoopPause } from './gameHandle'
import { followView } from './view'

// Height of the mage in world units. Large enough to read on a phone-sized canvas.
const MAGE_DISPLAY_HEIGHT = 120

// The only scene of the stub. Part J replaces it with the real scene list.
class PlaceholderScene extends Phaser.Scene {
  // The input layer of Part J reads these. The stub only keeps them.
  bindings: Bindings
  private readonly onCreated: () => void
  private banner: Phaser.GameObjects.Text | null = null

  constructor(bindings: Bindings, onCreated: () => void) {
    super(SCENE.boot)
    this.bindings = bindings
    this.onCreated = onCreated
  }

  preload() {
    preloadCoreAssets(this)
  }

  create() {
    // The canvas needs a tab index to take keyboard focus.
    this.game.canvas.tabIndex = 0
    this.game.canvas.style.outline = 'none'

    followView(this, () => this.cameras.main.centerOn(0, 0))

    const mage = this.add.image(0, -20, MAGE_TEXTURE, MAGE_FRAME)
    mage.setScale(MAGE_DISPLAY_HEIGHT / mage.height)
    this.banner = this.add
      .text(0, 60, '', {
        fontFamily: 'sans-serif',
        fontSize: '12px',
        color: `#${PALETTE.navy.toString(16)}`,
        align: 'center',
        wordWrap: { width: 440 },
      })
      .setOrigin(0.5, 0)

    this.onCreated()
  }

  showRun(plan: RunPlan) {
    const first = plan.nodes[0]
    const last = plan.nodes[plan.nodes.length - 1]
    this.banner?.setText(`Run started: ${first?.id ?? ''} to ${last?.id ?? ''}`)
  }
}

export const createGame: CreateGame = (parent, { bindings }) => {
  const scene = new PlaceholderScene(bindings, () => control.ready())
  const game = new Phaser.Game(baseGameConfig(parent, [scene]))
  const loopPause = createLoopPause(game)
  const control = createGameHandle({
    command(command) {
      switch (command.type) {
        case 'start':
          scene.showRun(command.plan)
          control.emit({ type: 'runStarted', plan: command.plan })
          break
        case 'pause':
          loopPause.setPaused(command.paused)
          control.emit({ type: 'paused', paused: command.paused })
          break
        case 'setBindings':
          scene.bindings = command.bindings
          break
        case 'quitToMenu':
          control.emit({ type: 'menuRequested', choice: 'menu' })
          break
      }
    },
    resize: (width, height) => {
      game.scale.resize(Math.max(1, width), Math.max(1, height))
      loopPause.drawOnce()
    },
    focus: () => game.canvas?.focus(),
    destroy: () => {
      loopPause.setPaused(false)
      game.destroy(true)
    },
  })
  return control.handle
}
