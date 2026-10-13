import { SCENE } from '../../contracts/constants'
import type { Combatant } from '../../contracts/combat'
import type { BossSpec } from '../../contracts/content'
import type { Segment } from '../../contracts/run'
import { spawnBoss, type Arena, type Boss } from '../bosses'
import type { View } from '../view'
import { buildArena } from './arena'
import type { RunContext } from './context'
import { GameplayScene, type LevelSetup } from './GameplayScene'
import type { Parallax } from './levelArt'
import { plural } from './ui'

const BANNER_MS = 1600
// Time between the last hit and the next stretch, to see the boss fall.
const OUTRO_MS = 1400

// The fight against the node at the end of a segment.
export class BossScene extends GameplayScene {
  private segment!: Segment
  private spec!: BossSpec
  private arena!: Arena
  private parallax!: Parallax
  private boss: Boss | null = null
  private outroMs = -1

  constructor(ctx: RunContext) {
    super(SCENE.boss, ctx)
  }

  protected buildLevel(data: { index?: number }): LevelSetup {
    const index = data.index ?? 0
    this.segment = this.director.segment(index)
    this.spec = this.director.bossSpec(index)
    this.outroMs = -1
    const built = buildArena(this, this.ctx.art, this.segment.datasetKind, this.view)
    this.arena = built.arena
    this.parallax = built.parallax
    return built.setup
  }

  protected setup() {
    const { spec, segment } = this
    const deps = { combat: this.combat, art: this.ctx.art, player: this.player, rng: this.director.rng.fork(`bossFight/${segment.index}`) }
    const boss = spawnBoss(this, spec, segment, deps, this.arena)
    this.boss = boss
    this.enemies.push(boss)
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
    if (this.outroMs < 0) {
      boss.update(dtMs)
      if (boss.isDefeated()) {
        this.outroMs = OUTRO_MS
        this.gainXp(this.spec.xp)
      }
      return
    }
    this.outroMs -= dtMs
    if (this.outroMs <= 0) this.leave((director) => director.defeatBoss())
  }

  protected onShutdown() {
    this.boss?.destroy()
    this.boss = null
  }
}
