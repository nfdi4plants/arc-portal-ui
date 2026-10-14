import Phaser from 'phaser'
import { baseGameConfig } from '../config'

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
