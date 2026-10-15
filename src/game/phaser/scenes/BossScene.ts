import Phaser from 'phaser'
import { SCENE, TILE } from '../../contracts/constants'
import type { Combatant } from '../../contracts/combat'
import type { BossSpec } from '../../contracts/content'
import type { Segment } from '../../contracts/run'
import { bossFragmentDrop } from '../../model/progression'
import { prewarmTelegraphs, releaseTelegraphs } from '../art'
import { spawnBoss, type Arena, type Boss } from '../bosses'
import type { InspectTarget } from '../mobs'
import { dropOntologyFragments, updatePickups } from '../mobs/pickups'
import type { View } from '../view'
import { buildArena } from './arena'
import { createBossPortal, prewarmBossPortal, type BossPortal } from './bossPortal'
import { PORTAL_SPAWN_MS } from './portalSpawn'
import { ENTER_ACTION, portalOffer } from './interaction'
import type { RunContext } from './context'
import { GameplayScene, type LevelSetup } from './GameplayScene'
import type { Parallax } from './levelArt'
import { portalLabel } from './RunDirector'
import { plural } from './ui'

const T = TILE
const BANNER_MS = 1600

// The fight against the node at the end of a segment. The beaten boss leaves a portal behind, and
// the run goes on to the waystation when the player enters it with the interact key.
export class BossScene extends GameplayScene {
  private segment!: Segment
  private spec!: BossSpec
  private arena!: Arena
  private parallax!: Parallax
  private boss: Boss | null = null
  // -1 while the fight runs, then the time since the portal began to form.
  private portalMs = -1
  private portal: BossPortal | null = null

  constructor(ctx: RunContext) {
    super(SCENE.boss, ctx)
  }

  protected buildLevel(data: { index?: number }): LevelSetup {
    const index = data.index ?? 0
    this.segment = this.director.segment(index)
    this.spec = this.director.bossSpec(index)
    this.portalMs = -1
    this.portal = null
    const built = buildArena(this, this.ctx.art, this.segment.datasetKind, this.view)
    this.arena = built.arena
    this.parallax = built.parallax
    return built.setup
  }

  protected setup() {
    const { spec, segment } = this
    prewarmTelegraphs(this)
    // Drawn now, so the portal does not stall the frame it appears in.
    prewarmBossPortal(this)
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

  // The boss can be inspected in the pause menu like a mob, until it falls.
  protected inspectableMobs(): InspectTarget[] {
    return this.boss && this.portalMs < 0 ? [this.boss] : []
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
        this.openPortal()
        this.dropBossFragments(boss.position().x)
        this.gainXp(this.spec.xp)
      }
      return
    }
    this.portalMs += dtMs
    const fragments = updatePickups(this, this.player, dtMs)
    if (fragments > 0) this.gainFragments(fragments)
    // Nothing happens while the portal forms. Once it is open, the prompt shows over it and the
    // interact key takes a mage inside it through.
    const portal = this.portal
    if (!portal) return
    const offer = portalOffer(Phaser.Geom.Intersects.RectangleToRectangle(this.player.hurtbox(), portal.box), this.portalMs >= PORTAL_SPAWN_MS)
    this.showPrompt(offer === 'enter' ? ENTER_ACTION : null, portal.box.centerX, portal.promptY)
    if (offer === 'enter' && this.interactPressed()) this.leave((director) => director.defeatBoss())
  }

  // The portal animates with the world: a pause, the level-up screen or a hit-stop hold it.
  protected onFrame() {
    if (this.portal && this.portalMs >= 0) this.portal.update(this.portalMs)
  }

  // A guaranteed handful, spread over the floor where the boss fell.
  private dropBossFragments(bossX: number) {
    const index = this.segment.index
    const count = bossFragmentDrop(index, this.director.rng.fork(`bossFragments/${index}`))
    const x = Phaser.Math.Clamp(bossX, this.arena.left + 2 * T, this.arena.right - 2 * T)
    dropOntologyFragments(this, x, this.arena.floorY - 10, count)
  }

  // Always in the middle of the arena, wherever the boss fell, and it takes a few seconds to form,
  // so the mage has time to pick up the fragments and never goes through by chance. The sign names
  // the waystation and the step after it.
  private openPortal() {
    this.portalMs = 0
    const { arena } = this
    const sign = { title: 'To the waystation', detail: portalLabel(this.director.plan, this.segment.index).title }
    this.portal = createBossPortal(this, (arena.left + arena.right) / 2, arena.floorY, sign)
  }

  protected onShutdown() {
    this.boss?.destroy()
    this.boss = null
    this.portal = null
    releaseTelegraphs(this)
  }
}
