import type { PlayerBuild, PowerUpCard } from '../../contracts/progression'
import type { Rng } from '../../contracts/rng'
import { applyCard, canApply, createBuild } from './build'
import { CARDS } from './catalog'

// The FAIR trader can be attacked. Three strikes get a warning each, the fourth starts a fight
// against a mage-like trader at the mage's level, and beating him loots his stall. Pure, so the
// rules are unit-tested. The waystation scene runs the fight (phaser/scenes/traderFight.ts).

// Hits closer together than this belong to one strike, so a multi-hit attack (a flame cone, Dual
// Scalpels, an echo) counts once. The window slides with every hit.
export const STRIKE_WINDOW_MS = 400
// The strike that turns him hostile. The ones before it are warnings.
export const HOSTILE_STRIKE = 4

export interface StrikeState {
  strikes: number
  // When the last hit landed, -Infinity before the first.
  lastHitMs: number
}

export function createStrikeState(): StrikeState {
  return { strikes: 0, lastHitMs: Number.NEGATIVE_INFINITY }
}

// Counts a hit at `nowMs`. Returns the number of the strike it starts, or 0 when it belongs to
// the strike before. After the hostile strike nothing counts any more.
export function strikeAt(state: StrikeState, nowMs: number): number {
  if (state.strikes >= HOSTILE_STRIKE) return 0
  const fresh = nowMs - state.lastHitMs >= STRIKE_WINDOW_MS
  state.lastHitMs = nowMs
  if (!fresh) return 0
  state.strikes++
  return state.strikes
}

// What he says after strike 1, 2 and 3. The fourth gets no words.
export const TRADER_WARNINGS: Record<1 | 2 | 3, readonly string[]> = {
  1: [
    "Hey! That's not very FAIR.",
    'Ow! Was that Findable on purpose?',
    'Careful, that stall is Reusable. My shins are not.',
    'Hitting the vendor is not in the license.',
    'I accept fragments, not feedback of that kind.',
    'Ouch. That was not peer reviewed.',
  ],
  2: [
    'One FAIR warning. Stop it.',
    'Second hit. I am keeping provenance on this.',
    'Do that again and I will cite you. Negatively.',
    'This is logged, versioned and pushed to the DataHUB.',
    'My patience is not Interoperable with yours.',
    'I have a DOI for this incident already.',
  ],
  3: [
    "Last chance. I have a DOI and I'm not afraid to cite it.",
    'Final warning. My return policy is very unFAIR.',
    'One more and the store goes closed access.',
    'Touch me again and I open the legendary stock. On you.',
    'Three strikes. You know what comes after three?',
    'Stop now, or this becomes a very short publication.',
  ],
}

export const TRADER_FIGHT_LINES = {
  // Shouted while he winds up Peer Pressure, so the player can dash through it.
  pressure: ['Peer review incoming!', 'Everyone agrees with me!', 'Consensus says: down you go!', 'Reviewer 2 sends regards!'],
  // As he falls.
  defeat: [
    'This... this isn\'t FAIR...',
    'Fine. Take it. Take all of it.',
    'My ontology... incomplete forever...',
    'I should have kept a backup of me.',
    'You win. Mark it as Findable.',
  ],
  // On the death screen when he wins.
  kill: [
    'Returns are not accepted. Neither are you.',
    'Should have read the terms of trade.',
    'Your run was archived without metadata.',
    'Priced in. Paid in full.',
    'Unfair? I prefer "curated".',
    'A FAIR fight was never in stock.',
  ],
  // The note on his closed stall for the rest of the run.
  closed: [
    'Closed. Not FAIR.',
    'Gone to rebuild the ontology. Do not knock.',
    'Closed for peer review. Of you.',
    'Out of stock. Out of patience.',
    'Store moved to closed access.',
    'Back never. Fragments not accepted.',
  ],
} as const satisfies Record<string, readonly string[]>

export type TraderFightMood = keyof typeof TRADER_FIGHT_LINES

// His max hp is that of a mage of the same level and cards, times this. A mage's hp alone ends
// the fight in a few seconds of hitting, and he is meant to be hard.
export const TRADER_HP_FACTOR = 2

const COMMONS = CARDS.filter((card) => card.rarity === 'common')
const LEGENDARY_AUGMENTS = CARDS.filter((card) => card.kind === 'legendary')
const LEGENDARY_WEAPONS = CARDS.filter((card) => card.kind === 'weapon' && card.rarity === 'legendary')
const legendaryWeaponCards = (slot: 'light' | 'heavy') => LEGENDARY_WEAPONS.filter((card) => card.slot === slot)

// The trader as a mage of `level`: a random legendary weapon in each slot at full power, every
// legendary augment, and for every level gained the max hp gain of a level-up and a random common
// card. Then his hp is raised by TRADER_HP_FACTOR, and he starts at full health.
export function traderBuild(level: number, rng: Rng): PlayerBuild {
  let build = createBuild()
  build = applyCard(build, rng.pick(legendaryWeaponCards('light')).id)
  build = applyCard(build, rng.pick(legendaryWeaponCards('heavy')).id)
  for (const card of LEGENDARY_AUGMENTS) build = applyCard(build, card.id)
  for (let next = 2; next <= level; next++) {
    const maxHp = Math.round(build.stats.maxHp * 1.1)
    build = { ...build, level: next, stats: { ...build.stats, maxHp } }
    const commons = COMMONS.filter((card) => canApply(build, card.id))
    if (commons.length > 0) build = applyCard(build, rng.pick(commons).id)
  }
  const maxHp = Math.round(build.stats.maxHp * TRADER_HP_FACTOR)
  return { ...build, xp: 0, hp: maxHp, stats: { ...build.stats, maxHp } }
}

// The bonus of a beaten trader: one legendary augment or legendary weapon that the mage does not
// have yet and can take, and that was not in his stock this visit (sold or not). `build` already
// holds the rest of the loot. Null when nothing is left to give.
export function traderBonus(build: PlayerBuild, stockIds: readonly string[], rng: Rng): PowerUpCard | null {
  const candidates = [...LEGENDARY_AUGMENTS, ...LEGENDARY_WEAPONS].filter((card) => !stockIds.includes(card.id) && canApply(build, card.id))
  return candidates.length > 0 ? rng.pick(candidates) : null
}

// Applies the loot like store purchases: the cards only, no level, XP, max hp gain or heal. A card
// the build cannot take any more (an ability without a free slot) is skipped. Returns the build and
// the cards that applied, in order.
export function applyLoot(build: PlayerBuild, cards: readonly PowerUpCard[]): { build: PlayerBuild; applied: PowerUpCard[] } {
  const applied: PowerUpCard[] = []
  let next = build
  for (const card of cards) {
    if (!canApply(next, card.id)) continue
    next = applyCard(next, card.id)
    applied.push(card)
  }
  return { build: next, applied }
}
