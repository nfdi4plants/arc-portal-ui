import type { KillerInfo } from '../../contracts/combat'
import type { BossSpec, FinalBossSpec } from '../../contracts/content'
import type { GameEvent } from '../../contracts/events'
import type { PlayerBuild, PowerUpCard } from '../../contracts/progression'
import { createRng, type Rng } from '../../contracts/rng'
import type { RunPlan, Segment } from '../../contracts/run'
import { bossFromNode, finalBossFromPlan } from '../../model/content'
import { appendLevelUp, sourceText, storeSourceText, type LevelUpRecord } from './levelHistory'
import { addXp, applyCard, buyCard, createBossCharge, createBuild, createLinePicker, priceOf, rollOffer, rollStock, TRADER_LINES } from '../../model/progression'
import type { BossCharge, TraderMood } from '../../model/progression'

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

export interface PortalLabel {
  title: string
  detail: string
}

function lastPart(id: string): string {
  return id.split('/').filter(Boolean).pop() ?? id
}

// The sign over the portal that opens when node boss `index` falls. It names the next part of the
// path: the process of the next step and where it leads, or the ARC itself after the last node.
export function portalLabel(plan: RunPlan, index: number): PortalLabel {
  const next = plan.segments[index + 1]
  if (!next) return { title: `Next: ${plan.arcTitle || 'the ARC'}`, detail: 'The final boss' }
  return {
    title: `Next: ${next.processName}`,
    detail: `Step ${next.index + 1} of ${plan.segments.length}: ${lastPart(next.fromNodeId)} to ${lastPart(next.toNodeId)}`,
  }
}

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
  // Second Wind heals once, then waits for the next boss to fall. It lives here, so leaving a
  // stretch or a boss arena keeps it spent.
  readonly secondWind: BossCharge = createBossCharge()
  // Coins for the FAIR trade store. They carry over from one stage to the next and a pit costs none.
  coins = 0
  private readonly hooks: RunDirectorHooks
  // The stock of the trader after each node boss, rolled on the first visit and fixed from then on.
  private readonly stocks = new Map<number, PowerUpCard[]>()
  private readonly traderLines: Record<TraderMood, () => string>
  private history: LevelUpRecord[] = []
  private lastOffer: PowerUpCard[] = []
  private readonly bossSpecs = new Map<number, BossSpec>()
  private finalSpec: FinalBossSpec | null = null

  constructor(plan: RunPlan, hooks: RunDirectorHooks) {
    this.plan = plan
    this.hooks = hooks
    this.rng = createRng(plan.seed).fork('run')
    const lines = this.rng.fork('trader')
    this.traderLines = {
      greeting: createLinePicker(TRADER_LINES.greeting, lines.fork('greeting')),
      goodbye: createLinePicker(TRADER_LINES.goodbye, lines.fork('goodbye')),
      bought: createLinePicker(TRADER_LINES.bought, lines.fork('bought')),
      poor: createLinePicker(TRADER_LINES.poor, lines.fork('poor')),
      unusable: createLinePicker(TRADER_LINES.unusable, lines.fork('unusable')),
    }
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

  // The cards chosen so far, in level order. A new run starts with a new director, so it starts empty.
  get levelHistory(): readonly LevelUpRecord[] {
    return this.history
  }

  rollOffer(): PowerUpCard[] {
    this.lastOffer = rollOffer(this.build, this.rng)
    return this.lastOffer
  }

  // Null skips a level whose offer came out empty.
  chooseCard(cardId: string | null): void {
    if (this.pendingLevelUps > 0) this.recordLevelUp(cardId)
    if (cardId) this.build = applyCard(this.build, cardId)
    this.pendingLevelUps = Math.max(0, this.pendingLevelUps - 1)
  }

  private recordLevelUp(cardId: string | null): void {
    const chosen = cardId ? this.lastOffer.find((card) => card.id === cardId) : undefined
    const stage = this.stage
    const bossLabel = stage.kind === 'boss' ? this.bossSpec(stage.index).label : ''
    this.history = appendLevelUp(this.history, {
      level: this.build.level - this.pendingLevelUps + 1,
      cardId,
      cardName: cardId ? (chosen?.name ?? cardId) : null,
      rarity: chosen?.rarity ?? null,
      offered: this.lastOffer.filter((card) => card.id !== cardId).map((card) => ({ id: card.id, name: card.name })),
      source: sourceText(stage, this.plan, bossLabel),
    })
    this.lastOffer = []
  }

  addCoins(amount: number): void {
    if (amount > 0 && !this.isOver()) this.coins += amount
  }

  // The cards the trader of node boss `index` still has. Rolled against the build of the first
  // visit, with a fork of its own, so leaving and coming back shows the same cards.
  stock(index: number): readonly PowerUpCard[] {
    let stock = this.stocks.get(index)
    if (!stock) {
      stock = rollStock(this.build, this.rng.fork(`store/${index}`))
      this.stocks.set(index, stock)
    }
    return stock
  }

  traderLine(mood: TraderMood): string {
    return this.traderLines[mood]()
  }

  // Buys a card from the trader of node boss `index`. Only the card applies: the level, the XP and
  // the hp stay as they are. False when the card is not in stock, too dear or of no use now.
  buy(index: number, cardId: string): boolean {
    const stock = this.stocks.get(index)
    const card = stock?.find((entry) => entry.id === cardId)
    if (!stock || !card) return false
    const result = buyCard(this.build, this.coins, card)
    if (!result) return false
    this.build = result.build
    this.coins = result.coins
    stock.splice(stock.indexOf(card), 1)
    this.history = appendLevelUp(this.history, {
      level: this.build.level,
      cardId: card.id,
      cardName: card.name,
      rarity: card.rarity,
      offered: [],
      source: storeSourceText(this.plan, index, this.bossSpec(index).label),
      price: priceOf(card),
    })
    return true
  }

  completeStretch(): void {
    const stage = this.stage
    if (stage.kind === 'stretch') this.enter({ kind: 'boss', index: stage.index })
  }

  defeatBoss(): void {
    const stage = this.stage
    if (stage.kind !== 'boss') return
    this.secondWind.recharge()
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
    else if (stage.kind === 'finalBoss') {
      // A player who barely beat the last node boss would otherwise start the hardest fight nearly dead.
      this.build = { ...this.build, hp: this.build.stats.maxHp }
      this.secondWind.recharge()
      this.hooks.emit({ type: 'bossEntered', boss: this.finalBossSpec() })
    }
    this.hooks.enter(stage)
  }
}
