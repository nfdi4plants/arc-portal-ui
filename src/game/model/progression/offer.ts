import type { PlayerBuild, PowerUpCard, Rarity, RollOffer } from '../../contracts/progression'
import { canApply } from './build'
import { CARDS } from './catalog'

// When nothing at the rolled rarity can be offered, the roll steps down this list.
const STEP_DOWN: readonly Rarity[] = ['legendary', 'rare', 'uncommon', 'common']

function byId(a: PowerUpCard, b: PowerUpCard): number {
  if (a.id === b.id) return 0
  return a.id < b.id ? -1 : 1
}

// Sorted by id once, so a given seed picks the same card whatever the catalog order.
const CARDS_BY_RARITY: Record<Rarity, PowerUpCard[]> = { common: [], uncommon: [], rare: [], legendary: [] }
for (const card of [...CARDS].sort(byId)) {
  CARDS_BY_RARITY[card.rarity].push(card)
}

// Legendary odds per card: 0.5% normally. Until the first legendary is taken, every level-up after
// the first adds LEGENDARY_PITY_STEP, up to LEGENDARY_PITY_MAX, so most runs see one early.
const LEGENDARY_BASE = 0.005
const LEGENDARY_PITY_STEP = 0.04
const LEGENDARY_PITY_MAX = 0.3

export function legendaryChance(build: PlayerBuild): number {
  if (build.legendaries.length > 0) return LEGENDARY_BASE
  return Math.min(LEGENDARY_PITY_MAX, LEGENDARY_BASE + LEGENDARY_PITY_STEP * Math.max(0, build.level - 2))
}

// Below the legendary chance the roll is legendary. The rest splits 7.5 : 22 : 70 into rare,
// uncommon and common, which is 7.5%, 22% and 70% at the base legendary chance.
function rollRarity(r: number, legendary: number): Rarity {
  if (r < legendary) return 'legendary'
  const rest = ((r - legendary) / (1 - legendary)) * 0.995
  if (rest < 0.075) return 'rare'
  if (rest < 0.295) return 'uncommon'
  return 'common'
}

export const rollOffer: RollOffer = (build, rng) => {
  const offer: PowerUpCard[] = []
  const legendary = legendaryChance(build)
  for (let slot = 0; slot < build.offerSize; slot++) {
    const start = STEP_DOWN.indexOf(rollRarity(rng.next(), legendary))
    // The last slot of an offer that is all weapons so far takes something else, so a player
    // happy with their weapons always has a card to pick.
    const needsOther = slot === build.offerSize - 1 && offer.length > 0 && offer.every((card) => card.kind === 'weapon')
    let candidates: PowerUpCard[] = []
    for (const rarity of STEP_DOWN.slice(start)) {
      candidates = CARDS_BY_RARITY[rarity].filter(
        (card) => !offer.includes(card) && canApply(build, card.id) && !(needsOther && card.kind === 'weapon'),
      )
      if (candidates.length > 0) break
    }
    // A slot with nothing left to offer is skipped, and later slots still roll.
    if (candidates.length > 0) offer.push(rng.pick(candidates))
  }
  return offer
}
