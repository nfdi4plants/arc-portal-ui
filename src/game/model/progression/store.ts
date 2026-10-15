import type { PlayerBuild, PowerUpCard, Rarity } from '../../contracts/progression'
import type { Rng } from '../../contracts/rng'
import { applyCard, canApply } from './build'
import { drawCards } from './offer'

// The FAIR trade store that opens after each node boss. Its stock is drawn like a level-up offer,
// but a purchase only adds the card: no level, no XP, no max HP and no heal.

export const STOCK_SIZE = 4

// A first trader sees about 11 to 13 Ontology Fragments (about 4 to 5 from the mobs of a stretch and 6
// to 8 from the boss), enough for one or two commons or one uncommon. A rare takes saving over two
// traders.
export const PRICES: Record<Rarity, number> = { common: 5, uncommon: 10, rare: 20, legendary: 45 }

// A fixed legendary chance per card. The store never touches the level-up pity, which only grows
// with the level.
export const STORE_LEGENDARY_CHANCE = 0.03

export function priceOf(card: PowerUpCard): number {
  return PRICES[card.rarity]
}

// The cards on the table for one trader visit. The last card of an all-weapon stock is something
// else, so there is always a non-weapon card when the catalog has one to give.
export function rollStock(build: PlayerBuild, rng: Rng): PowerUpCard[] {
  return drawCards(build, rng, STOCK_SIZE, STORE_LEGENDARY_CHANCE)
}

export type StockState = 'buy' | 'poor' | 'unusable'

// Whether a card in stock can be bought now. An earlier purchase can make a card unusable, for
// example the last free ability slot.
export function stockState(build: PlayerBuild, fragments: number, card: PowerUpCard): StockState {
  if (!canApply(build, card.id)) return 'unusable'
  return fragments >= priceOf(card) ? 'buy' : 'poor'
}

// The build and the fragments after a purchase, or null when the card cannot be bought.
export function buyCard(build: PlayerBuild, fragments: number, card: PowerUpCard): { build: PlayerBuild; fragments: number } | null {
  if (stockState(build, fragments, card) !== 'buy') return null
  return { build: applyCard(build, card.id), fragments: fragments - priceOf(card) }
}
