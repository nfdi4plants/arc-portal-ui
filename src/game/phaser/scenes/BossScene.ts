import Phaser from 'phaser'
import { DEPTH, PALETTE, SCENE, TILE } from '../../contracts/constants'
import type { Combatant } from '../../contracts/combat'
import type { BossSpec } from '../../contracts/content'
import type { Segment } from '../../contracts/run'
import { bindingLabel } from '../../model/input'
import { bossCoinDrop } from '../../model/progression'
import { applySpriteRef, doorArt, prewarmTelegraphs, releaseTelegraphs, TRADER_HEIGHT, TRADER_WIDTH, traderArt } from '../art'
import { freeFloorX } from '../bosses/zones'
import { spawnBoss, type Arena, type Boss } from '../bosses'
import { acquireBubble } from '../mobs/bubbles'
import { dropCoins, updatePickups } from '../mobs/pickups'
import type { View } from '../view'
import { buildArena } from './arena'
import type { RunContext } from './context'
import { GameplayScene, type LevelSetup } from './GameplayScene'
import type { Parallax } from './levelArt'
import { portalLabel } from './RunDirector'
import { addText, plural } from './ui'
import { cssColor } from '../color'

const T = TILE
const BANNER_MS = 1600
// The portal to the next part of the path grows in after the boss has faded and opens once it is
// fully there. The door has the size of the one at the end of a stretch.
const PORTAL_APPEAR_MS = 650
const PORTAL = { w: 2 * T, h: 3 * T }
// The FAIR trader sets up the stall at least this far from the portal, so the two never overlap.
const TRADER_GAP = 3 * T
// The player trades from up to this far beyond either side of the stall.
const TRADE_REACH = T / 2
const GOODBYE_MS = 3800
const BUBBLE_WRAP = 150

// The fight against the node at the end of a segment. The beaten boss leaves a portal behind, and
// the run goes on when the player walks into it.
export class BossScene extends GameplayScene {
  private segment!: Segment
  private spec!: BossSpec
  private arena!: Arena
  private parallax!: Parallax
  private boss: Boss | null = null
  // -1 while the fight runs, then the time since the portal began to appear.
  private portalMs = -1
  private readonly portal = new Phaser.Geom.Rectangle()
  // Where the player can talk to the trader. Empty until the stall stands.
  private readonly stall = new Phaser.Geom.Rectangle()
  private prompt: Phaser.GameObjects.Text | null = null
  private bubble: Phaser.GameObjects.Text | null = null
  private bubbleMs = 0

  constructor(ctx: RunContext) {
    super(SCENE.boss, ctx)
  }

  protected buildLevel(data: { index?: number }): LevelSetup {
    const index = data.index ?? 0
    this.segment = this.director.segment(index)
    this.spec = this.director.bossSpec(index)
    this.portalMs = -1
    this.stall.setEmpty()
    this.prompt = null
    this.bubble = null
    this.bubbleMs = 0
    const built = buildArena(this, this.ctx.art, this.segment.datasetKind, this.view)
    this.arena = built.arena
    this.parallax = built.parallax
    return built.setup
  }

  protected setup() {
    const { spec, segment } = this
    prewarmTelegraphs(this)
    // Drawn now, so the portal does not stall the frame it appears in.
    doorArt(this, PORTAL.w, PORTAL.h)
    traderArt(this)
    const deps = { combat: this.combat, art: this.ctx.art, player: this.player, rng: this.director.rng.fork(`bossFight/${segment.index}`) }
    const boss = spawnBoss(this, spec, segment, deps, this.arena)
    this.boss = boss
    this.combat.on('kill', (event) => {
      if (event.target === boss) this.spareAfterBoss(boss)
    })
    if (this.ctx.active) {
      this.ctx.active.boss = boss
      this.ctx.active.bossName = spec.label
    }
    const subtitle =
      spec.quality === 0
        ? 'Undocumented step: attacks come without warning'
        : `${segment.processName} · ${plural(segment.annotations.length, 'annotation')}`
    this.showIntro(spec.label, subtitle, BANNER_MS)
  }

  protected onBannerDone() {
    this.loadout.resetFight()
  }

  protected onView(view: View) {
    this.parallax?.layout(view)
  }

  protected xpFor(target: Combatant): number {
    return target === this.boss ? 0 : super.xpFor(target)
  }

  protected stepWorld(dtMs: number) {
    const boss = this.boss
    if (!boss) return
    if (this.portalMs < 0) {
      boss.update(dtMs)
      if (boss.isDefeated()) {
        this.spareAfterBoss(boss)
        const x = boss.position().x
        this.openPortal(x)
        this.dropBossCoins(x)
        this.gainXp(this.spec.xp)
      }
      return
    }
    this.portalMs += dtMs
    const coins = updatePickups(this, this.player, dtMs)
    if (coins > 0) this.gainCoins(coins)
    this.stepBubble(dtMs)
    if (this.portalMs < PORTAL_APPEAR_MS) return
    const box = this.player.hurtbox()
    const near = Phaser.Geom.Intersects.RectangleToRectangle(box, this.stall)
    this.showPrompt(near)
    if (near && this.pressed('up')) {
      this.hideBubble()
      this.prompt?.setVisible(false)
      this.openStore(this.segment.index)
      return
    }
    if (Phaser.Geom.Intersects.RectangleToRectangle(box, this.portal)) this.leave((director) => director.defeatBoss())
  }

  // A guaranteed handful, spread over the floor where the boss fell.
  private dropBossCoins(bossX: number) {
    const index = this.segment.index
    const count = bossCoinDrop(index, this.director.rng.fork(`bossCoins/${index}`))
    const x = Phaser.Math.Clamp(bossX, this.arena.left + 2 * T, this.arena.right - 2 * T)
    dropCoins(this, x, this.arena.floorY - 10, count)
  }

  // The stall goes on the side of the portal that faces the middle of the arena, on free floor,
  // or on the other side when the free floor there is too close to the portal.
  private placeTrader(portalX: number) {
    const { arena } = this
    const toMiddle = portalX < (arena.left + arena.right) / 2 ? 1 : -1
    const offset = PORTAL.w / 2 + TRADER_GAP + TRADER_WIDTH / 2
    const clear = (x: number) => Math.abs(x - portalX) >= PORTAL.w / 2 + TRADER_WIDTH / 2 + T / 2 && x - TRADER_WIDTH / 2 >= arena.left && x + TRADER_WIDTH / 2 <= arena.right
    let x = freeFloorX(arena, portalX + toMiddle * offset, TRADER_WIDTH)
    if (!clear(x)) x = freeFloorX(arena, portalX - toMiddle * offset, TRADER_WIDTH)
    if (!clear(x)) x = portalX + toMiddle * offset
    const floor = arena.floorY
    const ref = traderArt(this)
    const sprite = this.add.sprite(x, floor, ref.textureKey).setDepth(DEPTH.tiles + 1)
    applySpriteRef(sprite, ref)
    this.stall.setTo(x - TRADER_WIDTH / 2 - TRADE_REACH, floor - TRADER_HEIGHT, TRADER_WIDTH + 2 * TRADE_REACH, TRADER_HEIGHT)
    this.prompt = addText(this, '', 7, { color: PALETTE.navy, bold: true, align: 'center' })
      .setOrigin(0.5, 1)
      .setPosition(x, floor - TRADER_HEIGHT - 4)
      .setBackgroundColor(cssColor(PALETTE.yellow))
      .setPadding(3, 1, 3, 1)
      .setDepth(DEPTH.fx)
      .setVisible(false)
    sprite.setAlpha(0)
    this.tweens.add({ targets: sprite, alpha: 1, delay: PORTAL_APPEAR_MS / 2, duration: PORTAL_APPEAR_MS / 2 })
  }

  // The key follows the binding of 'up', so the text is set each time the prompt shows.
  private showPrompt(near: boolean) {
    const prompt = this.prompt
    // The goodbye bubble has the spot over the stall while it shows.
    const shown = near && !this.bubble?.visible
    if (!prompt || prompt.visible === shown) return
    if (shown) {
      const binding = this.ctx.bindings.up[0]
      prompt.setText(binding ? `[${bindingLabel(binding)}] Trade` : 'Trade')
    }
    prompt.setVisible(shown)
  }

  protected onStoreClosed() {
    this.say(this.director.traderLine('goodbye'))
  }

  private say(line: string) {
    if (!this.bubble) {
      this.bubble = acquireBubble(this).setWordWrapWidth(BUBBLE_WRAP, true).setAlign('center')
    }
    // The bubble leans away from the portal, so it does not cover the portal's sign.
    const away = this.stall.centerX >= this.portal.centerX
    this.bubble
      .setText(line)
      .setOrigin(away ? 0.2 : 0.8, 1)
      .setPosition(this.stall.centerX, this.stall.y - 4)
      .setVisible(true)
    this.prompt?.setVisible(false)
    this.bubbleMs = GOODBYE_MS
  }

  private stepBubble(dtMs: number) {
    if (this.bubbleMs <= 0) return
    this.bubbleMs -= dtMs
    if (this.bubbleMs <= 0) this.hideBubble()
  }

  private hideBubble() {
    this.bubbleMs = 0
    this.bubble?.setVisible(false)
  }

  // The same door as at the end of a stretch, on free floor near where the boss fell, with the
  // next step of the path written over it.
  private openPortal(bossX: number) {
    this.portalMs = 0
    const x = freeFloorX(this.arena, bossX, PORTAL.w)
    const floor = this.arena.floorY
    this.portal.setTo(x - PORTAL.w / 2, floor - PORTAL.h, PORTAL.w, PORTAL.h)
    const ref = doorArt(this, PORTAL.w, PORTAL.h)
    const door = this.add.sprite(x, floor, ref.textureKey).setDepth(DEPTH.tiles + 1)
    applySpriteRef(door, ref)
    this.placeTrader(x)
    const label = portalLabel(this.director.plan, this.segment.index)
    const title = addText(this, label.title, 8, { color: PALETTE.navy, bold: true, align: 'center' })
      .setOrigin(0.5, 1)
      .setPosition(x, floor - PORTAL.h - 12)
      .setDepth(DEPTH.tiles + 1)
    const detail = addText(this, label.detail, 6, { color: PALETTE.navy, align: 'center' })
      .setOrigin(0.5, 1)
      .setPosition(x, floor - PORTAL.h - 4)
      .setDepth(DEPTH.tiles + 1)
    const { scaleX, scaleY } = door
    door.setScale(scaleX * 0.2, 0)
    this.tweens.add({ targets: door, scaleX, scaleY, duration: PORTAL_APPEAR_MS, ease: 'Back.easeOut' })
    title.setAlpha(0)
    detail.setAlpha(0)
    this.tweens.add({ targets: [title, detail], alpha: 1, delay: PORTAL_APPEAR_MS / 2, duration: PORTAL_APPEAR_MS / 2 })
  }

  protected onShutdown() {
    this.boss?.destroy()
    this.boss = null
    releaseTelegraphs(this)
  }
}
