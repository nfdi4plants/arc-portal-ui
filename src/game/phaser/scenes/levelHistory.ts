import type { Rarity } from '../../contracts/progression'
import type { RunPlan } from '../../contracts/run'

// The record of the cards a run has chosen, one entry per level gained. Free of Phaser.

export interface OfferedCard {
  id: string
  name: string
}

export interface LevelUpRecord {
  level: number
  // Null when the offer was empty and the level passed without a card.
  cardId: string | null
  cardName: string | null
  rarity: Rarity | null
  // The cards that were on offer and not chosen.
  offered: OfferedCard[]
  // Where the XP that triggered the level came from, for example "earned in assays/RNASeq · illumina".
  source: string
}

export interface SourceStage {
  kind: 'stretch' | 'boss' | 'finalBoss' | 'victory' | 'dead'
  index?: number
}

export function sourceText(stage: SourceStage, plan: RunPlan, bossLabel: string): string {
  if (stage.kind === 'stretch' || stage.kind === 'boss') {
    const segment = plan.segments[stage.index ?? 0]
    const step = segment ? `${segment.datasetId.replace(/\/+$/, '')} · ${segment.processName}` : 'an unknown step'
    return stage.kind === 'stretch' ? `earned in ${step}` : `earned against boss ${bossLabel} after ${step}`
  }
  if (stage.kind === 'finalBoss') return 'earned against the final boss'
  return 'earned at the end of the run'
}

// Entries stay in level order whatever order they arrive in.
export function appendLevelUp(history: readonly LevelUpRecord[], record: LevelUpRecord): LevelUpRecord[] {
  const next = [...history, record]
  next.sort((a, b) => a.level - b.level)
  return next
}

export interface HistoryRow {
  title: string
  source: string
  // Null when nothing else was offered.
  also: string | null
}

export function historyRow(record: LevelUpRecord): HistoryRow {
  const title = record.cardName ? `Lv ${record.level} · ${record.cardName}${record.rarity ? ` (${record.rarity})` : ''}` : `Lv ${record.level} · no card on offer`
  const also = record.offered.length > 0 ? `also offered: ${record.offered.map((card) => card.name).join(', ')}` : null
  return { title, source: record.source, also }
}

// Cuts a line to `maxChars` with an ellipsis, for rows of a fixed height.
export function fitLine(text: string, maxChars: number): string {
  return text.length <= maxChars ? text : `${text.slice(0, Math.max(1, maxChars - 1)).trimEnd()}…`
}
