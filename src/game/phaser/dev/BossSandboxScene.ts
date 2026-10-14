import { ARC } from '@nfdi4plants/arctrl'
import Phaser from 'phaser'
import { buildProvenanceIndex } from '../../../arc/provenance/buildIndex'
import type { Annotation, IoKind } from '../../../arc/provenance/types'
import { talinumArcJson } from '../../../storybook/fixtures/talinumArc'
import type { ScribbleArt } from '../../contracts/art'
import { DEPTH, PALETTE, SCENE, TILE } from '../../contracts/constants'
import { createRng } from '../../contracts/rng'
import type { RunNode, RunPlan, Segment } from '../../contracts/run'
import { bossFromNode, finalBossFromPlan } from '../../model/content'
import { loadBindings } from '../../model/input'
import { createBuild } from '../../model/progression'
import { planRun } from '../../model/run'
import { preloadCoreAssets } from '../assets'
import { createScribbleArt } from '../art'
import { arenaPlatforms, PLATFORM_THICKNESS, spawnBoss, spawnFinalBoss } from '../bosses'
import type { Arena, BossHandle } from '../bosses'
import { createCombatWorld } from '../combat'
import { createInputLayer } from '../input/InputLayer'
import { placeholderArt } from '../placeholderArt'
import { createPlayer, markOneWay } from '../player/Player'
import type { Player } from '../player/Player'
import { followView } from '../view'

const T = TILE
const FLOOR = 0
const ARENA_TILES = 26
const ARENA: Arena = { left: 0, right: ARENA_TILES * T, floorY: FLOOR, platforms: arenaPlatforms(0, ARENA_TILES * T, FLOOR) }
const SPAWN = { x: 3 * T, y: FLOOR }
const KINDS: readonly IoKind[] = ['source', 'sample', 'material', 'data']
const KIND_KEYS = ['Digit1', 'Digit2', 'Digit3', 'Digit4']
const QUALITY_STEP = 0.25
const OVERLAY_INTERVAL_MS = 200
const RESPAWN_MS = 2000
const PLAYER_REVIVE_MS = 1500

// The node's own annotations, shown as tells above the boss before heavy attacks.
const TELLS: Annotation[] = [
  { name: 'temperature day', value: '22', unit: '°C', accession: null, category: 'parameter' },
  { name: 'organism', value: 'Talinum fruticosum', unit: null, accession: null, category: 'characteristic' },
]

// Survives a scene restart, so the P key can switch art and come back to the same choice.
let realArt = true

function fakeNode(kind: IoKind): RunNode {
  return { id: `studies/Demo/resources/${kind}-sample.txt`, kind, annotations: TELLS }
}

function fakeSegment(quality: number): Segment {
  return {
    index: 0,
    fromNodeId: 'studies/Demo/resources/input.txt',
    toNodeId: 'studies/Demo/resources/output.txt',
    processKey: 'demo',
    processName: 'Demo step',
    datasetId: 'studies/Demo',
    datasetKind: 'study',
    annotations: [],
    quality,
    telegraphMs: Math.round(80 + 820 * quality),
  }
}

// One arena with the player and a boss. The boss is rebuilt from a fake node at the chosen quality.
// Keys: 1 to 4 pick the archetype, Q and W lower and raise the quality, F starts the final boss,
// P switches between the placeholder and the scribble art. Q, W and F are also ability and move keys of
// the player, which this dev scene accepts.
export class BossSandboxScene extends Phaser.Scene {
  constructor() {
    super(SCENE.bossSandbox)
  }

  preload() {
    preloadCoreAssets(this)
  }

  create() {
    const art: ScribbleArt = realArt ? createScribbleArt() : placeholderArt
    const width = ARENA.right
    const statics: Phaser.Physics.Arcade.StaticBody[] = []
    const g = this.add.graphics().setDepth(DEPTH.tiles)
    for (const [x, y, w, h] of [
      [-T, FLOOR, width + 2 * T, 4 * T],
      [-T, FLOOR - 20 * T, T, 24 * T],
      [width, FLOOR - 20 * T, T, 24 * T],
    ]) {
      statics.push(this.physics.add.staticBody(x, y, w, h))
      g.fillStyle(0x8a7f6e, 1).fillRect(x, y, w, h)
      g.lineStyle(2, PALETTE.outline, 1).strokeRect(x, y, w, h)
    }
    for (const p of ARENA.platforms) {
      const body = this.physics.add.staticBody(p.x, p.top, p.w, PLATFORM_THICKNESS)
      markOneWay(body)
      statics.push(body)
      g.fillStyle(0xa89a84, 1).fillRect(p.x, p.top, p.w, PLATFORM_THICKNESS)
      g.lineStyle(2, PALETTE.outline, 1).strokeRect(p.x, p.top, p.w, PLATFORM_THICKNESS)
    }

    const combat = createCombatWorld(this, { art })
    const input = createInputLayer(this, loadBindings())
    const baseBuild = createBuild()
    const player: Player = createPlayer(this, { combat, art, input, build: baseBuild, colliders: [statics] }, SPAWN.x, SPAWN.y)

    let kindIndex = 0
    let quality = 0.5
    let mode: 'node' | 'final' = 'node'
    let boss: BossHandle | null = null
    let bossTitle = ''
    let phaseCount = 1
    let spawned = 0
    let defeatedMs = 0
    let deadMs = 0
    let plan: RunPlan | null = null

    const spawn = () => {
      boss?.destroy()
      defeatedMs = 0
      spawned++
      const seed = `boss-sandbox:${spawned}`
      const deps = { combat, art, player, rng: createRng(seed) }
      player.setBuild(baseBuild)
      if (mode === 'final') {
        if (!plan) {
          const index = buildProvenanceIndex(ARC.fromROCrateJsonString(talinumArcJson))
          plan = planRun(index, 'Facultative CAM in Talinum', 'boss-sandbox')
        }
        if (!plan) return
        const spec = finalBossFromPlan(plan, createRng(seed))
        const final = spawnFinalBoss(this, spec, plan, deps, ARENA)
        boss = final
        bossTitle = `final boss (${spec.phases.length} phases)`
        phaseCount = spec.phases.length
        final.onPhaseChange((phase) => {
          bossTitle = `final boss, phase ${phase + 1} of ${phaseCount}`
        })
      } else {
        const kind = KINDS[kindIndex]
        const segment = fakeSegment(quality)
        const spec = bossFromNode(fakeNode(kind), segment, createRng(seed))
        boss = spawnBoss(this, spec, segment, deps, ARENA)
        bossTitle = `${spec.archetype} (${kind}), safe zones ${spec.safeZones}, weak points ${spec.weakPoints}, stagger ${spec.staggerWindowMs} ms`
        phaseCount = 1
      }
    }

    this.physics.world.on('worldstep', (deltaSeconds: number) => {
      const dtMs = deltaSeconds * 1000
      combat.update(dtMs)
      player.setFrozen(combat.hitStopRemainingMs() > 0)
      if (boss && combat.hitStopRemainingMs() <= 0) boss.update(dtMs)
      if (boss?.isDefeated()) {
        defeatedMs += dtMs
        if (defeatedMs >= RESPAWN_MS) spawn()
      }
      if (player.hurtbox().bottom > FLOOR + 400) player.teleport(SPAWN.x, SPAWN.y)
      if (!player.isDead()) return
      deadMs += dtMs
      if (deadMs < PLAYER_REVIVE_MS) return
      deadMs = 0
      player.setBuild(baseBuild)
      player.teleport(SPAWN.x, SPAWN.y)
    })

    const camera = this.cameras.main
    // The floor stays two tiles above the bottom edge, whatever height the box shows.
    followView(this, (view) => camera.setBounds(-T, FLOOR - view.height + 2 * T, width + 2 * T, view.height))
    camera.startFollow(player.gameObject, false, 0.14, 0.14)

    const overlay = document.createElement('div')
    overlay.style.cssText =
      'position:fixed;left:8px;top:8px;padding:6px 8px;font:11px/1.35 monospace;background:rgba(25,25,25,.75);color:#f5e6d3;pointer-events:none;z-index:10;min-width:260px'
    const text = document.createElement('pre')
    text.style.cssText = 'margin:0;font:inherit'
    const bar = document.createElement('div')
    bar.style.cssText = 'height:8px;margin-top:4px;background:rgba(245,230,211,.25)'
    const fill = document.createElement('div')
    fill.style.cssText = 'height:100%;background:#e5484d'
    bar.appendChild(fill)
    overlay.append(text, bar)
    document.body.appendChild(overlay)

    const refreshOverlay = () => {
      if (!boss) return
      const telegraphMs = Math.round(80 + 820 * quality)
      const hpBarShown = boss.showHpBar()
      text.textContent = [
        `boss ${bossTitle}`,
        mode === 'node' ? `quality ${quality.toFixed(2)}   telegraph ${telegraphMs} ms` : 'quality per phase from the Talinum plan',
        `boss hp ${(boss.hpFraction() * 100).toFixed(0)}%${hpBarShown ? '' : ' (bar hidden)'}   player hp ${player.hp()}`,
        `attack ${boss.currentAttackName() ?? '-'}`,
        `fps ${this.game.loop.actualFps.toFixed(0)}   art ${realArt ? 'scribble' : 'placeholder'}`,
        '1-4 archetype  Q/W quality  F final boss  P art',
      ].join('\n')
      bar.style.display = hpBarShown ? 'block' : 'none'
      fill.style.width = `${(boss.hpFraction() * 100).toFixed(1)}%`
    }

    let overlayAgeMs = OVERLAY_INTERVAL_MS
    this.events.on('update', (_time: number, delta: number) => {
      overlayAgeMs += delta
      if (overlayAgeMs < OVERLAY_INTERVAL_MS) return
      overlayAgeMs = 0
      refreshOverlay()
    })

    const onKey = (event: KeyboardEvent) => {
      if (event.repeat) return
      const kind = KIND_KEYS.indexOf(event.code)
      if (kind >= 0) {
        kindIndex = kind
        mode = 'node'
      } else if (event.code === 'KeyQ' || event.code === 'KeyW') {
        quality = Math.min(1, Math.max(0, quality + (event.code === 'KeyW' ? QUALITY_STEP : -QUALITY_STEP)))
        mode = 'node'
      } else if (event.code === 'KeyF') {
        mode = 'final'
      } else if (event.code === 'KeyP') {
        realArt = !realArt
        this.scene.restart()
        return
      } else {
        return
      }
      spawn()
    }
    this.game.canvas.addEventListener('keydown', onKey)

    this.events.once('shutdown', () => {
      this.game.canvas.removeEventListener('keydown', onKey)
      overlay.remove()
      boss?.destroy()
      input.destroy()
      combat.destroy()
    })

    spawn()
  }
}
