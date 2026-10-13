import Phaser from 'phaser'
import { DEPTH, PALETTE, SCENE, TILE } from '../../contracts/constants'
import type { MonsterSpec } from '../../contracts/content'
import type { Segment } from '../../contracts/run'
import { monsterFromAnnotation } from '../../model/content'
import { applySpriteRef, doorArt, minionArtSpec, prewarm, prewarmEffects, releaseMonsters } from '../art'
import { spawnMob, updatePickups, type Mob, type MobDeps } from '../mobs'
import { markOneWay } from '../player/Player'
import type { View } from '../view'
import type { RunContext } from './context'
import { GameplayScene, type LevelSetup } from './GameplayScene'
import { addParallax, addTiles, type Parallax } from './levelArt'
import { generateStretch, type StretchLayout } from './levelGen'
import { PIT_KILLER } from './RunDirector'
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
  // minion art goes with its summoner, and the effects and projectiles come on the first frame.
  protected onBannerFrame() {
    if (this.prewarmed === 0) prewarmEffects(this)
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

  protected onFrame() {
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
    updatePickups(this, this.player)

    const feet = this.player.position()
    if (feet.y > this.layout.pitY) {
      this.fallIntoPit()
      return
    }
    if (this.player.isGrounded()) {
      this.safeX = feet.x
      this.safeY = feet.y
    }
    const box = this.player.hurtbox()
    if (Phaser.Geom.Intersects.RectangleToRectangle(box, this.door)) this.leave((director) => director.completeStretch())
  }

  private fallIntoPit() {
    if (this.hurtByHazard(PIT_DAMAGE, PIT_KILLER)) return
    const spot = this.safeSpot()
    this.player.teleport(spot.x, spot.y)
  }

  // The last ground the player stood on, moved a tile in from its edges so the player does not
  // land on the lip of the same pit again.
  private safeSpot(): { x: number; y: number } {
    const surfaces = [...this.layout.grounds, ...this.layout.platforms]
    for (const s of surfaces) {
      if (Math.abs(s.top - this.safeY) > 1 || this.safeX < s.x - 2 || this.safeX > s.x + s.w + 2) continue
      const margin = Math.min(T, s.w / 2)
      return { x: Math.min(s.x + s.w - margin, Math.max(s.x + margin, this.safeX)), y: s.top }
    }
    return { x: this.safeX, y: this.safeY }
  }

  protected onShutdown() {
    for (const slot of this.slots) if (!slot.gone) slot.mob?.destroy()
    this.slots = []
  }
}
