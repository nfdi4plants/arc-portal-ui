import type { PlayerBuild } from '../../contracts/progression'
import { xpForNextLevel } from './build'
import { legendaryChance } from './offer'

// One changed number of the level-up summary, such as max HP 100 -> 110.
export interface LevelUpRow {
  label: string
  from: number
  to: number
  // '%' for percentages. The numbers then carry one decimal.
  unit: '' | '%'
  // What the change means, such as "+10" or "+33 healed".
  change: string
}

// What the screen before the card choice shows: the levels gained since the screen last opened,
// what levelling changed (max HP, HP and, until the first legendary, the legendary chance) and the
// XP towards the next level. Several levels gained at once read as one summary with the totals.
export interface LevelUpSummary {
  fromLevel: number
  toLevel: number
  rows: LevelUpRow[]
  xp: number
  xpToNext: number
}

const percent = (chance: number) => Math.round(chance * 1000) / 10

export function levelUpSummary(before: PlayerBuild, after: PlayerBuild): LevelUpSummary {
  const maxHpGain = after.stats.maxHp - before.stats.maxHp
  const heal = after.hp - before.hp
  const rows: LevelUpRow[] = [
    { label: 'Max HP', from: before.stats.maxHp, to: after.stats.maxHp, unit: '', change: `+${maxHpGain}` },
    // Every level raises max HP, so the heal is never 0.
    { label: 'HP', from: before.hp, to: after.hp, unit: '', change: `+${heal} healed` },
  ]
  const legendaryFrom = percent(legendaryChance(before))
  const legendaryTo = percent(legendaryChance(after))
  if (legendaryTo !== legendaryFrom) rows.push({ label: 'Legendary chance', from: legendaryFrom, to: legendaryTo, unit: '%', change: 'per card' })
  return { fromLevel: before.level, toLevel: after.level, rows, xp: after.xp, xpToNext: xpForNextLevel(after.level) }
}
