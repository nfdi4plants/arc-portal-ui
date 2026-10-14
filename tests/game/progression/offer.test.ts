import { describe, expect, it } from 'vitest'
import type { PlayerBuild, Rarity } from '../../../src/game/contracts/progression'
import { createRng } from '../../../src/game/contracts/rng'
import { applyCard, canApply, createBuild, rollOffer } from '../../../src/game/model/progression'

const offeredIds = (build: PlayerBuild, rolls: number, seed: string): Set<string> => {
  const rng = createRng(seed)
  const offered = new Set<string>()
  for (let i = 0; i < rolls; i++) {
    for (const card of rollOffer(build, rng)) offered.add(card.id)
  }
  return offered
}

describe('rollOffer', () => {
  it('offers three cards on a fresh build', () => {
    expect(rollOffer(createBuild(), createRng('three'))).toHaveLength(3)
  })

  it('offers four cards once extraChoice is held', () => {
    const build = applyCard(createBuild(), 'mechanic.extraChoice')
    expect(rollOffer(build, createRng('four'))).toHaveLength(4)
  })

  it('offers distinct cards that can all be applied', () => {
    const build = ['stat.sharpened', 'weapon.wand', 'weapon.petriShield', 'mechanic.doubleJump', 'mechanic.parry'].reduce(
      (current, id) => applyCard(current, id),
      createBuild(),
    )
    const rng = createRng('valid')
    for (let i = 0; i < 2000; i++) {
      const offer = rollOffer(build, rng)
      expect(new Set(offer.map((card) => card.id)).size).toBe(offer.length)
      expect(offer.every((card) => canApply(build, card.id))).toBe(true)
    }
  })

  it('never offers a unique mechanic the player already owns', () => {
    const offered = offeredIds(applyCard(createBuild(), 'mechanic.doubleJump'), 10000, 'owned')
    expect(offered.has('mechanic.doubleJump')).toBe(false)
    expect(offered.has('mechanic.airDash')).toBe(true)
  })

  it('never offers a weapon already held at tier 2', () => {
    const build = applyCard(applyCard(createBuild(), 'weapon.wand'), 'weapon.wand')
    const offered = offeredIds(build, 10000, 'tier-two')
    expect(offered.has('weapon.wand')).toBe(false)
    expect(offered.has('weapon.pipettePistol')).toBe(true)
  })

  it('rolls rarities at the planned odds over 100,000 fresh builds', () => {
    const rng = createRng('odds')
    const rolls = 100000
    const counts: Record<Rarity, number> = { common: 0, uncommon: 0, rare: 0, legendary: 0 }
    for (let i = 0; i < rolls; i++) {
      counts[rollOffer(createBuild(), rng)[0].rarity] += 1
    }
    const share = (rarity: Rarity) => counts[rarity] / rolls
    expect(Math.abs(share('common') - 0.7)).toBeLessThanOrEqual(0.005)
    expect(Math.abs(share('uncommon') - 0.22)).toBeLessThanOrEqual(0.005)
    expect(Math.abs(share('rare') - 0.075)).toBeLessThanOrEqual(0.005)
    expect(counts.legendary).toBeGreaterThan(0)
    expect(share('legendary')).toBeLessThan(0.01)
  })
})
