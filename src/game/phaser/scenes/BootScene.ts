import Phaser from 'phaser'
import { SCENE } from '../../contracts/constants'
import { preloadCoreAssets } from '../assets'

// Loads the shared assets once and reports that the game can take commands.
export class BootScene extends Phaser.Scene {
  private readonly onReady: () => void

  constructor(onReady: () => void) {
    super(SCENE.boot)
    this.onReady = onReady
  }

  preload() {
    preloadCoreAssets(this)
  }

  create() {
    // The canvas needs a tab index to take keyboard focus.
    this.game.canvas.tabIndex = 0
    this.game.canvas.style.outline = 'none'
    this.onReady()
  }
}
