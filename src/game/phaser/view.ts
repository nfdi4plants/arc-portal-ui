import type Phaser from 'phaser'
import { WORLD_MAX_ASPECT, WORLD_MIN_VIEW_WIDTH, WORLD_VIEW_HEIGHT } from '../contracts/constants'

export interface View {
  // Camera zoom: canvas pixels per world unit.
  zoom: number
  // Visible world size.
  width: number
  height: number
}

// The camera always shows WORLD_VIEW_HEIGHT world units vertically. Narrow boxes zoom out until
// WORLD_MIN_VIEW_WIDTH units fit, so portrait boxes show more height. Boxes wider than
// WORLD_MAX_ASPECT show no extra width: the scene draws bars on the sides.
export function viewForBox(boxWidth: number, boxHeight: number): View {
  const width = Math.max(1, boxWidth)
  const height = Math.max(1, boxHeight)
  const zoom = Math.min(height / WORLD_VIEW_HEIGHT, width / WORLD_MIN_VIEW_WIDTH)
  const visibleWidth = Math.min(width / zoom, WORLD_VIEW_HEIGHT * WORLD_MAX_ASPECT)
  return { zoom, width: visibleWidth, height: height / zoom }
}

// Keeps the main camera's zoom and viewport in step with the canvas size. Call from a scene's
// create(). The listener is removed when the scene shuts down.
export function followView(scene: Phaser.Scene, onChange?: (view: View) => void): void {
  const apply = () => {
    const { width, height } = scene.scale.gameSize
    const view = viewForBox(width, height)
    const camera = scene.cameras.main
    const viewportWidth = Math.min(width, view.width * view.zoom)
    camera.setViewport((width - viewportWidth) / 2, 0, viewportWidth, height)
    camera.setZoom(view.zoom)
    onChange?.(view)
  }
  apply()
  scene.scale.on('resize', apply)
  scene.events.once('shutdown', () => scene.scale.off('resize', apply))
}
