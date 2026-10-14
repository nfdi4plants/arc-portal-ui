import Phaser from 'phaser'
import type { Combatant, CombatWorld, HitEvent } from '../../contracts/combat'
import { DEPTH, PALETTE, TILE } from '../../contracts/constants'
import type { MechanicId, PlayerBuild } from '../../contracts/progression'
import { SCENE } from '../../contracts/constants'
import { loadBindings } from '../../model/input'
import { preloadCoreAssets } from '../assets'
import { createCombatWorld } from '../combat'
import { createInputLayer } from '../input/InputLayer'
import { placeholderArt } from '../placeholderArt'
import { createPlayer, markOneWay } from '../player/Player'
import type { Player } from '../player/Player'
import { followView } from '../view'

const T = TILE
const FLOOR = 0
const ROOM_WIDTH = 3000
const SPAWN = { x: 120, y: FLOOR }
const OVERLAY_INTERVAL_MS = 200

// Dev-only build. Part C owns the real starting build.
const TEST_BUILD: PlayerBuild = {
  level: 1,
  xp: 0,
  hp: 100,
  stats: {
    maxHp: 100,
    moveSpeed: 1,
    attackSpeed: 1,
    damage: 1,
    meleeRange: 1,
    critChance: 0,
    critMultiplier: 1.5,
    dashCooldownMs: 450,
    lifesteal: 0,
  },
  weapons: { light: { id: 'staff', tier: 1 }, heavy: { id: 'staff', tier: 1 } },
  mechanics: [],
  legendaries: [],
  abilitySlots: [null, null, null, null],
  offerSize: 3,
}

const TOGGLES: Record<string, MechanicId> = {
  Digit1: 'doubleJump',
  Digit2: 'airDash',
  Digit3: 'wallJump',
  Digit4: 'hatGlide',
}

// Solid blocks as [x, y, width, height], y grows downwards and FLOOR is the ground surface.
const SOLIDS: [number, number, number, number][] = [
  [-T, FLOOR - 20 * T, T, 24 * T],
  // Ground with gaps of 2, 3 and 4 tiles.
  [0, FLOOR, 1100, 4 * T],
  [1100 + 2 * T, FLOOR, 160, 4 * T],
  [1308 + 3 * T, FLOOR, 160, 4 * T],
  [1540 + 4 * T, FLOOR, ROOM_WIDTH - 1636, 4 * T],
  // Steps of 1, 2 and 3 tiles.
  [600, FLOOR - T, 96, T],
  [696, FLOOR - 2 * T, 96, 2 * T],
  [792, FLOOR - 3 * T, 96, 3 * T],
  // Wall pair. The left wall stops 3 tiles above the floor so the player can walk into the shaft.
  [2300, FLOOR - 16 * T, T, 13 * T],
  [2300 + 5 * T, FLOOR - 16 * T, T, 16 * T],
  [ROOM_WIDTH, FLOOR - 20 * T, T, 24 * T],
]

const ONE_WAY: [number, number, number][] = [
  [1700, FLOOR - 2 * T, 96],
  [1830, FLOOR - 3.5 * T, 96],
  [1700, FLOOR - 5 * T, 96],
  [1830, FLOOR - 6.5 * T, 96],
  [1960, FLOOR - 8 * T, 120],
  [2470, FLOOR - 8 * T, 120],
]

// A training target that shows the damage it takes and never dies.
function createDummy(scene: Phaser.Scene, x: number, y: number): Combatant {
  const width = 24
  const height = 40
  const shape = scene.add.rectangle(x, y - height / 2, width, height, PALETTE.yellow).setStrokeStyle(2, PALETTE.outline).setDepth(DEPTH.enemies)
  let total = 0
  const label = scene.add
    .text(x, y - height - 14, 'Dummy', { fontFamily: 'sans-serif', fontSize: '10px', color: '#191919', resolution: 3 })
    .setOrigin(0.5, 1)
    .setDepth(DEPTH.enemies)
  return {
    id: 'dummy',
    team: 'enemy',
    killer: { kind: 'hazard', label: 'Training dummy' },
    hurtbox: () => new Phaser.Geom.Rectangle(x - width / 2, y - height, width, height),
    facing: () => -1,
    position: () => ({ x, y }),
    isInvulnerable: () => false,
    isDead: () => false,
    receiveHit(hit: HitEvent) {
      total += hit.damage
      label.setText(`Dummy (${Math.round(total)})`)
      shape.setFillStyle(0xffffff)
      scene.time.delayedCall(80, () => shape.setFillStyle(PALETTE.yellow))
      shape.x = x + Math.sign(hit.knockback.x) * 3
      scene.tweens.add({ targets: shape, x, duration: 120 })
    },
  }
}

export class TestRoomScene extends Phaser.Scene {
  constructor() {
    super(SCENE.testRoom)
  }

  preload() {
    preloadCoreAssets(this)
  }

  create() {
    const statics: Phaser.Physics.Arcade.StaticBody[] = []
    const g = this.add.graphics().setDepth(DEPTH.tiles)
    for (const [x, y, w, h] of SOLIDS) {
      statics.push(this.physics.add.staticBody(x, y, w, h))
      g.fillStyle(0x8a7f6e, 1).fillRect(x, y, w, h)
      g.lineStyle(2, PALETTE.outline, 1).strokeRect(x, y, w, h)
    }
    for (const [x, y, w] of ONE_WAY) {
      const body = this.physics.add.staticBody(x, y, w, 8)
      markOneWay(body)
      statics.push(body)
      g.fillStyle(0xc9b994, 1).fillRect(x, y, w, 8)
      g.lineStyle(2, PALETTE.outline, 1).lineBetween(x, y, x + w, y)
    }

    const combat: CombatWorld = createCombatWorld(this)
    combat.register(createDummy(this, 400, FLOOR))
    const input = createInputLayer(this, loadBindings())
    const player: Player = createPlayer(this, { combat, art: placeholderArt, input, build: TEST_BUILD, colliders: [statics] }, SPAWN.x, SPAWN.y)

    this.physics.world.on('worldstep', (deltaSeconds: number) => {
      combat.update(deltaSeconds * 1000)
      player.setFrozen(combat.hitStopRemainingMs() > 0)
      if (player.hurtbox().bottom > FLOOR + 400) player.teleport(SPAWN.x, SPAWN.y)
    })

    followView(this)
    const camera = this.cameras.main
    camera.setBounds(-T, FLOOR - 40 * T, ROOM_WIDTH + 2 * T, 46 * T)
    camera.startFollow(player.gameObject, false, 0.14, 0.14)
    camera.setDeadzone(24, 40)
    let lookAhead = 0
    let overlayAgeMs = 0

    const overlay = document.createElement('pre')
    overlay.id = 'arc-mage-testroom-debug'
    overlay.style.cssText =
      'position:fixed;left:8px;top:8px;margin:0;padding:6px 8px;font:11px/1.35 monospace;background:rgba(25,25,25,.75);color:#f5e6d3;pointer-events:none;display:none;z-index:10'
    document.body.appendChild(overlay)

    const onKey = (event: KeyboardEvent) => {
      if (event.code === 'F3') {
        event.preventDefault()
        const show = overlay.style.display === 'none'
        overlay.style.display = show ? 'block' : 'none'
        overlayAgeMs = OVERLAY_INTERVAL_MS
        return
      }
      const mechanic = TOGGLES[event.code]
      if (!mechanic || event.repeat) return
      const build = player.getBuild()
      const mechanics = build.mechanics.includes(mechanic) ? build.mechanics.filter((m) => m !== mechanic) : [...build.mechanics, mechanic]
      player.setBuild({ ...build, mechanics })
    }
    this.game.canvas.addEventListener('keydown', onKey)

    this.events.on('update', (_time: number, delta: number) => {
      const target = player.facing() * 56
      lookAhead += (target - lookAhead) * (1 - Math.exp((-Math.min(delta, 50) / 1000) * 3))
      camera.setFollowOffset(-lookAhead, 36)
      if (overlay.style.display === 'none') return
      // Rewriting DOM text every frame costs layout time, so the panel refreshes 5 times a second.
      overlayAgeMs += delta
      if (overlayAgeMs < OVERLAY_INTERVAL_MS) return
      overlayAgeMs = 0
      const { motor, grounded, attackPhase, flinchMs, damageIframesMs } = player.debugState()
      const mechanics = player.getBuild().mechanics
      const flag = (m: MechanicId, key: string) => `${key} ${m}: ${mechanics.includes(m) ? 'on' : 'off'}`
      overlay.textContent = [
        `fps ${this.game.loop.actualFps.toFixed(0)}`,
        `pos ${player.position().x.toFixed(1)}, ${player.position().y.toFixed(1)}`,
        `vx ${motor.vx.toFixed(1)}  vy ${motor.vy.toFixed(1)}  facing ${motor.facing}`,
        `grounded ${grounded}  jumpsUsed ${motor.jumpsUsed}  airDashUsed ${motor.airDashUsed}  jumpHeld ${motor.jumpHeld}`,
        `coyote ${motor.coyoteMs.toFixed(0)}  buffer ${motor.jumpBufferMs.toFixed(0)}  wallLock ${motor.wallLockMs.toFixed(0)}`,
        `dash ${motor.dashMs.toFixed(0)}  dashCd ${motor.dashCooldownMs.toFixed(0)}  dashIframes ${motor.dashIframesMs.toFixed(0)}`,
        `attack ${attackPhase}  flinch ${flinchMs.toFixed(0)}  hurtIframes ${damageIframesMs.toFixed(0)}  hp ${player.hp()}`,
        `hitStop ${combat.hitStopRemainingMs().toFixed(0)}`,
        flag('doubleJump', '1'),
        flag('airDash', '2'),
        flag('wallJump', '3'),
        flag('hatGlide', '4'),
        'F3 hides this panel. Down + jump drops through light platforms.',
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
