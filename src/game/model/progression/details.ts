import type { PlayerBuild, PlayerStats, WeaponSlot } from '../../contracts/progression'
import { bindingLabel, DEFAULT_BINDINGS } from '../input'
import { applyCard, STAT_CAPS } from './build'
import { ABILITY_IDS, CARDS } from './catalog'
import { FLAVOR } from './flavor'

const ABILITY_ACTIONS = ['ability1', 'ability2', 'ability3', 'ability4'] as const

// Key label of the ability slot with this index (0 to 3). The scene passes the player's own
// bindings, this default reads the shipped ones.
export function defaultAbilityLabel(slot: number): string {
  const binding = DEFAULT_BINDINGS[ABILITY_ACTIONS[slot]][0]
  return binding ? bindingLabel(binding) : `slot ${slot + 1}`
}

const mult = (value: number) => `${value.toFixed(2)}x`
const percent = (value: number) => `${Math.round(value * 100)}%`
const ms = (value: number) => `${Math.round(value)} ms`

interface StatLine {
  label: string
  read: (stats: PlayerStats) => number
  format: (value: number) => string
  // The limit as shown, such as "max 1.80x".
  limit: string
}

const STAT_LINES: Record<string, StatLine> = {
  'stat.swiftFeet': { label: 'Move speed', read: (s) => s.moveSpeed, format: mult, limit: `max ${mult(STAT_CAPS.moveSpeed)}` },
  'stat.quickHands': { label: 'Attack speed', read: (s) => s.attackSpeed, format: mult, limit: `max ${mult(STAT_CAPS.attackSpeed)}` },
  'stat.sharpened': { label: 'Damage', read: (s) => s.damage, format: mult, limit: `max ${mult(STAT_CAPS.damage)}` },
  'stat.keenEye': { label: 'Crit chance', read: (s) => s.critChance, format: percent, limit: `max ${percent(STAT_CAPS.critChance)}` },
  'stat.freshBattery': { label: 'Dash cooldown', read: (s) => s.dashCooldownMs, format: ms, limit: `min ${ms(STAT_CAPS.dashCooldownMs)}` },
  'stat.longReach': { label: 'Melee range', read: (s) => s.meleeRange, format: mult, limit: `max ${mult(STAT_CAPS.meleeRange)}` },
}

function statLines(build: PlayerBuild, cardId: string): string[] {
  const after = applyCard(build, cardId)
  if (cardId === 'stat.thickRobe') {
    const gained = after.stats.maxHp - build.stats.maxHp
    return [`Max HP: ${build.stats.maxHp} -> ${after.stats.maxHp}`, `Heals ${gained} HP (now ${after.hp}/${after.stats.maxHp}).`]
  }
  if (cardId === 'stat.secondWind') {
    return [`HP: ${build.hp}/${build.stats.maxHp} -> ${after.hp}/${after.stats.maxHp}`, `Heals ${after.hp - build.hp} HP.`]
  }
  const line = STAT_LINES[cardId]
  if (!line) return []
  const now = line.read(build.stats)
  const next = line.read(after.stats)
  if (now === next) return [`${line.label}: ${line.format(now)} (${line.limit}). Already at the limit.`]
  return [`${line.label}: ${line.format(now)} -> ${line.format(next)} (${line.limit})`]
}

// The tier 2 name is the one the card description announces ("Picking it again gives X.").
function weaponName(id: string, tier: 1 | 2): string {
  const card = CARDS.find((c) => c.id === `weapon.${id}`)
  if (!card) return id === 'staff' ? 'Staff' : id
  if (tier === 1) return card.name
  return /gives (.+)\.$/.exec(card.description)?.[1] ?? `${card.name} (tier 2)`
}

function weaponLines(build: PlayerBuild, cardId: string): string[] {
  const card = CARDS.find((c) => c.id === cardId)
  if (!card?.slot) return []
  const slot: WeaponSlot = card.slot
  const id = cardId.slice('weapon.'.length)
  const current = build.weapons[slot]
  const head = `${slot === 'light' ? 'Light' : 'Heavy'} slot: ${card.description}`
  if (current.id === id && current.tier === 1) return [head, `Upgrades your ${card.name} to ${weaponName(id, 2)} (tier 2).`]
  if (current.id === id) return [head, `Your ${weaponName(id, 2)} is already at tier 2.`]
  if (current.id === 'staff') return [head, `New weapon. It replaces your Staff in the ${slot} slot.`]
  return [head, `Replaces your ${weaponName(current.id, current.tier)} in the ${slot} slot.`]
}

function abilityLines(build: PlayerBuild, cardId: string, label: (slot: number) => string): string[] {
  const card = CARDS.find((c) => c.id === cardId)
  if (!card) return []
  const lines = [card.description]
  const id = cardId.slice(cardId.indexOf('.') + 1)
  if ((ABILITY_IDS as readonly string[]).includes(id)) {
    const free = build.abilitySlots.indexOf(null)
    lines.push(free >= 0 ? `Lands on ability slot ${free + 1} (${label(free)}).` : 'No free ability slot.')
  }
  return lines
}

// The lines of the detail panel for a card, given the build that would pick it. The last line is
// the card's flavour text. Unknown ids give an empty list.
export function cardDetails(build: PlayerBuild, cardId: string, abilityLabel: (slot: number) => string = defaultAbilityLabel): string[] {
  const card = CARDS.find((c) => c.id === cardId)
  if (!card) return []
  const body =
    card.kind === 'stat' ? statLines(build, cardId) : card.kind === 'weapon' ? weaponLines(build, cardId) : abilityLines(build, cardId, abilityLabel)
  const flavor = FLAVOR[cardId]
  return flavor ? [...body, flavor] : body
}
