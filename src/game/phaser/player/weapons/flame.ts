import type Phaser from 'phaser'
import type { ScribbleArt } from '../../../contracts/art'
import { DEPTH } from '../../../contracts/constants'
import type { PlayerHandle } from '../../../contracts/player'

const PUFFS = 8
// One puff crosses the cone in this time. The puffs are spread evenly over the cycle.
const CYCLE_MS = 220

export interface FlameVisual {
  // Shows the cone in front of the player until `durationMs` have passed. A second call extends it.
  show(player: PlayerHandle, durationMs: number, length: number): void
}

const visuals = new WeakMap<Phaser.Scene, FlameVisual>()

// A fixed set of flame sprites per scene that stream out of the staff. The sprites are created
// on the first flame and moved on the scene's postupdate, so no object is created per cone.
export function flameVisual(scene: Phaser.Scene, art: ScribbleArt): FlameVisual {
  const existing = visuals.get(scene)
  if (existing) return existing

  const ref = art.projectile(scene, 'flame')
  const scale = 1 / art.pixelsPerUnit
  const puffs = Array.from({ length: PUFFS }, () => {
    const sprite = scene.add.sprite(0, 0, ref.textureKey).setDepth(DEPTH.projectiles).setScale(scale).setVisible(false)
    if (scene.anims.exists(ref.animKey)) sprite.play(ref.animKey)
    return sprite
  })

  let player: PlayerHandle | null = null
  let startAt = 0
  let endAt = 0
  let length = 0

  const hideAll = () => {
    for (const puff of puffs) puff.setVisible(false)
    player = null
  }

  const tick = () => {
    if (!player) return
    const now = scene.time.now
    const left = endAt - now
    if (left <= 0) {
      hideAll()
      return
    }
    const feet = player.position()
    const dir = player.facing()
    const fade = Math.min(1, left / 120)
    for (let i = 0; i < PUFFS; i++) {
      const t = ((now - startAt) / CYCLE_MS + i / PUFFS) % 1
      const row = (i % 3) - 1
      puffs[i]
        .setPosition(feet.x + dir * (10 + t * length), feet.y - 24 + row * t * length * 0.2)
        .setScale(scale * (0.6 + t * 1.2))
        .setRotation(dir * (Math.PI / 2))
        .setAlpha(fade * (1 - t * 0.8))
        .setVisible(true)
    }
  }

  const destroy = () => {
    scene.events.off('postupdate', tick)
    for (const puff of puffs) puff.destroy()
    visuals.delete(scene)
  }

  scene.events.on('postupdate', tick)
  scene.events.once('shutdown', destroy)

  const visual: FlameVisual = {
    show(target, durationMs, reach) {
      const now = scene.time.now
      if (!player) startAt = now
      player = target
      endAt = now + durationMs
      length = reach
    },
  }
  visuals.set(scene, visual)
  return visual
}
