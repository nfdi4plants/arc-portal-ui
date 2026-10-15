import type { PlayerBuild, PlayerWeaponId, Rarity } from '../../contracts/progression'
import type { RunPlan } from '../../contracts/run'
import { CARDS, corruptedAugment, createBuild, weaponName } from '../../model/progression'

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
  // Set for a card bought at the FAIR trade store. Such an entry gained no level, `level` is the
  // level it was bought at.
  price?: number
  // Set for what happened at the Datenkrake: an augment it took, the corrupted augment it gave
  // (cardId 'corrupted.<id>') or a fight it lost. Such an entry gained no level either.
  datenkrake?: DatenkrakeEvent
}

export type DatenkrakeEvent = 'taken' | 'corrupted' | 'fought'

export interface SourceStage {
  kind: 'stretch' | 'boss' | 'waystation' | 'finalBoss' | 'victory' | 'dead'
  index?: number
}

export function sourceText(stage: SourceStage, plan: RunPlan, bossLabel: string): string {
  if (stage.kind === 'stretch' || stage.kind === 'boss' || stage.kind === 'waystation') {
    const segment = plan.segments[stage.index ?? 0]
    const step = segment ? `${segment.datasetId.replace(/\/+$/, '')} · ${segment.processName}` : 'an unknown step'
    // XP of the boss credits as the boss falls, so a level chosen in the waystation still came from it.
    return stage.kind === 'stretch' ? `earned in ${step}` : `earned against boss ${bossLabel} after ${step}`
  }
  if (stage.kind === 'finalBoss') return 'earned against the final boss'
  return 'earned at the end of the run'
}

// Where a store purchase was made: the trader stands in the waystation after the boss just beaten.
export function storeSourceText(plan: RunPlan, index: number, bossLabel: string): string {
  const segment = plan.segments[index]
  const step = segment ? ` (${segment.processName})` : ''
  return `bought at the FAIR trade store in the waystation after boss ${bossLabel}${step}`
}

// Where the Datenkrake struck: in the same waystation as the trader.
export function datenkrakeSourceText(plan: RunPlan, index: number, bossLabel: string): string {
  const segment = plan.segments[index]
  const step = segment ? ` (${segment.processName})` : ''
  return `at the Datenkrake in the waystation after boss ${bossLabel}${step}`
}

// How many stacks of each stat card the run still holds: every level-up pick and purchase, less
// the ones the Datenkrake took. The build itself only knows their sum.
export function statStacks(records: readonly LevelUpRecord[]): Record<string, number> {
  const stacks: Record<string, number> = {}
  for (const record of records) {
    const id = record.cardId
    if (!id?.startsWith('stat.') || record.datenkrake === 'fought') continue
    stacks[id] = Math.max(0, (stacks[id] ?? 0) + (record.datenkrake === 'taken' ? -1 : 1))
  }
  return stacks
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
  if (record.datenkrake) return { title: datenkrakeTitle(record), source: record.source, also: null }
  if (record.price !== undefined) {
    const rarity = record.rarity ? ` (${record.rarity})` : ''
    return { title: `Bought · ${record.cardName ?? record.cardId}${rarity} · ${record.price} fragments`, source: record.source, also: null }
  }
  const title = record.cardName ? `Lv ${record.level} · ${record.cardName}${record.rarity ? ` (${record.rarity})` : ''}` : `Lv ${record.level} · no card on offer`
  const also = record.offered.length > 0 ? `also offered: ${record.offered.map((card) => card.name).join(', ')}` : null
  return { title, source: record.source, also }
}

function datenkrakeTitle(record: LevelUpRecord): string {
  if (record.datenkrake === 'fought') return 'Fought off the Datenkrake'
  if (record.datenkrake === 'taken') return `Taken by the Datenkrake: ${record.cardName ?? record.cardId}`
  return `Corrupted: ${record.cardName ?? record.cardId}`
}

// Cuts a line to `maxChars` with an ellipsis, for rows of a fixed height.
export function fitLine(text: string, maxChars: number): string {
  return text.length <= maxChars ? text : `${text.slice(0, Math.max(1, maxChars - 1)).trimEnd()}…`
}

// One augment of the run recap on the end screens.
export interface RecapEntry {
  // "Lv 4" for a level-up, "Bought" for a store purchase.
  tag: string
  name: string
  // What a weapon did to its slot or what a purchase cost, such as "light, tier 2" or "10 fragments".
  note: string
  rarity: Rarity | null
  cardId: string | null
  // A level that passed without a card.
  skipped: boolean
  datenkrake?: DatenkrakeEvent
}

// Every augment of the run in the order it was taken, level-ups and purchases alike. The weapons
// are replayed from the starting staffs, so a second pick of the same weapon reads as its tier 2.
export function runRecap(records: readonly LevelUpRecord[]): RecapEntry[] {
  const weapons: PlayerBuild['weapons'] = { ...createBuild().weapons }
  return records.map((record) => {
    if (record.datenkrake) return datenkrakeEntry(record)
    const tag = record.price !== undefined ? 'Bought' : `Lv ${record.level}`
    const price = record.price !== undefined ? `${record.price} fragments` : ''
    if (!record.cardId) return { tag, name: 'no card taken', note: '', rarity: null, cardId: null, skipped: true }
    const card = CARDS.find((entry) => entry.id === record.cardId)
    let name = record.cardName ?? record.cardId
    let note = price
    if (card?.slot) {
      const id = record.cardId.slice('weapon.'.length) as PlayerWeaponId
      const held = weapons[card.slot]
      const tier = held.id === id ? 2 : 1
      weapons[card.slot] = { id, tier }
      if (tier === 2) name = weaponName(id, 2)
      note = [tier === 2 ? `${card.slot}, tier 2` : `${card.slot} weapon`, price].filter(Boolean).join(' · ')
    }
    return { tag, name, note, rarity: record.rarity, cardId: record.cardId, skipped: false }
  })
}

// The Datenkrake's part of the recap: what it took (struck through as "lost"), what it gave and a
// fight the mage won.
function datenkrakeEntry(record: LevelUpRecord): RecapEntry {
  const event = record.datenkrake ?? 'fought'
  const base = { tag: 'Kraken', rarity: null, cardId: record.cardId, skipped: false, datenkrake: event }
  if (event === 'fought') return { ...base, name: 'Fought off the Datenkrake', note: 'kept every augment', cardId: null }
  if (event === 'taken') return { ...base, name: `Taken: ${record.cardName ?? record.cardId}`, note: 'lost', rarity: record.rarity }
  const augment = record.cardId ? corruptedAugment(record.cardId) : undefined
  return { ...base, name: `Corrupted: ${augment?.name ?? record.cardName ?? record.cardId}`, note: 'boon and curse' }
}
