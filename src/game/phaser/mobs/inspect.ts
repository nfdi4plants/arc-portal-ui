import type Phaser from 'phaser'
import { PALETTE } from '../../contracts/constants'
import { cssColor } from '../color'
import { INSPECT_DIM_DEPTH } from './tuning'
import type { Mob } from './types'

// Pause-time inspection of mobs: hover highlights one and shows its name, a click picks it. The
// mobs are interactive only while the scene says so, so play pays nothing for hover tests.

const mobBySprite = new WeakMap<Phaser.GameObjects.GameObject, Mob>()
const PULSE_STEPS = 6
const PULSE_MS = 700
const TAG_GAP = 4
const TAG_MARGIN = 2

export function registerInspectable(sprite: Phaser.GameObjects.GameObject, mob: Mob): void {
  mobBySprite.set(sprite, mob)
}

export interface Inspector {
  // Turns hover and click on or off for these mobs. Turning off clears the highlight and the tag.
  setActive(active: boolean, mobs: readonly Mob[]): void
  // The mob whose info panel is open stays bright. Null clears it.
  select(mob: Mob | null): void
  // Once per frame while active.
  update(timeMs: number): void
  destroy(): void
}

// `onPick` gets the clicked mob, or null for a click on empty world.
export function createInspector(scene: Phaser.Scene, onPick: (mob: Mob | null) => void): Inspector {
  let active = false
  let hovered: Mob | null = null
  let tag: Phaser.GameObjects.Text | null = null
  let shown: Mob[] = []
  let selected: Mob | null = null
  let step = -1

  function ensureTag(): Phaser.GameObjects.Text {
    tag ??= scene.add
      .text(0, 0, '', {
        fontFamily: 'sans-serif',
        fontSize: '7px',
        fontStyle: 'bold',
        color: cssColor(PALETTE.outline),
        backgroundColor: cssColor(PALETTE.cream),
        padding: { x: 3, y: 2 },
      })
      .setOrigin(0.5, 1)
      .setDepth(INSPECT_DIM_DEPTH + 2)
      .setVisible(false)
      .setResolution(Math.max(2, Math.ceil(scene.cameras.main.zoom)))
    return tag
  }

  function setHover(mob: Mob | null) {
    if (mob === hovered) return
    const old = hovered
    old?.setHighlight(0)
    hovered = mob
    if (old && old !== selected) old.setRaised(false)
    mob?.setRaised(true)
    step = -1
    if (!mob) {
      tag?.setVisible(false)
      return
    }
    ensureTag().setText(mob.spec.label).setVisible(true)
    place()
  }

  // Above the mob's head, kept inside the camera view.
  function place() {
    if (!hovered || !tag) return
    const box = hovered.hurtbox()
    const view = scene.cameras.main.worldView
    const half = tag.width / 2
    const x = Math.min(view.right - half - TAG_MARGIN, Math.max(view.x + half + TAG_MARGIN, box.centerX))
    const y = Math.max(view.y + tag.height + TAG_MARGIN, box.y - TAG_GAP)
    tag.setPosition(x, y)
  }

  const onOver = (_pointer: Phaser.Input.Pointer, object: Phaser.GameObjects.GameObject) => {
    if (active) setHover(mobBySprite.get(object) ?? null)
  }
  const onOut = (_pointer: Phaser.Input.Pointer, object: Phaser.GameObjects.GameObject) => {
    if (active && mobBySprite.get(object) === hovered) setHover(null)
  }
  const onDown = (_pointer: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
    if (!active) return
    const mob = over.length > 0 ? (mobBySprite.get(over[0]) ?? null) : null
    onPick(mob)
  }
  scene.input.on('gameobjectover', onOver)
  scene.input.on('gameobjectout', onOut)
  scene.input.on('pointerdown', onDown)

  return {
    select(mob) {
      if (mob === selected) return
      const old = selected
      selected = mob
      if (old && old !== hovered) old.setRaised(false)
      mob?.setRaised(true)
    },
    setActive(next, mobs) {
      active = next
      if (!next) {
        selected?.setRaised(false)
        selected = null
      }
      for (const old of shown) old.setInspectable(false)
      shown = next ? [...mobs] : []
      for (const mob of shown) mob.setInspectable(true)
      if (!next) setHover(null)
    },
    update(timeMs) {
      if (!active || !hovered) return
      const next = Math.round(((Math.sin(timeMs / PULSE_MS * Math.PI * 2) + 1) / 2) * PULSE_STEPS)
      if (next !== step) {
        step = next
        hovered.setHighlight(Math.max(0.05, next / PULSE_STEPS))
      }
      place()
    },
    destroy() {
      scene.input.off('gameobjectover', onOver)
      scene.input.off('gameobjectout', onOut)
      scene.input.off('pointerdown', onDown)
      tag?.destroy()
      tag = null
    },
  }
}
