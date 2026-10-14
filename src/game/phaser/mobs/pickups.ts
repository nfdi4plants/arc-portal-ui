import type Phaser from 'phaser'
import { DEPTH } from '../../contracts/constants'
import type { PlayerHandle } from '../../contracts/player'
import { applySpriteRef, coinArt, shieldFragmentArt } from '../art'

// Shield fragments dropped by component mobs and coins dropped by any mob or boss. They bob in place
// until the player touches one. Coins first pop out of the body, and close to the player they fly
// to it.

const GRAB_MARGIN = 6
const BOB_AMPLITUDE = 2.5
const BOB_PERIOD_MS = 1300
// Coins of one drop spread this far apart and pop up this high over this time.
const COIN_SPREAD = 7
const COIN_POP_HEIGHT = 14
const COIN_POP_MS = 320
// Within this distance of the body centre a coin flies to the player, speeding up as it goes.
const MAGNET_RADIUS = 72
const MAGNET_SPEED = 0.12
const MAGNET_ACCEL = 0.0016

interface Pickup {
  sprite: Phaser.GameObjects.Sprite
  baseY: number
  phase: number
}

interface Coin {
  sprite: Phaser.GameObjects.Sprite
  // Pop from (fromX, baseY) to (toX, baseY), then bob around baseY.
  fromX: number
  toX: number
  baseY: number
  ageMs: number
  // World units per ms once the magnet has it, 0 before.
  speed: number
}

interface PickupState {
  active: Pickup[]
  free: Phaser.GameObjects.Sprite[]
  coins: Coin[]
  // Coin records and sprites both come back to the pool, so a drop allocates nothing once warm.
  freeCoins: Coin[]
}

const states = new WeakMap<Phaser.Scene, PickupState>()

function stateOf(scene: Phaser.Scene): PickupState {
  let state = states.get(scene)
  if (!state) {
    state = { active: [], free: [], coins: [], freeCoins: [] }
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

// `count` coins around (x, y), spread side by side.
export function dropCoins(scene: Phaser.Scene, x: number, y: number, count: number): void {
  const state = stateOf(scene)
  for (let i = 0; i < count; i++) {
    let coin = state.freeCoins.pop()
    if (!coin) {
      const ref = coinArt(scene)
      const sprite = scene.add.sprite(x, y, ref.textureKey).setDepth(DEPTH.pickups)
      applySpriteRef(sprite, ref)
      sprite.setOrigin(0.5, 0.5)
      coin = { sprite, fromX: 0, toX: 0, baseY: 0, ageMs: 0, speed: 0 }
    }
    coin.fromX = x
    coin.toX = x + (i - (count - 1) / 2) * COIN_SPREAD
    coin.baseY = y
    coin.ageMs = 0
    coin.speed = 0
    coin.sprite.setPosition(x, y).setActive(true).setVisible(true)
    state.coins.push(coin)
  }
}

function touches(box: Phaser.Geom.Rectangle, x: number, y: number): boolean {
  return x > box.x - GRAB_MARGIN && x < box.right + GRAB_MARGIN && y > box.y - GRAB_MARGIN && y < box.bottom + GRAB_MARGIN
}

// Moves the coins and returns how many the player picked up in this step.
function updateCoins(state: PickupState, box: Phaser.Geom.Rectangle, now: number, dtMs: number): number {
  let picked = 0
  let kept = 0
  const cx = box.centerX
  const cy = box.centerY
  for (const coin of state.coins) {
    const { sprite } = coin
    coin.ageMs += dtMs
    const dx = cx - sprite.x
    const dy = cy - sprite.y
    const distance = Math.hypot(dx, dy)
    if (coin.speed === 0 && coin.ageMs >= COIN_POP_MS && distance < MAGNET_RADIUS) coin.speed = MAGNET_SPEED
    if (coin.speed > 0) {
      coin.speed += MAGNET_ACCEL * dtMs
      const step = Math.min(distance, coin.speed * dtMs)
      if (distance > 0) sprite.setPosition(sprite.x + (dx / distance) * step, sprite.y + (dy / distance) * step)
    } else if (coin.ageMs < COIN_POP_MS) {
      const t = coin.ageMs / COIN_POP_MS
      sprite.setPosition(coin.fromX + (coin.toX - coin.fromX) * t, coin.baseY - Math.sin(t * Math.PI) * COIN_POP_HEIGHT)
    } else {
      sprite.setPosition(coin.toX, coin.baseY + Math.sin((now / BOB_PERIOD_MS) * Math.PI * 2 + coin.toX) * BOB_AMPLITUDE)
    }
    if (coin.ageMs >= COIN_POP_MS && touches(box, sprite.x, sprite.y)) {
      picked++
      sprite.setActive(false).setVisible(false)
      state.freeCoins.push(coin)
      continue
    }
    state.coins[kept++] = coin
  }
  state.coins.length = kept
  return picked
}

// Returns the coins the player picked up in this step. Shield fragments apply on the player.
export function updatePickups(scene: Phaser.Scene, player: PlayerHandle, dtMs: number): number {
  const state = states.get(scene)
  if (!state) return 0
  const box = player.hurtbox()
  const now = scene.time.now
  const coins = state.coins.length > 0 ? updateCoins(state, box, now, dtMs) : 0
  if (state.active.length === 0) return coins
  let kept = 0
  for (const pickup of state.active) {
    const { sprite } = pickup
    if (touches(box, sprite.x, sprite.y)) {
      player.grantShield()
      sprite.setActive(false).setVisible(false)
      state.free.push(sprite)
      continue
    }
    sprite.y = pickup.baseY + Math.sin((now / BOB_PERIOD_MS) * Math.PI * 2 + pickup.phase) * BOB_AMPLITUDE
    state.active[kept++] = pickup
  }
  state.active.length = kept
  return coins
}
