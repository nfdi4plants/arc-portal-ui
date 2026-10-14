import type { PowerUpCard, Rarity, RollOffer } from '../../contracts/progression'
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

// Cumulative thresholds: 0.5% legendary, 7.5% rare, 22% uncommon, 70% common.
function rollRarity(r: number): Rarity {
  if (r < 0.005) return 'legendary'
  if (r < 0.08) return 'rare'
  if (r < 0.3) return 'uncommon'
  return 'common'
}

export const rollOffer: RollOffer = (build, rng) => {
  const offer: PowerUpCard[] = []
  for (let slot = 0; slot < build.offerSize; slot++) {
    const start = STEP_DOWN.indexOf(rollRarity(rng.next()))
    let candidates: PowerUpCard[] = []
    for (const rarity of STEP_DOWN.slice(start)) {
      candidates = CARDS_BY_RARITY[rarity].filter((card) => !offer.includes(card) && canApply(build, card.id))
      if (candidates.length > 0) break
    }
    // A slot with nothing left to offer is skipped, and later slots still roll.
    if (candidates.length > 0) offer.push(rng.pick(candidates))
  }
  return offer
}
