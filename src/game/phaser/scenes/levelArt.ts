import type Phaser from 'phaser'
import type { ScribbleArt } from '../../contracts/art'
import { DEPTH, WORLD_VIEW_HEIGHT } from '../../contracts/constants'
import type { View } from '../view'

const PARALLAX_FACTORS = [0.15, 0.35, 0.6]

// One TileSprite per rectangle, however many tiles it spans: one quad on the GPU.
export function addTiles(
  scene: Phaser.Scene,
  art: ScribbleArt,
  key: string,
  x: number,
  y: number,
  width: number,
  height: number,
): Phaser.GameObjects.TileSprite {
  const scale = 1 / art.pixelsPerUnit
  return scene.add.tileSprite(x, y, width, height, key).setOrigin(0, 0).setTileScale(scale, scale).setDepth(DEPTH.tiles)
}

export interface Parallax {
  layout(view: View): void
}

// Three background layers that follow the camera horizontally at a fraction of its speed and stay
// fixed vertically, bottom aligned with the view. Call layout() whenever the view changes.
export function addParallax(scene: Phaser.Scene, art: ScribbleArt, keys: string[], left: number, right: number): Parallax {
  const scale = 1 / art.pixelsPerUnit
  const layers = PARALLAX_FACTORS.map((factor, i) => {
    const key = keys[Math.min(i, keys.length - 1)]
    return scene.add
      .tileSprite(0, 0, 1, 1, key)
      .setOrigin(0, 0)
      .setScrollFactor(factor, 0)
      .setTileScale(scale, scale)
      .setDepth(DEPTH.background + i)
      .setAlpha(i < keys.length ? 1 : 0.3)
  })
  return {
    layout(view) {
      // The camera zooms around the centre of its viewport, so a layer with scroll factor f shows
      // f * scrollX + (camera width - view width) / 2 at the left edge of the view.
      const camera = scene.cameras.main
      const centre = (camera.width - view.width) / 2
      const minScroll = left - centre
      const maxScroll = Math.max(minScroll, right - view.width - centre)
      const top = camera.height / 2 + view.height / 2 - WORLD_VIEW_HEIGHT
      for (let i = 0; i < layers.length; i++) {
        const f = PARALLAX_FACTORS[i]
        const from = f * minScroll + centre - 24
        const to = f * maxScroll + centre + view.width + 24
        layers[i].setPosition(from, top).setSize(to - from, WORLD_VIEW_HEIGHT)
      }
    },
  }
}
