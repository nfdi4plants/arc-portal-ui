import Phaser from 'phaser'
import { DEPTH, PALETTE, PLAYER_HEIGHT, SCENE, TILE } from '../../contracts/constants'
import type { MonsterSpec } from '../../contracts/content'
import type { Segment } from '../../contracts/run'
import { monsterFromAnnotation } from '../../model/content'
import { applySpriteRef, carrier, doorArt, minionArtSpec, prewarm, prewarmEffects, releaseMonsters } from '../art'
import { spawnMob, updatePickups, type Mob, type MobDeps } from '../mobs'
import { markOneWay } from '../player/Player'
import type { View } from '../view'
import type { RunContext } from './context'
import { GameplayScene, type LevelSetup } from './GameplayScene'
import { addParallax, addTiles, type Parallax } from './levelArt'
import { generateStretch, type StretchLayout } from './levelGen'
import { PIT_KILLER } from './RunDirector'
import { createKrakenIntern, type KrakenIntern } from './intern'
import { createRescueFrame, rescueAt, rescueSpot } from './rescue'
import { ENTER_ACTION, portalOffer } from './interaction'
import { addText, plural } from './ui'

const T = TILE
const BANNER_MS = 1500
const PIT_DAMAGE = 0.15
// Mobs spawn, wake and sleep by their distance to the camera centre, in view widths.
const AWAKE_VIEWS = 1.5
// Monster textures drawn per frame during the banner.
const PREWARM_PER_FRAME = 2

interface MobSlot {
  spec: MonsterSpec
  x: number
  y: number
  mob: Mob | null
  asleep: boolean
  gone: boolean
}

// One step of the path: a generated walk from the left to the boss door on the right.
export class StretchScene extends GameplayScene {
  private segment!: Segment
  private layout!: StretchLayout
  private parallax!: Parallax
  private mobDeps!: MobDeps
  private slots: MobSlot[] = []
  private statics: Phaser.Physics.Arcade.StaticBody[] = []
  private specs: MonsterSpec[] = []
  private prewarmed = 0
  private safeX = 0
  private safeY = 0
  private readonly door = new Phaser.Geom.Rectangle()
  // The pit rescue in progress, -1 when none runs. It advances with the world steps, so a pause,
  // a level-up or a hit-stop holds it.
  private rescueMs = -1
  private readonly rescue = createRescueFrame()
  private rescueStage: 'carry' | 'released' | 'vulnerable' = 'carry'
  private readonly rescueSpot = { x: 0, y: 0 }
  private cloud: Phaser.GameObjects.Sprite | null = null
  // Deprecated jump(): the kraken intern bridges the holes and lifts the mage up the steps.
  private intern: KrakenIntern | null = null

  constructor(ctx: RunContext) {
    super(SCENE.stretch, ctx)
  }

  protected buildLevel(data: { index?: number }): LevelSetup {
    const index = data.index ?? 0
    this.segment = this.director.segment(index)
    const layout = generateStretch(this.segment, this.director.plan.seed)
    this.layout = layout
    const art = this.ctx.art
    const tiles = art.tiles(this, layout.theme)
    const left = -T
    const right = layout.width + T
    this.parallax = addParallax(this, art, tiles.background, left, right)
    this.parallax.layout(this.view)

    const statics: Phaser.Physics.Arcade.StaticBody[] = []
    this.statics = statics
    for (const g of layout.grounds) {
      statics.push(this.physics.add.staticBody(g.x, g.top, g.w, layout.groundBottom - g.top))
      addTiles(this, art, tiles.ground, g.x, g.top, g.w, T)
      addTiles(this, art, tiles.wall, g.x, g.top + T, g.w, layout.groundBottom - g.top - T).setAlpha(0.55)
    }
    for (const p of layout.platforms) {
      const body = this.physics.add.staticBody(p.x, p.top, p.w, 8)
      markOneWay(body)
      statics.push(body)
      addTiles(this, art, tiles.platform, p.x, p.top, p.w, 8)
    }
    const wallTop = layout.top - 16 * T
    for (const x of [left, layout.width]) {
      statics.push(this.physics.add.staticBody(x, wallTop, T, layout.groundBottom - wallTop))
      addTiles(this, art, tiles.wall, x, wallTop, T, layout.groundBottom - wallTop)
    }

    const { door } = layout
    this.door.setTo(door.x, door.y, door.w, door.h)
    const doorRef = doorArt(this, door.w, door.h)
    const doorSprite = this.add.sprite(door.x + door.w / 2, door.y + door.h, doorRef.textureKey).setDepth(DEPTH.tiles + 1)
    applySpriteRef(doorSprite, doorRef)
    addText(this, this.segment.toNodeId, 8, { color: PALETTE.navy, bold: true, align: 'center' })
      .setOrigin(0.5, 1)
      .setPosition(door.x + door.w / 2, door.y - 4)
      .setDepth(DEPTH.tiles + 1)

    this.specs = this.segment.annotations.map((annotation) => monsterFromAnnotation(annotation, this.segment.index))
    // The previous stretch's mobs went down with its scene, so nothing displays these textures now.
    releaseMonsters(this, new Set(this.specs.map((spec) => spec.id)))
    this.slots = this.specs.map((spec, i) => ({ spec, ...layout.spawns[i], mob: null, asleep: false, gone: false }))
    this.prewarmed = 0
    this.rescueMs = -1
    this.cloud = null
    this.safeX = layout.start.x
    this.safeY = layout.start.y

    return {
      colliders: [statics],
      spawn: layout.start,
      bounds: { x: left, y: wallTop, width: right - left, height: 3 * T - wallTop },
    }
  }

  protected setup() {
    this.mobDeps = {
      combat: this.combat,
      art: this.ctx.art,
      player: this.player,
      colliders: [this.statics],
      rng: this.director.rng.fork(`mobs/${this.segment.index}`),
    }
    this.intern = this.director.build.corrupted.includes('deprecatedJump') ? createKrakenIntern(this, this.player, this.layout, this.director) : null
    const { segment } = this
    const dataset = segment.datasetId.replace(/\/+$/, '')
    this.showIntro(
      `${dataset} · ${segment.processName} · ${plural(segment.annotations.length, 'annotation')}`,
      `Step ${segment.index + 1} of ${this.director.plan.segments.length}: ${segment.fromNodeId} to ${segment.toNodeId}`,
      BANNER_MS,
    )
  }

  protected onView(view: View) {
    this.parallax?.layout(view)
  }

  // Monster art is drawn behind the banner, a few per frame, so no frame stalls. A summoner's
  // minion art goes with its summoner, and the effects, projectiles and the pit rescue cloud come
  // on the first frame.
  protected onBannerFrame() {
    if (this.prewarmed === 0) {
      prewarmEffects(this)
      carrier(this)
    }
    if (this.prewarmed >= this.specs.length) return
    const next = Math.min(this.specs.length, this.prewarmed + PREWARM_PER_FRAME)
    const batch = this.specs.slice(this.prewarmed, next)
    prewarm(this, batch)
    prewarm(this, batch.filter((spec) => spec.passive.kind === 'summoner').map(minionArtSpec))
    this.prewarmed = next
  }

  protected onBannerDone() {
    if (this.prewarmed < this.specs.length) prewarm(this, this.specs.slice(this.prewarmed))
    this.prewarmed = this.specs.length
  }

  protected onFrame(deltaMs: number) {
    this.intern?.frame(deltaMs)
    // Spawning waits for the art drawn behind the banner.
    if (this.prewarmed < this.specs.length) return
    const centre = this.cameras.main.midPoint.x
    const reach = AWAKE_VIEWS * this.view.width
    for (const slot of this.slots) {
      if (slot.gone) continue
      const x = slot.mob ? slot.mob.position().x : slot.x
      const near = Math.abs(x - centre) <= reach
      if (!slot.mob) {
        if (!near) continue
        slot.mob = spawnMob(this, slot.spec, this.mobDeps, slot.x, slot.y)
      } else if (slot.asleep === near) {
        slot.asleep = !near
        slot.mob.setAsleep(slot.asleep)
      }
    }
  }

  protected stepWorld(dtMs: number) {
    for (const slot of this.slots) {
      const mob = slot.mob
      if (!mob || slot.asleep || slot.gone) continue
      mob.update(dtMs)
      if (mob.isGone()) {
        mob.destroy()
        slot.gone = true
      }
    }
    const fragments = updatePickups(this, this.player, dtMs)
    if (fragments > 0) this.gainFragments(fragments)
    if (this.rescueMs >= 0) {
      this.stepRescue(dtMs)
      return
    }

    const feet = this.player.position()
    if (feet.y > this.layout.pitY) {
      this.fallIntoPit()
      return
    }
    if (this.intern?.step(dtMs, this.heldDirection())) {
      this.showPrompt(null)
      return
    }
    if (this.player.isGrounded()) {
      this.safeX = feet.x
      this.safeY = feet.y
    }
    // The door leads on only on the interact key, so a mage chasing a mob past it stays.
    const offer = portalOffer(Phaser.Geom.Intersects.RectangleToRectangle(this.player.hurtbox(), this.door), true)
    const door = this.door
    this.showPrompt(offer === 'enter' ? ENTER_ACTION : null, door.centerX, door.y - 16)
    if (offer === 'enter' && this.interactPressed()) this.leave((director) => director.completeStretch())
  }

  // The pit costs hp first. If the mage lives, the cloud carries it back down onto the last safe
  // ground instead of dropping it there at once, so it does not run straight into the pit again.
  private fallIntoPit() {
    if (this.hurtByHazard(PIT_DAMAGE, PIT_KILLER)) return
    const spot = this.safeSpot()
    this.rescueSpot.x = spot.x
    this.rescueSpot.y = spot.y
    this.rescueMs = 0
    this.rescueStage = 'carry'
    // Unregistered, nothing in the combat world can hit the mage while it hangs on the rope.
    this.combat.unregister(this.player)
    if (!this.cloud) {
      const ref = carrier(this)
      this.cloud = this.add.sprite(0, 0, ref.textureKey).setDepth(DEPTH.player + 1)
      applySpriteRef(this.cloud, ref)
    }
    this.cloud.setVisible(true)
    this.stepRescue(0)
  }

  // The scene unfreezes the player at the start of every step, so the carry freezes it again
  // here, before the player's own step runs, and holds it on the rope with a teleport.
  private stepRescue(dtMs: number) {
    this.rescueMs += dtMs
    const frame = rescueAt(this.rescue, this.rescueMs)
    const { x, y } = this.rescueSpot
    const cloud = this.cloud
    if (!frame.released) {
      this.player.setFrozen(true)
      this.player.teleport(x + frame.sway, y - frame.lift)
      cloud?.setPosition(x + frame.sway, y - frame.lift - PLAYER_HEIGHT + 2)
    } else {
      // Presses made on the rope must not fire the moment the mage lands.
      if (this.rescueStage === 'carry') {
        this.rescueStage = 'released'
        this.player.discardBufferedInput()
      }
      cloud?.setPosition(x + frame.cloudDx, y - PLAYER_HEIGHT + 2 + frame.cloudDy).setAlpha(frame.cloudAlpha)
    }
    if (frame.vulnerable && this.rescueStage !== 'vulnerable') {
      this.rescueStage = 'vulnerable'
      this.combat.register(this.player)
    }
    if (frame.done) {
      this.rescueMs = -1
      cloud?.setVisible(false).setAlpha(1)
    }
  }

  // The last ground the player stood on: the middle of a stepping stone, or well away from the
  // edges of wider ground, so the player does not land on the lip of the same pit again.
  private safeSpot(): { x: number; y: number } {
    return rescueSpot([...this.layout.grounds, ...this.layout.platforms], this.safeX, this.safeY)
  }

  protected inspectableMobs(): Mob[] {
    const mobs: Mob[] = []
    for (const slot of this.slots) if (slot.mob && !slot.gone && !slot.asleep) mobs.push(slot.mob)
    return mobs
  }

  protected inspectSegment(): Segment {
    return this.segment
  }

  protected onShutdown() {
    for (const slot of this.slots) if (!slot.gone) slot.mob?.destroy()
    this.slots = []
    this.intern = null
  }
}
