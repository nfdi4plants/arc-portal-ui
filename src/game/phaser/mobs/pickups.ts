import type Phaser from 'phaser'
import { DEPTH, PALETTE } from '../../contracts/constants'
import type { PlayerHandle } from '../../contracts/player'

// Shield fragments dropped by component mobs. They bob in place until the player touches one.

const TEXTURE = 'mob:shieldFragment'
const WIDTH = 14
const HEIGHT = 16
const GRAB_MARGIN = 6
const BOB_AMPLITUDE = 2.5
const BOB_PERIOD_MS = 1300

interface Pickup {
  sprite: Phaser.GameObjects.Image
  baseY: number
  phase: number
}

interface PickupState {
  active: Pickup[]
  free: Phaser.GameObjects.Image[]
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

// A small shield drawn once. Textures belong to the game, so later scenes find it ready.
function ensureTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(TEXTURE)) return
  const g = scene.make.graphics({ x: 0, y: 0 }, false)
  g.fillStyle(PALETTE.blue, 1)
  g.fillRect(1, 1, WIDTH - 2, 8)
  g.fillTriangle(1, 9, WIDTH - 1, 9, WIDTH / 2, HEIGHT - 1)
  g.fillStyle(PALETTE.cream, 1)
  g.fillRect(4, 3, 3, 3)
  g.lineStyle(1.5, PALETTE.outline, 1)
  g.strokeRect(1, 1, WIDTH - 2, 8)
  g.strokeTriangle(1, 9, WIDTH - 1, 9, WIDTH / 2, HEIGHT - 1)
  g.generateTexture(TEXTURE, WIDTH, HEIGHT)
  g.destroy()
}

export function dropShieldFragment(scene: Phaser.Scene, x: number, y: number): void {
  ensureTexture(scene)
  const state = stateOf(scene)
  const sprite = state.free.pop() ?? scene.add.image(x, y, TEXTURE).setDepth(DEPTH.pickups)
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
