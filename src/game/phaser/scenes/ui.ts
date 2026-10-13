import Phaser from 'phaser'
import { PALETTE } from '../../contracts/constants'
import { cssColor } from '../color'
import { followView, type View } from '../view'

export { plural } from './plural'

export const UI_FONT = 'sans-serif'

// Text is rasterised at the camera zoom, so it stays sharp when the camera scales it up.
function textResolution(scene: Phaser.Scene): number {
  return Math.min(4, Math.max(1, Math.ceil(scene.cameras.main.zoom)))
}

// Camera of an overlay scene. (0, 0) is the top left of the visible game area and sizes are world
// units, the same as in the gameplay scenes, so the overlays scale with the box.
export function overlayView(scene: Phaser.Scene, layout: (view: View) => void): void {
  followView(scene, (view) => {
    scene.cameras.main.centerOn(view.width / 2, view.height / 2)
    const resolution = textResolution(scene)
    for (const child of scene.children.list) {
      if (child instanceof Phaser.GameObjects.Text && child.style.resolution !== resolution) child.setResolution(resolution)
    }
    layout(view)
  })
}

export function addText(
  scene: Phaser.Scene,
  text: string,
  size: number,
  options: { color?: number; bold?: boolean; align?: 'left' | 'center' | 'right'; wrap?: number } = {},
): Phaser.GameObjects.Text {
  return scene.add
    .text(0, 0, text, {
      fontFamily: UI_FONT,
      fontSize: `${size}px`,
      fontStyle: options.bold ? 'bold' : 'normal',
      color: cssColor(options.color ?? PALETTE.cream),
      align: options.align ?? 'left',
      wordWrap: options.wrap ? { width: options.wrap, useAdvancedWrap: true } : undefined,
      resolution: textResolution(scene),
    })
}

export interface Button {
  setPosition(x: number, y: number): void
  setVisible(visible: boolean): void
}

// Phaser emits pointerup on whatever lies under the pointer at release, wherever the press began.
// A press that is still held when a screen opens (the attack button, say) would choose whatever it
// is released over. The target acts on a release only after a pointerdown on itself, and loses
// that arming when the pointer leaves it or is released anywhere else.
export function onClick(scene: Phaser.Scene, target: Phaser.GameObjects.GameObject, handler: () => void): void {
  let armed = false
  const disarm = () => {
    armed = false
  }
  target.on('pointerdown', () => {
    armed = true
  })
  target.on('pointerout', disarm)
  target.on('pointerup', () => {
    if (!armed) return
    armed = false
    handler()
  })
  // Phaser emits the scene-wide pointerup after the target's own. A release over another target or
  // outside the canvas clears the arming here.
  scene.input.on('pointerup', disarm)
  scene.input.on('pointerupoutside', disarm)
}

// A labelled box. It acts on release after its own press (see onClick).
export function addButton(scene: Phaser.Scene, label: string, width: number, height: number, onPress: () => void): Button {
  const box = scene.add.rectangle(0, 0, width, height, PALETTE.navy).setStrokeStyle(1, PALETTE.cream)
  const text = addText(scene, label, Math.round(height * 0.45), { bold: true }).setOrigin(0.5)
  box.setInteractive({ useHandCursor: true })
  box.on('pointerover', () => box.setFillStyle(PALETTE.blue))
  box.on('pointerout', () => box.setFillStyle(PALETTE.navy))
  onClick(scene, box, onPress)
  return {
    setPosition(x, y) {
      box.setPosition(x, y)
      text.setPosition(x, y)
    },
    setVisible(visible) {
      box.setVisible(visible)
      text.setVisible(visible)
      if (visible) box.setInteractive({ useHandCursor: true })
      else box.disableInteractive()
    },
  }
}

// Phaser's keyboard plugin is off, so overlay keys come from the canvas, which has focus.
export function onCanvasKey(scene: Phaser.Scene, handler: (code: string) => void): void {
  const canvas = scene.game.canvas
  const listener = (event: KeyboardEvent) => {
    if (!event.repeat) handler(event.code)
  }
  canvas.addEventListener('keydown', listener)
  scene.events.once('shutdown', () => canvas.removeEventListener('keydown', listener))
}
