import Phaser from 'phaser'
import type { Combatant, HitEvent, KillerInfo } from '../../contracts/combat'
import { DEPTH, PALETTE, TILE } from '../../contracts/constants'
import { createRng } from '../../contracts/rng'
import type { PlayerBuild } from '../../contracts/progression'
import { CARDS, applyCard, createBuild } from '../../model/progression'
import { loadBindings } from '../../model/input'
import { createScribbleArt } from '../art'
import { preloadCoreAssets } from '../assets'
import { createCombatWorld } from '../combat'
import { createInputLayer } from '../input/InputLayer'
import { createPlayer, markOneWay } from '../player/Player'
import type { Player } from '../player/Player'
import { aimedVelocity } from '../player/weapons/helpers'
import { attachLoadout } from '../player/weapons'
import type { LoadoutWithStatus } from '../player/weapons'
import { followView } from '../view'

const T = TILE
const FLOOR = 0
const ROOM_WIDTH = 1800
const SPAWN = { x: 120, y: FLOOR }
const PANEL_REFRESH_MS = 250
const RESPAWN_MS = 1500
const DUMMY_WIDTH = 24
const DUMMY_HEIGHT = 40
const TURRET_EVERY_MS = 3000
const TURRET_SPEED = 110

// Dev-only room: a flat floor with a few one-way platforms.
const SOLIDS: [number, number, number, number][] = [
  [-T, FLOOR - 20 * T, T, 24 * T],
  [0, FLOOR, ROOM_WIDTH, 4 * T],
  [ROOM_WIDTH, FLOOR - 20 * T, T, 24 * T],
]
const ONE_WAY: [number, number, number][] = [
  [300, FLOOR - 3 * T, 96],
  [690, FLOOR - 4 * T, 120],
  [1000, FLOOR - 6 * T, 120],
]

const KILLER: KillerInfo = { kind: 'hazard', label: 'Training dummy' }

// A rectangle that takes hits, is shoved and springs back, and stands up again after a knockout.
// Hp is shown as a bar. position() is the bottom centre.
class Dummy implements Combatant {
  readonly id: string
  readonly team = 'enemy' as const
  readonly killer = KILLER
  private readonly homeX: number
  private readonly groundY: number
  private readonly color: number
  private readonly maxHp: number
  private readonly box = new Phaser.Geom.Rectangle()
  private readonly body: Phaser.GameObjects.Rectangle
  private readonly bar: Phaser.GameObjects.Rectangle
  private hp: number
  private offsetX = 0
  private offsetY = 0
  private velX = 0
  private velY = 0
  private flashMs = 0
  private downMs = 0

  constructor(scene: Phaser.Scene, id: string, homeX: number, groundY: number, color: number, maxHp = 120) {
    this.id = id
    this.homeX = homeX
    this.groundY = groundY
    this.color = color
    this.maxHp = maxHp
    this.hp = maxHp
    this.body = scene.add.rectangle(homeX, groundY, DUMMY_WIDTH, DUMMY_HEIGHT, color).setOrigin(0.5, 1).setStrokeStyle(1, PALETTE.outline).setDepth(DEPTH.enemies)
    this.bar = scene.add.rectangle(homeX, groundY - DUMMY_HEIGHT - 6, DUMMY_WIDTH, 3, 0xe5484d).setOrigin(0.5, 0.5).setDepth(DEPTH.enemies)
    this.sync()
  }

  hurtbox() {
    return this.box.setTo(this.homeX + this.offsetX - DUMMY_WIDTH / 2, this.groundY + this.offsetY - DUMMY_HEIGHT, DUMMY_WIDTH, DUMMY_HEIGHT)
  }

  facing(): 1 | -1 {
    return -1
  }

  position() {
    return { x: this.homeX + this.offsetX, y: this.groundY + this.offsetY }
  }

  isInvulnerable() {
    return false
  }

  isDead() {
    return this.hp <= 0
  }

  receiveHit(hit: HitEvent) {
    this.hp = Math.max(0, this.hp - hit.damage)
    this.velX = hit.knockback.x
    this.velY = hit.knockback.y
    this.flashMs = 90
    if (this.hp === 0) this.downMs = RESPAWN_MS
    this.sync()
  }

  step(deltaMs: number) {
    const seconds = deltaMs / 1000
    if (this.isDead()) {
      this.downMs -= deltaMs
      if (this.downMs <= 0) this.hp = this.maxHp
    }
    this.flashMs = Math.max(0, this.flashMs - deltaMs)
    this.velX -= this.velX * Math.min(1, 10 * seconds)
    this.offsetX += this.velX * seconds
    this.offsetX -= this.offsetX * Math.min(1, 6 * seconds)
    this.offsetY += this.velY * seconds
    this.velY += 900 * seconds
    if (this.offsetY > 0) {
      this.offsetY = 0
      this.velY = 0
    }
    this.sync()
  }

  private sync() {
    const x = this.homeX + this.offsetX
    const y = this.groundY + this.offsetY
    this.body.setPosition(x, y).setFillStyle(this.flashMs > 0 ? PALETTE.cream : this.color).setAlpha(this.isDead() ? 0.3 : 1)
    this.bar.setPosition(x, y - DUMMY_HEIGHT - 6).setScale(Math.max(0.001, this.hp / this.maxHp), 1)
  }
}

// Loadout playground. The panel on the right toggles any card. The scene rebuilds the build from
// the checked cards, hands it to the player and syncs the loadout.
export class LoadoutSandboxScene extends Phaser.Scene {
  constructor() {
    super('LoadoutSandbox')
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

    const art = createScribbleArt()
    const combat = createCombatWorld(this, { art })
    const input = createInputLayer(this, loadBindings())
    let build: PlayerBuild = createBuild()
    const player: Player = createPlayer(this, { combat, art, input, build, colliders: [statics] }, SPAWN.x, SPAWN.y)

    const dummies = [
      new Dummy(this, 'dummy-1', 380, FLOOR, PALETTE.yellow),
      new Dummy(this, 'dummy-2', 470, FLOOR, PALETTE.yellow),
      new Dummy(this, 'dummy-3', 560, FLOOR, PALETTE.yellow),
      new Dummy(this, 'dummy-4', 750, FLOOR - 4 * T, PALETTE.yellow),
      new Dummy(this, 'dummy-5', 1060, FLOOR - 6 * T, PALETTE.yellow),
    ]
    const turret = new Dummy(this, 'turret', 1300, FLOOR, PALETTE.navy, 200)
    const everyone: Dummy[] = [...dummies, turret]
    const living: Combatant[] = []
    for (const dummy of everyone) combat.register(dummy)

    const loadout: LoadoutWithStatus = attachLoadout({
      scene: this,
      combat,
      art,
      player,
      rng: createRng('loadout-sandbox'),
      enemies: () => living,
    })
    loadout.sync(build)

    let turretMs = TURRET_EVERY_MS
    const shootAtPlayer = () => {
      const from = turret.position()
      const origin = { x: from.x, y: from.y - 30 }
      const target = player.position()
      const ref = art.projectile(this, 'orb')
      combat.spawnProjectile(
        {
          owner: turret,
          shape: { kind: 'circle', x: 0, y: 0, r: 5 },
          textureKey: ref.textureKey,
          animKey: ref.animKey,
          velocity: aimedVelocity(origin, { x: target.x, y: target.y - 22 }, TURRET_SPEED, -1),
          gravity: 0,
          lifetimeMs: 6000,
          pierce: 0,
          reflectable: true,
          damage: 8,
          knockback: { x: 80, y: -60 },
          hitStopMs: 40,
          maxTargets: Infinity,
          tags: ['projectile'],
        },
        origin,
      )
    }

    let respawnMs = 0
    const onStep = (deltaSeconds: number) => {
      const deltaMs = deltaSeconds * 1000
      const frozen = combat.hitStopRemainingMs() > 0
      combat.update(deltaMs)
      player.setFrozen(combat.hitStopRemainingMs() > 0)
      if (frozen) return

      living.length = 0
      for (const dummy of everyone) if (!dummy.isDead()) living.push(dummy)
      loadout.update(deltaMs)
      for (const dummy of everyone) dummy.step(deltaMs)

      turretMs -= deltaMs
      if (turretMs <= 0) {
        turretMs += TURRET_EVERY_MS
        if (!turret.isDead() && !player.isDead()) shootAtPlayer()
      }

      if (player.hurtbox().bottom > FLOOR + 400) player.teleport(SPAWN.x, SPAWN.y)
      if (player.isDead()) {
        respawnMs += deltaMs
        if (respawnMs >= RESPAWN_MS) {
          respawnMs = 0
          apply({ ...build, hp: build.stats.maxHp })
          player.teleport(SPAWN.x, SPAWN.y)
        }
      }
    }
    this.physics.world.on('worldstep', onStep)

    followView(this)
    const camera = this.cameras.main
    camera.setBounds(-T, FLOOR - 40 * T, ROOM_WIDTH + 2 * T, 46 * T)
    camera.startFollow(player.gameObject, false, 0.14, 0.14)
    camera.setDeadzone(24, 40)
    camera.setFollowOffset(0, 36)

    const checked = new Set<string>()
    const tierTwo = new Set<string>()
    const rebuild = (): PlayerBuild => {
      let next = createBuild()
      for (const card of CARDS) {
        if (!checked.has(card.id)) continue
        next = applyCard(next, card.id)
        if (card.kind === 'weapon' && tierTwo.has(card.id)) next = applyCard(next, card.id)
      }
      // Keep the current hp, so toggling a card does not heal.
      return { ...next, hp: Math.max(1, Math.min(player.hp(), next.stats.maxHp)) }
    }
    const apply = (next: PlayerBuild) => {
      build = next
      player.setBuild(next)
      loadout.sync(next)
    }
    const refresh = () => apply(rebuild())

    const parent = this.game.canvas.parentElement
    const restoreParent = anchor(parent)
    const panel = buildPanel(this, checked, tierTwo, refresh, () => {
      // Restart the timer too, so the next automatic shot comes a full interval later.
      turretMs = TURRET_EVERY_MS
      shootAtPlayer()
    })
    parent?.appendChild(panel.root)

    let hits = 0
    let dealt = 0
    // Hits per tag, so a tester can see which effects fire (finisher, echo, chain, doi and so on).
    const tagCounts = new Map<string, number>()
    combat.on('hit', (event) => {
      if (event.attacker.team !== 'player') return
      hits++
      dealt += event.damage
      for (const tag of event.tags) tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1)
    })

    let panelAgeMs = PANEL_REFRESH_MS
    const onUpdate = (_time: number, delta: number) => {
      // Rewriting DOM text every frame costs layout time, so the stats refresh 4 times a second.
      panelAgeMs += delta
      if (panelAgeMs < PANEL_REFRESH_MS) return
      panelAgeMs = 0
      panel.stats.textContent = [
        `fps ${this.game.loop.actualFps.toFixed(0)}`,
        `hp ${Math.round(player.hp())} / ${player.getBuild().stats.maxHp}  shields ${player.shieldCount()}`,
        `x ${Math.round(player.position().x)}  y ${Math.round(player.position().y)}`,
        `dealt ${Math.round(dealt)} damage in ${hits} hits`,
        `git revert charge ${loadout.gitRevertCharged() ? 'ready' : 'spent or not owned'}`,
        `tags ${[...tagCounts].map(([tag, count]) => `${tag} ${count}`).join(', ')}`,
      ].join('\n')
    }
    this.events.on('update', onUpdate)

    this.events.once('shutdown', () => {
      this.physics.world.off('worldstep', onStep)
      this.events.off('update', onUpdate)
      panel.root.remove()
      restoreParent()
      loadout.destroy()
      input.destroy()
      combat.destroy()
    })
  }
}

// The panel is positioned over the canvas, so its container must be a positioned element.
// Returns a function that puts the old style back.
function anchor(parent: HTMLElement | null): () => void {
  if (!parent || getComputedStyle(parent).position !== 'static') return () => {}
  parent.style.position = 'relative'
  return () => {
    parent.style.position = ''
  }
}

function buildPanel(scene: Phaser.Scene, checked: Set<string>, tierTwo: Set<string>, onChange: () => void, fireTurret: () => void) {
  const root = document.createElement('div')
  root.style.cssText =
    'position:absolute;right:8px;top:8px;width:250px;max-height:calc(100% - 16px);overflow:auto;box-sizing:border-box;padding:8px;font:11px/1.4 sans-serif;background:rgba(25,25,25,.85);color:#f5e6d3;z-index:10;border-radius:4px'
  // Clicks and keys in the panel must not reach the game.
  root.addEventListener('keydown', (event) => event.stopPropagation())

  const stats = document.createElement('pre')
  stats.style.cssText = 'margin:0 0 6px;font:11px/1.35 monospace;white-space:pre-wrap'
  const hint = document.createElement('div')
  hint.style.cssText = 'margin-bottom:6px;opacity:.8'
  hint.textContent =
    'Click the canvas first. WASD, Space, Shift, mouse buttons, Q E R F. Heavy in the air plunges, attacks during a dash are dash attacks, W + attack goes up, down + light in the air is the pogo.'
  root.append(stats, hint)

  const boxes = new Map<string, HTMLInputElement>()
  const refocus = () => scene.game.canvas.focus()

  const setChecked = (id: string, value: boolean) => {
    if (value) checked.add(id)
    else {
      checked.delete(id)
      tierTwo.delete(id)
    }
    const box = boxes.get(id)
    if (box) box.checked = value
    const second = boxes.get(`${id}#2`)
    if (second) second.checked = tierTwo.has(id)
  }

  const buttons = document.createElement('div')
  buttons.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;margin-bottom:6px'
  const button = (label: string, run: () => void, changesBuild = true) => {
    const element = document.createElement('button')
    element.textContent = label
    element.addEventListener('click', () => {
      run()
      if (changesBuild) onChange()
      refocus()
    })
    buttons.appendChild(element)
  }
  button('Clear', () => {
    for (const card of CARDS) setChecked(card.id, false)
  })
  button('All legendaries', () => {
    for (const card of CARDS) if (card.kind === 'legendary') setChecked(card.id, true)
  })
  button('Fire turret', fireTurret, false)
  root.appendChild(buttons)

  let lastKind = ''
  for (const card of CARDS) {
    if (card.kind !== lastKind) {
      lastKind = card.kind
      const heading = document.createElement('div')
      heading.textContent = card.kind
      heading.style.cssText = 'margin:6px 0 2px;font-weight:700;text-transform:capitalize'
      root.appendChild(heading)
    }
    const row = document.createElement('label')
    row.style.cssText = 'display:flex;align-items:center;gap:4px;cursor:pointer'
    const box = document.createElement('input')
    box.type = 'checkbox'
    box.addEventListener('change', () => {
      // One weapon per slot: the newest pick replaces the others.
      if (box.checked && card.kind === 'weapon') {
        for (const other of CARDS) if (other.kind === 'weapon' && other.slot === card.slot && other.id !== card.id) setChecked(other.id, false)
      }
      setChecked(card.id, box.checked)
      onChange()
      refocus()
    })
    boxes.set(card.id, box)
    row.append(box, document.createTextNode(card.id))
    if (card.kind === 'weapon') {
      const second = document.createElement('input')
      second.type = 'checkbox'
      second.title = 'Tier 2'
      second.addEventListener('change', () => {
        if (second.checked) {
          for (const other of CARDS) if (other.kind === 'weapon' && other.slot === card.slot && other.id !== card.id) setChecked(other.id, false)
          checked.add(card.id)
          tierTwo.add(card.id)
          box.checked = true
        } else {
          tierTwo.delete(card.id)
        }
        onChange()
        refocus()
      })
      boxes.set(`${card.id}#2`, second)
      row.append(second, document.createTextNode('x2'))
    }
    root.appendChild(row)
  }
  return { root, stats }
}
