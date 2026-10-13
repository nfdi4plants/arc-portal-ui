import { SCENE } from '../../contracts/constants'
import type { Combatant } from '../../contracts/combat'
import { prewarmTelegraphs, releaseTelegraphs } from '../art'
import { spawnFinalBoss, type Arena, type FinalBoss } from '../bosses'
import type { View } from '../view'
import { buildArena } from './arena'
import type { RunContext } from './context'
import { GameplayScene, type LevelSetup } from './GameplayScene'
import type { Parallax } from './levelArt'
import { plural } from './ui'

const BANNER_MS = 1800
const PHASE_BANNER_MS = 1600
const OUTRO_MS = 1600

// The ARC itself, one phase per segment of the path.
export class FinalBossScene extends GameplayScene {
  private arena!: Arena
  private parallax!: Parallax
  private boss: FinalBoss | null = null
  private outroMs = -1

  constructor(ctx: RunContext) {
    super(SCENE.finalBoss, ctx)
  }

  protected buildLevel(): LevelSetup {
    this.outroMs = -1
    const spec = this.director.finalBossSpec()
    const theme = spec.phases[0]?.datasetKind ?? 'study'
    const built = buildArena(this, this.ctx.art, theme, this.view)
    this.arena = built.arena
    this.parallax = built.parallax
    return built.setup
  }

  protected setup() {
    const { plan } = this.director
    const spec = this.director.finalBossSpec()
    prewarmTelegraphs(this)
    const deps = { combat: this.combat, art: this.ctx.art, player: this.player, rng: this.director.rng.fork('finalBossFight') }
    const boss = spawnFinalBoss(this, spec, plan, deps, this.arena)
    this.boss = boss
    this.combat.on('kill', (event) => {
      if (event.target === boss) this.spareAfterBoss(boss)
    })
    if (this.ctx.active) {
      this.ctx.active.boss = boss
      this.ctx.active.bossName = spec.title
    }
    boss.onPhaseChange((phase) => this.ctx.hud?.showBanner(this.phaseLine(phase), `Phase ${phase + 1} of ${spec.phases.length}`, PHASE_BANNER_MS))
    this.showIntro(spec.title, this.phaseLine(0), BANNER_MS)
  }

  private phaseLine(phase: number): string {
    const { plan } = this.director
    const segment = plan.segments[this.director.finalBossSpec().phases[phase]?.segmentIndex ?? -1]
    return segment ? `${segment.processName} · ${plural(segment.annotations.length, 'annotation')}` : ''
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
        this.spareAfterBoss(boss)
        this.outroMs = OUTRO_MS
      }
      return
    }
    this.outroMs -= dtMs
    if (this.outroMs <= 0) this.leave((director) => director.defeatFinalBoss())
  }

  protected onShutdown() {
    this.boss?.destroy()
    this.boss = null
    releaseTelegraphs(this)
  }
}
