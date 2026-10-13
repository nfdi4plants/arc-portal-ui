import type Phaser from 'phaser'
import { DEPTH } from '../../contracts/constants'
import type { PlayerHandle } from '../../contracts/player'
import { applySpriteRef, shieldFragmentArt } from '../art'

// Shield fragments dropped by component mobs. They bob in place until the player touches one.

const GRAB_MARGIN = 6
const BOB_AMPLITUDE = 2.5
const BOB_PERIOD_MS = 1300

interface Pickup {
  sprite: Phaser.GameObjects.Sprite
  baseY: number
  phase: number
}

interface PickupState {
  active: Pickup[]
  free: Phaser.GameObjects.Sprite[]
}

const states = new WeakMap<Phaser.Scene, PickupState>()

function stateOf(scene: Phaser.Scene): PickupState {
  let state = states.get(scene)
  if (!state) {
    state = { active: [], free: [] }
    states.set(scene, state)
    // A restarted scene keeps its Scene object but loses its sprites.
    scene.events.once('shutdown', () => states.delete(scene))
  }
  return state
}

export function dropShieldFragment(scene: Phaser.Scene, x: number, y: number): void {
  const state = stateOf(scene)
  let sprite = state.free.pop()
  if (!sprite) {
    const ref = shieldFragmentArt(scene)
    sprite = scene.add.sprite(x, y, ref.textureKey).setDepth(DEPTH.pickups)
    applySpriteRef(sprite, ref)
    // The pickup bobs around its centre, not its feet.
    sprite.setOrigin(0.5, 0.5)
  }
  sprite.setPosition(x, y).setActive(true).setVisible(true)
  state.active.push({ sprite, baseY: y, phase: x })
}

export function updatePickups(scene: Phaser.Scene, player: PlayerHandle): void {
  const state = states.get(scene)
  if (!state || state.active.length === 0) return
  const box = player.hurtbox()
  const now = scene.time.now
  let kept = 0
  for (const pickup of state.active) {
    const { sprite } = pickup
    const grabbed =
      sprite.x > box.x - GRAB_MARGIN && sprite.x < box.right + GRAB_MARGIN && sprite.y > box.y - GRAB_MARGIN && sprite.y < box.bottom + GRAB_MARGIN
    if (grabbed) {
      player.grantShield()
      sprite.setActive(false).setVisible(false)
      state.free.push(sprite)
      continue
    }
    sprite.y = pickup.baseY + Math.sin((now / BOB_PERIOD_MS) * Math.PI * 2 + pickup.phase) * BOB_AMPLITUDE
    state.active[kept++] = pickup
  }
  state.active.length = kept
}
