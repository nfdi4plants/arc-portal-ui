import type { MonsterSpec } from '../../contracts/content'
import type { Rng } from '../../contracts/rng'

// Coins for the FAIR trade store. A mob drops a few now and then, a node boss always drops a handful.
// Summoned minions drop nothing, the same as they give no XP.

export const COIN_DROP = {
  // Chance that a mob drops anything at all.
  chance: 0.4,
  // A phantom has nothing filled in, its purse included, so it pays out rarely and never more than one.
  phantomChance: 0.2,
  // Extra coin chance per segment index, up to depthChanceMax.
  depthChance: 0.15,
  depthChanceMax: 0.5,
  maxPerMob: 3,
  // A node boss drops bossBase + bossPerSegment * segment index, plus 0 to bossSpread.
  bossBase: 6,
  bossPerSegment: 2,
  bossSpread: 2,
} as const

export type CoinSource = Pick<MonsterSpec, 'size' | 'segmentIndex' | 'phantom'>

// 0 to 3 coins. One coin, one more for a large mob and maybe one more deeper down the path.
export function mobCoinDrop(source: CoinSource, rng: Rng): number {
  if (source.phantom) return rng.chance(COIN_DROP.phantomChance) ? 1 : 0
  if (!rng.chance(COIN_DROP.chance)) return 0
  let coins = 1
  if (source.size === 'large') coins += 1
  if (rng.chance(Math.min(COIN_DROP.depthChanceMax, COIN_DROP.depthChance * source.segmentIndex))) coins += 1
  return Math.min(COIN_DROP.maxPerMob, coins)
}

export function bossCoinDrop(segmentIndex: number, rng: Rng): number {
  return COIN_DROP.bossBase + COIN_DROP.bossPerSegment * segmentIndex + rng.int(0, COIN_DROP.bossSpread)
}
