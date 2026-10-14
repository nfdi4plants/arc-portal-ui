import { describe, expect, it } from 'vitest'
import { CARDS } from '../../../src/game/model/progression/catalog'
import { beakerMoveset, bunsenMoveset, discMoveset, petriMoveset } from '../../../src/game/phaser/player/weapons/heavy'
import { pipetteMoveset, scalpelMoveset, wandMoveset, whipMoveset } from '../../../src/game/phaser/player/weapons/light'
import { staffMoveset } from '../../../src/game/phaser/player/staffMoveset'

// Imported from the weapon files because the index pulls in the Phaser runtime, which jsdom lacks.
const WEAPON_MOVESETS = [wandMoveset, pipetteMoveset, scalpelMoveset, whipMoveset, discMoveset, beakerMoveset, bunsenMoveset, petriMoveset]

const weaponCards = CARDS.flatMap((card) => (card.kind === 'weapon' && card.slot ? [{ id: card.id, slot: card.slot }] : []))

describe('weapon movesets', () => {
  it('has a moveset for every weapon card', () => {
    expect(weaponCards.length).toBeGreaterThan(0)
    for (const card of weaponCards) {
      const id = card.id.replace('weapon.', '')
      expect(WEAPON_MOVESETS.map((set) => set.id)).toContain(id)
    }
  })

  it.each([1, 2] as const)('returns moves only for the card slot at tier %i', (tier) => {
    for (const card of weaponCards) {
      const set = WEAPON_MOVESETS.find((candidate) => candidate.id === card.id.replace('weapon.', ''))
      const other = card.slot === 'light' ? 'heavy' : 'light'
      expect(set?.moves(card.slot, tier).length, card.id).toBeGreaterThan(0)
      expect(set?.moves(other, tier), card.id).toEqual([])
    }
  })

  it('defines only the variants of the card slot', () => {
    for (const card of weaponCards) {
      const set = WEAPON_MOVESETS.find((candidate) => candidate.id === card.id.replace('weapon.', ''))
      const foreign = card.slot === 'light' ? ['airHeavy', 'dashHeavy', 'upHeavy'] : ['dashLight', 'upLight']
      for (const key of foreign) expect(set, `${card.id} ${key}`).not.toHaveProperty(key)
    }
  })

  it('gives the staff moves in both slots', () => {
    for (const tier of [1, 2] as const) {
      expect(staffMoveset.moves('light', tier).length).toBeGreaterThan(0)
      expect(staffMoveset.moves('heavy', tier).length).toBeGreaterThan(0)
    }
  })
})
