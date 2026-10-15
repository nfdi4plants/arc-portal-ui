import type Phaser from 'phaser'
import { DEPTH, TILE } from '../../contracts/constants'
import { ARM_LENGTH, applySpriteRef, bridgePlankArt, datenkrakeArmArt, krakenInternArt, PLANK_HEIGHT, PLANK_WIDTH } from '../art'
import { acquireBubble } from '../mobs/bubbles'
import { markOneWay, PLAYER_HURTBOX, type Player } from '../player/Player'
import { internBridges, internSteps, stepAt, type Bridge, type Step } from './internPlan'
import type { StretchLayout } from './levelGen'
import type { RunDirector } from './RunDirector'

// The kraken intern of Deprecated jump(): a small kraken in a hard hat that follows a mage who
// cannot jump through a stretch. It runs ahead to every hole on the way and builds a plank bridge
// over it, piece by piece, while a barrier at both ends keeps the mage from walking into the hole
// before it is done. At a wall where the ground goes up it reaches out a tentacle and hoists the
// mage over it. It has no hitbox and takes no part in the fight. Only the crossings of
// internPlan.ts get help, platforms get none.

// The intern starts a bridge when the mage comes this close to either end of the hole.
const BUILD_AHEAD = 6 * TILE
const BUILD_MS = 900
// Lift timeline: the tentacle reaches, the mage rises clear of the wall, then moves over it.
const LIFT_MS = 760
const REACH_SHARE = 0.25
const RISE_SHARE = 0.45
const LIFT_CLEARANCE = 6
const BUBBLE_MS = 2200
const BUBBLE_WRAP = 130
const FOLLOW_BEHIND = 20
const BARRIER_W = 3
const BARRIER_H = 3 * TILE

interface BridgeState {
  plan: Bridge
  state: 'waiting' | 'building' | 'built'
  ms: number
  planks: Phaser.GameObjects.Sprite[]
  // Colliders and bodies to remove once the bridge stands.
  barriers: (() => void)[]
}

interface Lift {
  step: Step
  ms: number
  fromX: number
  toX: number
}

export interface KrakenIntern {
  // Once per world step. `dir` is the direction the player holds, 0 for none. True while it holds
  // the mage in a lift, so the scene skips the rest of its step.
  step(dtMs: number, dir: -1 | 0 | 1): boolean
  // Once per rendered frame: the intern's walk, its tentacle and its bubble.
  frame(deltaMs: number): void
}

const smooth = (t: number) => t * t * (3 - 2 * t)

export function createKrakenIntern(scene: Phaser.Scene, player: Player, layout: StretchLayout, director: RunDirector): KrakenIntern {
  const bridges: BridgeState[] = internBridges(layout.grounds).map((plan) => ({ plan, state: 'waiting', ms: 0, planks: [], barriers: [] }))
  const steps = internSteps(layout.grounds)
  const half = PLAYER_HURTBOX.width / 2
  const ref = krakenInternArt(scene)
  const plankRef = bridgePlankArt(scene)
  const armRef = datenkrakeArmArt(scene)
  const box0 = player.hurtbox()
  const intern = scene.add.sprite(box0.centerX - FOLLOW_BEHIND, box0.bottom, ref.textureKey).setDepth(DEPTH.player - 2)
  applySpriteRef(intern, ref)
  const arm = scene.add.sprite(0, 0, armRef.textureKey).setDepth(DEPTH.player + 1)
  applySpriteRef(arm, armRef)
  arm.setVisible(false)
  const armScaleY = arm.scaleY
  let bubble: Phaser.GameObjects.Text | null = null
  let bubbleMs = 0
  let lift: Lift | null = null
  let building: BridgeState | null = null
  let clock = 0

  const say = (line: string) => {
    bubble ??= acquireBubble(scene).setWordWrapWidth(BUBBLE_WRAP, true).setAlign('center')
    bubble.setText(line).setVisible(true)
    bubbleMs = BUBBLE_MS
  }

  const wall = (x: number, top: number): (() => void) => {
    const body = scene.physics.add.staticBody(x, top - BARRIER_H, BARRIER_W, BARRIER_H)
    const remove = player.collideWith(body)
    return () => {
      remove()
      body.destroy()
    }
  }

  const startBridge = (bridge: BridgeState) => {
    const { x, w, top } = bridge.plan
    bridge.state = 'building'
    bridge.ms = 0
    bridge.barriers.push(wall(x, top), wall(x + w - BARRIER_W, top))
    const count = Math.ceil(w / PLANK_WIDTH)
    for (let i = 0; i < count; i++) {
      const plank = scene.add.sprite(x + (i + 0.5) * (w / count), top + PLANK_HEIGHT, plankRef.textureKey).setDepth(DEPTH.tiles + 1)
      applySpriteRef(plank, plankRef)
      plank.setDisplaySize(w / count + 1, PLANK_HEIGHT).setVisible(false)
      bridge.planks.push(plank)
    }
    building = bridge
    say(director.datenkrakeLine('bridge'))
  }

  const finishBridge = (bridge: BridgeState) => {
    const { x, w, top } = bridge.plan
    bridge.state = 'built'
    for (const remove of bridge.barriers) remove()
    bridge.barriers.length = 0
    // One-way, so a mage knocked into the hole below is not trapped under it.
    const body = scene.physics.add.staticBody(x, top, w, PLANK_HEIGHT)
    markOneWay(body)
    player.collideWith(body)
    if (building === bridge) building = null
  }

  const stepBridges = (dtMs: number, feetX: number, feetY: number) => {
    for (const bridge of bridges) {
      if (bridge.state === 'built') continue
      if (bridge.state === 'waiting') {
        const { x, w, top } = bridge.plan
        const near = Math.min(Math.abs(feetX - x), Math.abs(feetX - (x + w))) <= BUILD_AHEAD
        if (near && Math.abs(feetY - top) <= 2 * TILE) startBridge(bridge)
        continue
      }
      bridge.ms += dtMs
      const shown = Math.min(bridge.planks.length, Math.ceil((bridge.ms / BUILD_MS) * bridge.planks.length))
      for (let i = 0; i < shown; i++) bridge.planks[i].setVisible(true)
      if (bridge.ms >= BUILD_MS) finishBridge(bridge)
    }
  }

  // The scene unfreezes the player at the start of every step, so the lift freezes it again and
  // moves it with a teleport, like the pit rescue.
  const stepLift = (current: Lift, dtMs: number) => {
    current.ms += dtMs
    const t = Math.min(1, current.ms / LIFT_MS)
    const { step } = current
    let x = current.fromX
    let y = step.low
    if (t > REACH_SHARE) {
      const rise = Math.min(1, (t - REACH_SHARE) / RISE_SHARE)
      y = step.low + (step.high - LIFT_CLEARANCE - step.low) * smooth(rise)
      const over = Math.max(0, (t - REACH_SHARE - RISE_SHARE) / (1 - REACH_SHARE - RISE_SHARE))
      x = current.fromX + (current.toX - current.fromX) * smooth(over)
      if (over >= 1) y = step.high
    }
    player.setFrozen(true)
    player.teleport(x, y)
    if (t >= 1) {
      lift = null
      arm.setVisible(false)
    }
  }

  return {
    step(dtMs, dir) {
      const box = player.hurtbox()
      const feetX = box.centerX
      const feetY = box.bottom
      if (lift) {
        stepLift(lift, dtMs)
        return true
      }
      stepBridges(dtMs, feetX, feetY)
      if (dir !== 0 && player.isGrounded() && !player.isStunned()) {
        const step = stepAt(steps, feetX, feetY, dir, half)
        if (step) {
          lift = { step, ms: 0, fromX: feetX, toX: step.x + dir * (half + 6) }
          say(director.datenkrakeLine('lift'))
          stepLift(lift, 0)
          return true
        }
      }
      return false
    },
    frame(deltaMs) {
      clock += deltaMs
      const box = player.hurtbox()
      let tx = box.centerX - player.facing() * FOLLOW_BEHIND
      let ty = box.bottom
      if (lift) {
        tx = lift.step.x - lift.step.up * 14
        ty = lift.step.low
      } else if (building) {
        const { x, w, top } = building.plan
        tx = Math.abs(box.centerX - x) < Math.abs(box.centerX - (x + w)) ? x - 8 : x + w + 8
        ty = top
      } else if (!player.isGrounded()) {
        ty = intern.y
      }
      const ease = 1 - Math.exp((-Math.min(deltaMs, 50) / 1000) * 8)
      const nx = intern.x + (tx - intern.x) * ease
      intern.setFlipX(tx < intern.x - 0.5)
      // Hammering while it builds, a little hop while it walks.
      const busy = building !== null || lift !== null
      const hop = Math.abs(nx - intern.x) > 0.3 ? Math.abs(Math.sin(clock * 0.02)) * 2 : 0
      intern.setPosition(nx, intern.y + (ty - intern.y) * ease - hop).setRotation(busy ? Math.sin(clock * 0.03) * 0.15 : 0)
      if (lift) {
        // The tentacle reaches from the intern to the mage's chest.
        const fromX = intern.x
        const fromY = intern.y - 10
        const dx = box.centerX - fromX
        const dy = box.centerY - fromY
        const share = Math.min(1, lift.ms / (LIFT_MS * REACH_SHARE))
        arm.setVisible(true).setPosition(fromX, fromY).setRotation(Math.atan2(dx, -dy))
        arm.scaleY = (armScaleY * Math.max(1, Math.hypot(dx, dy) * share)) / ARM_LENGTH
      }
      if (bubble && bubbleMs > 0) {
        bubbleMs -= deltaMs
        bubble.setPosition(intern.x, intern.y - 22)
        if (bubbleMs <= 0) bubble.setVisible(false)
      }
    },
  }
}
