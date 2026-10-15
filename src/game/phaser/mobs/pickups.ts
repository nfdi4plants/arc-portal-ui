import type Phaser from 'phaser'
import { DEPTH } from '../../contracts/constants'
import type { PlayerHandle } from '../../contracts/player'
import { applySpriteRef, fragmentArt, shieldFragmentArt } from '../art'

// Shield fragments dropped by component mobs and Ontology Fragments dropped by any mob or boss. They
// bob in place until the player touches one. Ontology Fragments first pop out of the body, and close
// to the player they fly to it.

const GRAB_MARGIN = 6
const BOB_AMPLITUDE = 2.5
const BOB_PERIOD_MS = 1300
// Ontology Fragments of one drop spread this far apart and pop up this high over this time.
const FRAGMENT_SPREAD = 7
const FRAGMENT_POP_HEIGHT = 14
const FRAGMENT_POP_MS = 320
// Within this distance of the body centre a fragment flies to the player, speeding up as it goes.
const MAGNET_RADIUS = 72
const MAGNET_SPEED = 0.12
const MAGNET_ACCEL = 0.0016

interface Pickup {
  sprite: Phaser.GameObjects.Sprite
  baseY: number
  phase: number
}

interface OntologyFragment {
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
  fragments: OntologyFragment[]
  // Fragment records and sprites both come back to the pool, so a drop allocates nothing once warm.
  freeFragments: OntologyFragment[]
}

const states = new WeakMap<Phaser.Scene, PickupState>()

function stateOf(scene: Phaser.Scene): PickupState {
  let state = states.get(scene)
  if (!state) {
    state = { active: [], free: [], fragments: [], freeFragments: [] }
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

// `count` Ontology Fragments around (x, y), spread side by side.
export function dropOntologyFragments(scene: Phaser.Scene, x: number, y: number, count: number): void {
  const state = stateOf(scene)
  for (let i = 0; i < count; i++) {
    let fragment = state.freeFragments.pop()
    if (!fragment) {
      const ref = fragmentArt(scene)
      const sprite = scene.add.sprite(x, y, ref.textureKey).setDepth(DEPTH.pickups)
      applySpriteRef(sprite, ref)
      sprite.setOrigin(0.5, 0.5)
      fragment = { sprite, fromX: 0, toX: 0, baseY: 0, ageMs: 0, speed: 0 }
    }
    fragment.fromX = x
    fragment.toX = x + (i - (count - 1) / 2) * FRAGMENT_SPREAD
    fragment.baseY = y
    fragment.ageMs = 0
    fragment.speed = 0
    fragment.sprite.setPosition(x, y).setActive(true).setVisible(true)
    state.fragments.push(fragment)
  }
}

function touches(box: Phaser.Geom.Rectangle, x: number, y: number): boolean {
  return x > box.x - GRAB_MARGIN && x < box.right + GRAB_MARGIN && y > box.y - GRAB_MARGIN && y < box.bottom + GRAB_MARGIN
}

// Moves the Ontology Fragments and returns how many the player picked up in this step.
function updateFragments(state: PickupState, box: Phaser.Geom.Rectangle, now: number, dtMs: number): number {
  let picked = 0
  let kept = 0
  const cx = box.centerX
  const cy = box.centerY
  for (const fragment of state.fragments) {
    const { sprite } = fragment
    fragment.ageMs += dtMs
    const dx = cx - sprite.x
    const dy = cy - sprite.y
    const distance = Math.hypot(dx, dy)
    if (fragment.speed === 0 && fragment.ageMs >= FRAGMENT_POP_MS && distance < MAGNET_RADIUS) fragment.speed = MAGNET_SPEED
    if (fragment.speed > 0) {
      fragment.speed += MAGNET_ACCEL * dtMs
      const step = Math.min(distance, fragment.speed * dtMs)
      if (distance > 0) sprite.setPosition(sprite.x + (dx / distance) * step, sprite.y + (dy / distance) * step)
    } else if (fragment.ageMs < FRAGMENT_POP_MS) {
      const t = fragment.ageMs / FRAGMENT_POP_MS
      sprite.setPosition(fragment.fromX + (fragment.toX - fragment.fromX) * t, fragment.baseY - Math.sin(t * Math.PI) * FRAGMENT_POP_HEIGHT)
    } else {
      sprite.setPosition(fragment.toX, fragment.baseY + Math.sin((now / BOB_PERIOD_MS) * Math.PI * 2 + fragment.toX) * BOB_AMPLITUDE)
    }
    if (fragment.ageMs >= FRAGMENT_POP_MS && touches(box, sprite.x, sprite.y)) {
      picked++
      sprite.setActive(false).setVisible(false)
      state.freeFragments.push(fragment)
      continue
    }
    state.fragments[kept++] = fragment
  }
  state.fragments.length = kept
  return picked
}

// Returns the Ontology Fragments the player picked up in this step. Shield fragments apply on the player.
export function updatePickups(scene: Phaser.Scene, player: PlayerHandle, dtMs: number): number {
  const state = states.get(scene)
  if (!state) return 0
  const box = player.hurtbox()
  const now = scene.time.now
  const fragments = state.fragments.length > 0 ? updateFragments(state, box, now, dtMs) : 0
  if (state.active.length === 0) return fragments
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
  return fragments
}
