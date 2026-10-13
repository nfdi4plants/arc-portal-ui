import type { KillerInfo } from '../../contracts/combat'
import type { BossSpec, FinalBossSpec } from '../../contracts/content'
import type { GameEvent } from '../../contracts/events'
import type { PlayerBuild, PowerUpCard } from '../../contracts/progression'
import { createRng, type Rng } from '../../contracts/rng'
import type { RunPlan, Segment } from '../../contracts/run'
import { bossFromNode, finalBossFromPlan } from '../../model/content'
import { addXp, applyCard, createBuild, rollOffer } from '../../model/progression'

export type RunStage =
  | { kind: 'stretch'; index: number }
  | { kind: 'boss'; index: number }
  | { kind: 'finalBoss' }
  | { kind: 'victory' }
  | { kind: 'dead'; killer: KillerInfo }

export interface RunDirectorHooks {
  emit(event: GameEvent): void
  // Switches the scenes for the new stage.
  enter(stage: RunStage): void
}

export const PIT_KILLER: KillerInfo = { kind: 'hazard', label: 'A gap in the provenance' }

// The state of one run, free of Phaser. Scenes come and go per stage. The build, the run rng and
// the clock live here, so they carry over from one scene to the next.
export class RunDirector {
  readonly plan: RunPlan
  readonly rng: Rng
  build: PlayerBuild = createBuild()
  stage: RunStage = { kind: 'stretch', index: 0 }
  elapsedMs = 0
  // Levels gained whose card has not been chosen yet.
  pendingLevelUps = 0
  private readonly hooks: RunDirectorHooks
  private readonly bossSpecs = new Map<number, BossSpec>()
  private finalSpec: FinalBossSpec | null = null

  constructor(plan: RunPlan, hooks: RunDirectorHooks) {
    this.plan = plan
    this.hooks = hooks
    this.rng = createRng(plan.seed).fork('run')
  }

  start(): void {
    this.hooks.emit({ type: 'runStarted', plan: this.plan })
    this.enter(this.plan.segments.length > 0 ? { kind: 'stretch', index: 0 } : { kind: 'finalBoss' })
  }

  segment(index: number): Segment {
    return this.plan.segments[index]
  }

  // A fork per boss, so the spec stays the same whatever the offers drew before.
  bossSpec(index: number): BossSpec {
    let spec = this.bossSpecs.get(index)
    if (!spec) {
      spec = bossFromNode(this.plan.nodes[index + 1], this.segment(index), this.rng.fork(`boss/${index}`))
      this.bossSpecs.set(index, spec)
    }
    return spec
  }

  finalBossSpec(): FinalBossSpec {
    this.finalSpec ??= finalBossFromPlan(this.plan, this.rng.fork('finalBoss'))
    return this.finalSpec
  }

  // The node the player is heading for or fighting. nodes.length means the final boss.
  currentNodeIndex(): number {
    const stage = this.stage
    if (stage.kind === 'stretch' || stage.kind === 'boss') return stage.index + 1
    return this.plan.nodes.length
  }

  isOver(): boolean {
    return this.stage.kind === 'dead' || this.stage.kind === 'victory'
  }

  tick(dtMs: number): void {
    if (!this.isOver()) this.elapsedMs += dtMs
  }

  // The player object keeps the live hp. Scenes write it back before the build changes.
  setHp(hp: number): void {
    this.build = { ...this.build, hp }
  }

  // Returns the number of levels gained. Each one waits for a card choice.
  creditXp(amount: number): number {
    if (amount <= 0 || this.isOver()) return 0
    const before = this.build.level
    const { build, levelsGained } = addXp(this.build, amount)
    this.build = build
    this.pendingLevelUps += levelsGained
    for (let level = before + 1; level <= build.level; level++) this.hooks.emit({ type: 'levelUp', level })
    return levelsGained
  }

  rollOffer(): PowerUpCard[] {
    return rollOffer(this.build, this.rng)
  }

  // Null skips a level whose offer came out empty.
  chooseCard(cardId: string | null): void {
    if (cardId) this.build = applyCard(this.build, cardId)
    this.pendingLevelUps = Math.max(0, this.pendingLevelUps - 1)
  }

  completeStretch(): void {
    const stage = this.stage
    if (stage.kind === 'stretch') this.enter({ kind: 'boss', index: stage.index })
  }

  defeatBoss(): void {
    const stage = this.stage
    if (stage.kind !== 'boss') return
    const next = stage.index + 1
    this.enter(next < this.plan.segments.length ? { kind: 'stretch', index: next } : { kind: 'finalBoss' })
  }

  defeatFinalBoss(): void {
    if (this.stage.kind === 'finalBoss') this.enter({ kind: 'victory' })
  }

  die(killer: KillerInfo): void {
    if (!this.isOver()) this.enter({ kind: 'dead', killer })
  }

  private enter(stage: RunStage): void {
    this.stage = stage
    if (stage.kind === 'stretch') this.hooks.emit({ type: 'segmentEntered', segment: this.segment(stage.index) })
    else if (stage.kind === 'boss') this.hooks.emit({ type: 'bossEntered', boss: this.bossSpec(stage.index) })
    else if (stage.kind === 'finalBoss') this.hooks.emit({ type: 'bossEntered', boss: this.finalBossSpec() })
    this.hooks.enter(stage)
  }
}
