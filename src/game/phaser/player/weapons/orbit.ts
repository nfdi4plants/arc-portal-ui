import type Phaser from 'phaser'
import type { ScribbleArt } from '../../../contracts/art'
import { DEPTH } from '../../../contracts/constants'
import type { PlayerHandle } from '../../../contracts/player'

const MAX_DISCS = 2
// Radians per ms, a little over two turns a second.
const SPIN = 0.014

export interface OrbitVisual {
  // Shows `count` discs circling the player until `durationMs` have passed. A second call restarts it.
  show(player: PlayerHandle, durationMs: number, count: number, radius: number): void
}

const visuals = new WeakMap<Phaser.Scene, OrbitVisual>()

// Disc sprites per scene that circle the mage. Like the flame, they are created on first use and
// moved on postupdate, so an orbit creates no objects.
export function orbitVisual(scene: Phaser.Scene, art: ScribbleArt): OrbitVisual {
  const existing = visuals.get(scene)
  if (existing) return existing

  const ref = art.projectile(scene, 'disc')
  const scale = 1 / art.pixelsPerUnit
  const discs = Array.from({ length: MAX_DISCS }, () => {
    const sprite = scene.add.sprite(0, 0, ref.textureKey).setDepth(DEPTH.projectiles).setScale(scale).setVisible(false)
    if (scene.anims.exists(ref.animKey)) sprite.play(ref.animKey)
    return sprite
  })

  let player: PlayerHandle | null = null
  let startAt = 0
  let endAt = 0
  let shown = 0
  let size = 0

  const tick = () => {
    if (!player) return
    const now = scene.time.now
    if (now >= endAt) {
      for (const disc of discs) disc.setVisible(false)
      player = null
      return
    }
    const feet = player.position()
    for (let i = 0; i < shown; i++) {
      const angle = (now - startAt) * SPIN + (i * Math.PI * 2) / shown
      // A flat ellipse reads as a ring around the body in a side view.
      discs[i].setPosition(feet.x + Math.cos(angle) * size, feet.y - 22 + Math.sin(angle) * size * 0.45).setVisible(true)
    }
  }

  const destroy = () => {
    scene.events.off('postupdate', tick)
    for (const disc of discs) disc.destroy()
    visuals.delete(scene)
  }

  scene.events.on('postupdate', tick)
  scene.events.once('shutdown', destroy)

  const visual: OrbitVisual = {
    show(target, durationMs, count, radius) {
      const now = scene.time.now
      player = target
      startAt = now
      endAt = now + durationMs
      shown = Math.min(MAX_DISCS, count)
      size = radius
      for (let i = shown; i < MAX_DISCS; i++) discs[i].setVisible(false)
    },
  }
  visuals.set(scene, visual)
  return visual
}
