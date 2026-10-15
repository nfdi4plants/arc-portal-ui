import { describe, expect, it } from 'vitest'
import { CHANCE_ENCOUNTERS, ENCOUNTER_SLOTS, rollEncounters } from '../../../src/game/model/run'

describe('rollEncounters', () => {
  it('always meets the FAIR trader first, in every waystation of every run', () => {
    for (const seed of ['storybook', 'a', 'b', 'Talinum']) {
      for (let index = 0; index < 8; index++) expect(rollEncounters(seed, index)[0]).toBe('trader')
    }
  })

  it('meets only the trader while there are no chance encounters', () => {
    expect(CHANCE_ENCOUNTERS).toHaveLength(0)
    expect(rollEncounters('storybook', 0)).toEqual(['trader'])
  })

  it('meets the same encounters for the same run and waystation', () => {
    for (let index = 0; index < 8; index++) expect(rollEncounters('again', index)).toEqual(rollEncounters('again', index))
  })

  it('never meets more encounters than the room has slots, nor one twice', () => {
    for (let index = 0; index < 20; index++) {
      const kinds = rollEncounters(`slots-${index}`, index)
      expect(kinds.length).toBeLessThanOrEqual(ENCOUNTER_SLOTS.length)
      expect(new Set(kinds).size).toBe(kinds.length)
    }
    expect(new Set(ENCOUNTER_SLOTS).size).toBe(3)
    expect(ENCOUNTER_SLOTS[0]).toBe('centre')
  })
})
