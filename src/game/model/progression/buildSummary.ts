import type { PlayerBuild, WeaponSlot } from '../../contracts/progression'
import { createBuild, STAT_CAPS } from './build'
import { CARDS } from './catalog'
import { corruptedAugment } from './corrupted'
import { type WeaponStats, weaponStats } from './weaponStats'

export interface WeaponSummary extends WeaponStats {
  id: PlayerBuild['weapons'][WeaponSlot]['id']
  // "10 -> 13 (+30%)", or just "10" while a stat leaves the value as it is.
  damageText: string
  speedText: string
  // "ranged" for shots.
  reachText: string
}

export interface StatRow {
  label: string
  base: string
  current: string
  // The change against the base with the limit where one applies, such as "+12% (max 1.80x)".
  bonusText: string
  // The stat sits at its limit.
  capped: boolean
  // The current value reads on its own, such as HP against max HP.
  plain: boolean
}

export interface BuildSummary {
  // Light first, then heavy.
  weapons: [WeaponSummary, WeaponSummary]
  stats: StatRow[]
  mechanics: string[]
  legendaries: string[]
  // Corrupted augments of the Datenkrake.
  corrupted: string[]
}

export const fmt = (value: number): string => String(Math.round(value * 10) / 10)

const mult = (value: number) => `${value.toFixed(2)}x`
const percent = (value: number) => `${Math.round(value * 100)}%`
const seconds = (value: number) => `${(value / 1000).toFixed(1)} s`

function bonus(base: number, current: number): string {
  const change = Math.round((current / base - 1) * 100)
  return change === 0 ? '' : `${change > 0 ? '+' : ''}${change}%`
}

// "10 -> 13 (+30%)". The bonus is dropped when the value did not change.
export function changeText(base: number, current: number, format: (value: number) => string = fmt): string {
  const from = format(base)
  const to = format(current)
  if (from === to) return from
  const change = bonus(base, current)
  return `${from} -> ${to}${change ? ` (${change})` : ''}`
}

function weaponSummary(build: PlayerBuild, slot: WeaponSlot): WeaponSummary {
  const { id, tier } = build.weapons[slot]
  const stats = weaponStats(id, slot, tier)
  const { damage, attackSpeed, meleeRange } = build.stats
  return {
    ...stats,
    id,
    damageText: changeText(stats.damagePerHit, stats.damagePerHit * damage),
    speedText: changeText(stats.attacksPerSecond, stats.attacksPerSecond * attackSpeed),
    reachText: stats.reach === 'ranged' ? 'ranged' : changeText(stats.reach, stats.reach * meleeRange, (value) => String(Math.round(value))),
  }
}

type CappedField = keyof typeof STAT_CAPS

// A multiplier stat with its bonus and limit, such as "+12% (max 1.80x)".
function multiplierRow(label: string, field: Exclude<CappedField, 'critChance' | 'dashCooldownMs'>, current: number): StatRow {
  const capped = current >= STAT_CAPS[field]
  const change = bonus(1, current)
  return {
    label,
    base: mult(1),
    current: mult(current),
    bonusText: capped ? `${change} (max)` : `${change ? `${change} ` : ''}(max ${mult(STAT_CAPS[field])})`.trim(),
    capped,
    plain: false,
  }
}

function statRows(build: PlayerBuild): StatRow[] {
  const base = createBuild().stats
  const s = build.stats
  const critCapped = s.critChance >= STAT_CAPS.critChance
  const critGain = Math.round((s.critChance - base.critChance) * 100)
  const dashCapped = s.dashCooldownMs <= STAT_CAPS.dashCooldownMs
  const dashChange = s.dashCooldownMs - base.dashCooldownMs
  const rows: StatRow[] = [
    {
      label: 'HP',
      base: String(base.maxHp),
      current: `${build.hp}/${s.maxHp}`,
      bonusText: bonus(base.maxHp, s.maxHp),
      capped: false,
      plain: true,
    },
    multiplierRow('Damage', 'damage', s.damage),
    multiplierRow('Attack speed', 'attackSpeed', s.attackSpeed),
    multiplierRow('Melee range', 'meleeRange', s.meleeRange),
    multiplierRow('Move speed', 'moveSpeed', s.moveSpeed),
    {
      label: 'Crit chance',
      base: percent(base.critChance),
      current: percent(s.critChance),
      bonusText: critCapped ? `+${critGain} pts (max)` : `${critGain > 0 ? `+${critGain} pts ` : ''}(max ${percent(STAT_CAPS.critChance)})`.trim(),
      capped: critCapped,
      plain: false,
    },
    { label: 'Crit damage', base: mult(base.critMultiplier), current: mult(s.critMultiplier), bonusText: bonus(base.critMultiplier, s.critMultiplier), capped: false, plain: false },
    {
      label: 'Dash cooldown',
      base: seconds(base.dashCooldownMs),
      current: seconds(s.dashCooldownMs),
      bonusText: dashCapped ? `${seconds(dashChange)} (min)` : `${dashChange < 0 ? `${seconds(dashChange)} ` : ''}(min ${seconds(STAT_CAPS.dashCooldownMs)})`.trim(),
      capped: dashCapped,
      plain: false,
    },
  ]
  if (s.lifesteal > 0) rows.push({ label: 'Lifesteal', base: percent(0), current: percent(s.lifesteal), bonusText: '', capped: false, plain: false })
  return rows
}

const nameOf = (prefix: string, id: string) => CARDS.find((card) => card.id === `${prefix}.${id}`)?.name ?? id

// What the level-up screen shows of the build: both weapons with their effective numbers, the
// stats against their base with the limits, and the owned mechanics, legendaries and corrupted
// augments.
export function buildSummary(build: PlayerBuild): BuildSummary {
  return {
    weapons: [weaponSummary(build, 'light'), weaponSummary(build, 'heavy')],
    stats: statRows(build),
    mechanics: build.mechanics.map((id) => nameOf('mechanic', id)),
    legendaries: build.legendaries.map((id) => nameOf('legendary', id)),
    corrupted: build.corrupted.map((id) => corruptedAugment(id)?.name ?? id),
  }
}
