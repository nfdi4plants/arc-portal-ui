import Phaser from 'phaser'
import { PHYSICS_FPS } from '../../contracts/constants'

// The game config every sandbox and the real game share: Arcade physics on a fixed 120 Hz step,
// no world gravity (bodies set their own), canvas sized by the caller.
export function baseGameConfig(parent: HTMLElement, scenes: Phaser.Types.Scenes.SceneType[]): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    parent,
    width: Math.max(1, parent.clientWidth),
    height: Math.max(1, parent.clientHeight),
    backgroundColor: '#f6f1e7',
    scale: { mode: Phaser.Scale.NONE },
    physics: {
      default: 'arcade',
      // useTree off: the dynamic body tree is rebuilt every step (about 2 MB/s of garbage) and only
      // pays off with many dynamic bodies colliding with each other, which the game never does.
      arcade: { gravity: { x: 0, y: 0 }, fps: PHYSICS_FPS, fixedStep: true, debug: false, useTree: false },
    },
    input: { mouse: { preventDefaultWheel: false }, keyboard: false },
    // Below 30 fps the game slows down instead of running many catch-up physics steps per frame,
    // which would make a slow PC slower still.
    // No fps.limit: in Phaser 4.2.1 the limited step passes the accumulated delta and then keeps the
    // remainder, so the leftover time is counted twice and the simulation runs too fast.
    fps: { min: 30 },
    disableContextMenu: true,
    scene: scenes,
  }
}

// Boots a game with the given scenes inside `parent` and keeps it sized to the parent.
export function bootSandbox(parent: HTMLElement, scenes: Phaser.Types.Scenes.SceneType[]): () => void {
  const game = new Phaser.Game(baseGameConfig(parent, scenes))
  const observer = new ResizeObserver(() => {
    game.scale.resize(Math.max(1, parent.clientWidth), Math.max(1, parent.clientHeight))
  })
  observer.observe(parent)
  return () => {
    observer.disconnect()
    game.destroy(true)
  }
}
