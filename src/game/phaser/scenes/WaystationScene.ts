import Phaser from 'phaser'
import { DEPTH, PALETTE, SCENE, TILE } from '../../contracts/constants'
import { bindingLabel } from '../../model/input'
import { ENCOUNTER_SLOTS, rollEncounters } from '../../model/run'
import { applySpriteRef, datenkrakeArmArt, datenkrakeArt, doorArt, traderArt } from '../art'
import type { Arena } from '../bosses'
import { cssColor } from '../color'
import type { View } from '../view'
import { buildArena } from './arena'
import type { RunContext } from './context'
import { ENCOUNTER_SPAWNERS, type Encounter, type EncounterHost } from './encounters'
import { GameplayScene, type LevelSetup } from './GameplayScene'
import type { Parallax } from './levelArt'
import { portalLabel } from './RunDirector'
import { addText } from './ui'

const T = TILE
const BANNER_MS = 1400
// One room a little wider than the view, without platforms.
const ROOM_VIEWS = 1.15
const PORTAL = { w: 2 * T, h: 3 * T }
// The portal the mage came through closes behind it once the banner is gone.
const ENTRANCE_CLOSE_MS = 700
// Where each slot stands on the floor between the entrance and the exit, as a share of that span.
const SLOT_AT = { left: 0.18, centre: 0.5, right: 0.82 } as const

// The waystation after a node boss: one quiet room of the boss's theme. The mage comes in on the
// left, meets the encounters of `rollEncounters` (the FAIR trader, sometimes the Datenkrake) and leaves through the
// portal on the right, which leads to the next step or to the ARC itself.
export class WaystationScene extends GameplayScene {
  private index = 0
  private arena!: Arena
  private parallax!: Parallax
  private spawnX = 0
  private readonly exit = new Phaser.Geom.Rectangle()
  private encounters: Encounter[] = []
  // The encounter in reach, -1 when none is.
  private nearIndex = -1
  // The encounter whose overlay is open.
  private engaged: Encounter | null = null
  private prompt: Phaser.GameObjects.Text | null = null
  private promptFor: Encounter | null = null
  private promptBindings = -1

  constructor(ctx: RunContext) {
    super(SCENE.waystation, ctx)
  }

  protected buildLevel(data: { index?: number }): LevelSetup {
    this.index = data.index ?? 0
    this.encounters = []
    this.nearIndex = -1
    this.engaged = null
    this.prompt = null
    this.promptFor = null
    const theme = this.director.segment(this.index).datasetKind
    const built = buildArena(this, this.ctx.art, theme, this.view, { views: ROOM_VIEWS, platforms: false })
    this.arena = built.arena
    this.parallax = built.parallax
    this.spawnX = built.setup.spawn.x
    return built.setup
  }

  protected setup() {
    const { arena, director, index } = this
    const floor = arena.floorY
    const exitX = arena.right - 2.5 * T
    this.exit.setTo(exitX - PORTAL.w / 2, floor - PORTAL.h, PORTAL.w, PORTAL.h)
    const ref = doorArt(this, PORTAL.w, PORTAL.h)
    applySpriteRef(this.add.sprite(exitX, floor, ref.textureKey).setDepth(DEPTH.tiles + 1), ref)
    const label = portalLabel(director.plan, index)
    addText(this, label.title, 8, { color: PALETTE.navy, bold: true, align: 'center' })
      .setOrigin(0.5, 1)
      .setPosition(exitX, floor - PORTAL.h - 12)
      .setDepth(DEPTH.tiles + 1)
    addText(this, label.detail, 6, { color: PALETTE.navy, align: 'center' })
      .setOrigin(0.5, 1)
      .setPosition(exitX, floor - PORTAL.h - 4)
      .setDepth(DEPTH.tiles + 1)

    const entrance = this.add.sprite(1.5 * T, floor, ref.textureKey).setDepth(DEPTH.tiles + 1)
    applySpriteRef(entrance, ref)
    // Tweens are held with the world, so this waits for the banner.
    this.tweens.add({ targets: entrance, scaleX: 0, alpha: 0, delay: 150, duration: ENTRANCE_CLOSE_MS, ease: 'Back.easeIn', onComplete: () => entrance.destroy() })

    // Drawn up front, so the first encounter does not stall the frame.
    traderArt(this)
    const kinds = rollEncounters(director.plan.seed, index)
    if (kinds.includes('datenkrake')) {
      datenkrakeArt(this)
      datenkrakeArmArt(this)
    }
    const host: EncounterHost = {
      scene: this,
      director,
      index,
      floorY: floor,
      player: this.player,
      openStore: () => this.openStore(index),
      hold: (on) => this.holdForEncounter(on),
      openDatenkrake: () => this.openDatenkrake(index),
    }
    const from = this.spawnX + 2 * T
    const to = this.exit.x - 2 * T
    kinds.forEach((kind, i) => {
      const x = Math.round(from + (to - from) * SLOT_AT[ENCOUNTER_SLOTS[i]])
      this.encounters.push(ENCOUNTER_SPAWNERS[kind](host, x))
    })
    this.prompt = addText(this, '', 7, { color: PALETTE.navy, bold: true, align: 'center' })
      .setOrigin(0.5, 1)
      .setBackgroundColor(cssColor(PALETTE.yellow))
      .setPadding(3, 1, 3, 1)
      .setDepth(DEPTH.fx)
      .setVisible(false)

    this.showIntro('Waystation', `${director.bossSpec(index).label} is behind you · ${label.title}`, BANNER_MS)
  }

  protected onBannerDone() {
    for (const encounter of this.encounters) encounter.arrived()
  }

  protected onView(view: View) {
    this.parallax?.layout(view)
  }

  protected onFrame(deltaMs: number) {
    for (const encounter of this.encounters) encounter.frame?.(deltaMs)
  }

  protected stepWorld(dtMs: number) {
    const box = this.player.hurtbox()
    let near = -1
    for (let i = 0; i < this.encounters.length; i++) {
      const encounter = this.encounters[i]
      encounter.update(dtMs)
      if (near < 0 && !encounter.zone.isEmpty() && Phaser.Geom.Intersects.RectangleToRectangle(box, encounter.zone)) near = i
    }
    const encounter = this.encounters[near]
    if (near !== this.nearIndex) {
      this.encounters[this.nearIndex]?.near(false)
      encounter?.near(true)
      this.nearIndex = near
      // The Datenkrake does not wait for a key.
      if (encounter?.auto) {
        this.showPrompt(null)
        this.engaged = encounter
        encounter.interact()
        return
      }
    }
    this.showPrompt(encounter && !encounter.auto && !encounter.talking() ? encounter : null)
    if (encounter && !encounter.auto && this.pressed('up')) {
      this.showPrompt(null)
      this.engaged = encounter
      encounter.interact()
      return
    }
    if (Phaser.Geom.Intersects.RectangleToRectangle(box, this.exit)) this.leave((director) => director.leaveWaystation())
  }

  // The key follows the binding of 'up', so the text is set again after a binding change.
  private showPrompt(encounter: Encounter | null) {
    const prompt = this.prompt
    if (!prompt) return
    if (encounter === this.promptFor && this.promptBindings === this.ctx.bindingsVersion) return
    this.promptFor = encounter
    this.promptBindings = this.ctx.bindingsVersion
    if (!encounter) {
      prompt.setVisible(false)
      return
    }
    const binding = this.ctx.bindings.up[0]
    prompt
      .setText(binding ? `[${bindingLabel(binding)}] ${encounter.action}` : encounter.action)
      .setPosition(encounter.promptX, encounter.promptY)
      .setVisible(true)
  }

  protected onStoreClosed() {
    this.engaged?.closed()
    this.engaged = null
  }

  protected onDatenkrakeClosed() {
    this.engaged?.closed()
    this.engaged = null
  }

  protected onShutdown() {
    this.encounters = []
    this.engaged = null
    this.prompt = null
    this.promptFor = null
  }
}
