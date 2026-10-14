import { ARC } from '@nfdi4plants/arctrl'
import Phaser from 'phaser'
import { buildProvenanceIndex } from '../../../arc/provenance/buildIndex'
import type { Annotation } from '../../../arc/provenance/types'
import { talinumArcJson } from '../../../storybook/fixtures/talinumArc'
import { DEPTH, PALETTE, SCENE, TILE } from '../../contracts/constants'
import type { MonsterSpec } from '../../contracts/content'
import { createRng } from '../../contracts/rng'
import { monsterFromAnnotation } from '../../model/content'
import { loadBindings } from '../../model/input'
import { createBuild } from '../../model/progression'
import { planRun } from '../../model/run'
import { createScribbleArt } from '../art'
import { preloadCoreAssets } from '../assets'
import { createCombatWorld } from '../combat'
import { createInputLayer } from '../input/InputLayer'
import { spawnMob, updatePickups, mobXp } from '../mobs'
import type { Mob, MobDeps } from '../mobs'
import { createPlayer, markOneWay } from '../player/Player'
import { followView } from '../view'

const T = TILE
const FLOOR = 0
const SPAWN = { x: 120, y: FLOOR }
// Distance between the monsters along the floor, and the room left before the first and after the last.
const SLOT = 230
const FIRST_X = 700
const END_ROOM = 600
const OVERLAY_INTERVAL_MS = 250
const SLEEP_VIEWS = 1.5
const RESPAWN_MS = 1500
const SEED = 'mob-sandbox'
// A hand-built annotation with an empty value, so a phantom can be tried without one in the ARC.
// The name changes with each press, which gives a different body every time.
const phantomAnnotation = (n: number): Annotation => ({ name: `sample temperature ${n}`, value: '', unit: null, accession: null, category: 'parameter' })

interface Entry {
  mob: Mob
  asleep: boolean
}

interface Spawn {
  spec: MonsterSpec
  x: number
  y: number
}

// A one-way platform lets the player test jumping through. A crawler's raised block shows that the
// crawler stays on its platform.
const BLOCK_WIDTH = 140
const BLOCK_HEIGHT = 3 * T
const PLATFORM_WIDTH = 96

function annotationsOfPlan(): { annotation: Annotation; segmentIndex: number }[] {
  const arc = ARC.fromROCrateJsonString(talinumArcJson)
  const index = buildProvenanceIndex(arc)
  const plan = planRun(index, arc.Title ?? 'Talinum', SEED)
  if (!plan) return []
  return plan.segments.flatMap((segment) => segment.annotations.map((annotation) => ({ annotation, segmentIndex: segment.index })))
}

// Spawns every monster of a planned Talinum run along a long floor. Monsters far from the camera
// sleep, so the awake count shows how many do any work. Press N to add a random monster next to
// the player and P to add a phantom.
export class MobSandboxScene extends Phaser.Scene {
  constructor() {
    super(SCENE.mobSandbox)
  }

  preload() {
    preloadCoreAssets(this)
  }

  create() {
    const found = annotationsOfPlan()
    const rng = createRng(SEED)
    const monsters = found.map(({ annotation, segmentIndex }) => monsterFromAnnotation(annotation, segmentIndex))
    const worldWidth = FIRST_X + monsters.length * SLOT + END_ROOM

    // Level
    const statics: Phaser.Physics.Arcade.StaticBody[] = []
    // Rectangles are drawn as sprites. A Graphics object would rebuild its path every frame.
    const block = (x: number, y: number, w: number, h: number, color: number) =>
      this.add.rectangle(x, y, w, h, color).setOrigin(0, 0).setStrokeStyle(2, PALETTE.outline).setDepth(DEPTH.tiles)
    const solid = (x: number, y: number, w: number, h: number) => {
      statics.push(this.physics.add.staticBody(x, y, w, h))
      block(x, y, w, h, 0x8a7f6e)
    }
    const oneWay = (x: number, y: number, w: number) => {
      const body = this.physics.add.staticBody(x, y, w, 8)
      markOneWay(body)
      statics.push(body)
      block(x, y, w, 8, 0xc9b994)
    }
    solid(-T, FLOOR - 20 * T, T, 24 * T)
    solid(0, FLOOR, worldWidth, 4 * T)
    solid(worldWidth, FLOOR - 20 * T, T, 24 * T)

    // Crawlers get a raised block so they have a platform edge to turn at. The others stand on the floor.
    const spawns: Spawn[] = monsters.map((spec, i) => {
      const x = FIRST_X + i * SLOT
      if (spec.body !== 'crawler') return { spec, x, y: FLOOR }
      solid(x - BLOCK_WIDTH / 2, FLOOR - BLOCK_HEIGHT, BLOCK_WIDTH, BLOCK_HEIGHT)
      return { spec, x, y: FLOOR - BLOCK_HEIGHT }
    })
    for (let i = 0; i + 1 < monsters.length; i += 3) {
      if (monsters[i].body === 'crawler' || monsters[i + 1].body === 'crawler') continue
      const middle = FIRST_X + i * SLOT + SLOT / 2
      oneWay(middle - PLATFORM_WIDTH / 2, FLOOR - 3 * T, PLATFORM_WIDTH)
    }

    // Actors
    const art = createScribbleArt()
    const combat = createCombatWorld(this, { art })
    const input = createInputLayer(this, loadBindings())
    const player = createPlayer(this, { combat, art, input, build: createBuild(), colliders: [statics] }, SPAWN.x, SPAWN.y)
    const deps: MobDeps = { combat, art, player, colliders: [statics], rng }

    let viewWidth = 0
    followView(this, (view) => {
      viewWidth = view.width
    })
    const camera = this.cameras.main
    camera.setBounds(-T, FLOOR - 40 * T, worldWidth + 2 * T, 46 * T)
    camera.startFollow(player.gameObject, false, 0.14, 0.14)
    camera.setDeadzone(24, 40)

    const entries: Entry[] = []
    const spawn = ({ spec, x, y }: Spawn) => {
      const mob = spawnMob(this, spec, deps, x, y)
      const asleep = Math.abs(x - SPAWN.x) > viewWidth * SLEEP_VIEWS
      if (asleep) mob.setAsleep(true)
      entries.push({ mob, asleep })
    }
    for (const item of spawns) spawn(item)

    let kills = 0
    let xp = 0
    combat.on('kill', (event) => {
      const gained = mobXp(event.target)
      if (gained <= 0) return
      kills++
      xp += gained
    })

    this.physics.world.on('worldstep', (deltaSeconds: number) => {
      const dt = deltaSeconds * 1000
      combat.update(dt)
      const frozen = combat.hitStopRemainingMs() > 0
      player.setFrozen(frozen)
      if (!frozen) for (const entry of entries) if (!entry.asleep) entry.mob.update(dt)
      updatePickups(this, player)
      if (player.hurtbox().bottom > FLOOR + 400) player.teleport(SPAWN.x, SPAWN.y)
    })

    // Debug panel
    const overlay = document.createElement('pre')
    overlay.id = 'arc-mage-mobsandbox-debug'
    overlay.style.cssText =
      'position:fixed;left:8px;top:8px;margin:0;padding:6px 8px;font:11px/1.35 monospace;background:rgba(25,25,25,.75);color:#f5e6d3;pointer-events:none;z-index:10'
    document.body.appendChild(overlay)
    let overlayAgeMs = OVERLAY_INTERVAL_MS
    let deadMs = 0
    let lookAhead = 0

    const groundBelow = (x: number, y: number) => this.physics.overlapRect(x - 2, y - 2, 4, 40, false, true).length > 0
    let phantoms = 0
    const spawnNearPlayer = (phantom = false) => {
      if (found.length === 0 && !phantom) return
      const here = player.position()
      const side = rng.chance(0.5) ? 1 : -1
      let x = here.x
      for (const direction of [side, -side]) {
        const candidate = here.x + direction * (110 + rng.int(0, 70))
        if (!groundBelow(candidate, here.y)) continue
        x = candidate
        break
      }
      const { annotation, segmentIndex } = phantom ? { annotation: phantomAnnotation(++phantoms), segmentIndex: 0 } : rng.pick(found)
      spawn({ spec: monsterFromAnnotation(annotation, segmentIndex), x, y: here.y })
    }

    const onKey = (event: KeyboardEvent) => {
      if (event.repeat) return
      if (event.code === 'KeyN') spawnNearPlayer()
      else if (event.code === 'KeyP') spawnNearPlayer(true)
    }
    this.game.canvas.addEventListener('keydown', onKey)

    this.events.on('update', (_time: number, delta: number) => {
      const target = player.facing() * 56
      lookAhead += (target - lookAhead) * (1 - Math.exp((-Math.min(delta, 50) / 1000) * 3))
      camera.setFollowOffset(-lookAhead, 36)

      // Mobs beyond SLEEP_VIEWS view widths from the camera skip AI and physics. The wake distance is a
      // little shorter, so a mob on the border does not toggle every frame.
      const centerX = camera.scrollX + viewWidth / 2
      let kept = 0
      for (const entry of entries) {
        if (entry.mob.isGone()) {
          entry.mob.destroy()
          continue
        }
        const limit = viewWidth * SLEEP_VIEWS * (entry.asleep ? 0.93 : 1)
        const far = Math.abs(entry.mob.hurtbox().centerX - centerX) > limit
        if (far !== entry.asleep) {
          entry.asleep = far
          entry.mob.setAsleep(far)
        }
        entries[kept++] = entry
      }
      entries.length = kept

      if (player.isDead()) {
        deadMs += delta
        if (deadMs >= RESPAWN_MS) {
          const build = player.getBuild()
          player.setBuild({ ...build, hp: build.stats.maxHp })
          player.teleport(SPAWN.x, SPAWN.y)
          deadMs = 0
        }
      }

      // Rewriting DOM text every frame costs layout time, so the panel refreshes four times a second.
      overlayAgeMs += delta
      if (overlayAgeMs < OVERLAY_INTERVAL_MS) return
      overlayAgeMs = 0
      const awake = entries.reduce((count, entry) => count + (entry.asleep ? 0 : 1), 0)
      overlay.textContent = [
        `fps ${this.game.loop.actualFps.toFixed(0)}`,
        `mobs ${entries.length}  awake ${awake}`,
        `kills ${kills}  xp ${xp}`,
        `hp ${player.hp()}  shields ${player.shieldCount()}`,
        'N spawns a random monster next to you, P a phantom.',
      ].join('\n')
    })

    this.events.once('shutdown', () => {
      this.game.canvas.removeEventListener('keydown', onKey)
      overlay.remove()
      input.destroy()
      combat.destroy()
    })
  }
}
