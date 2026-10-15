import { describe, expect, it } from 'vitest'
import { CHANCE_ENCOUNTERS, ENCOUNTER_SLOTS, rollEncounters } from '../../../src/game/model/run'

describe('rollEncounters', () => {
  it('always meets the FAIR trader first, in every waystation of every run', () => {
    for (const seed of ['storybook', 'a', 'b', 'Talinum']) {
      for (let index = 0; index < 8; index++) expect(rollEncounters(seed, index)[0]).toBe('trader')
    }
  })

  it('meets the Datenkrake in about two waystations of five, never in the slot of the trader', () => {
    expect(CHANCE_ENCOUNTERS).toEqual([{ kind: 'datenkrake', chance: 0.4 }])
    let met = 0
    const rolls = 2000
    for (let i = 0; i < rolls; i++) {
      const kinds = rollEncounters(`run-${i}`, i % 6)
      if (!kinds.includes('datenkrake')) continue
      met++
      // The trader keeps the centre, the kraken stands between it and the exit.
      expect(kinds).toEqual(['trader', 'datenkrake'])
      expect(ENCOUNTER_SLOTS[kinds.indexOf('datenkrake')]).toBe('right')
    }
    expect(met / rolls).toBeGreaterThan(0.36)
    expect(met / rolls).toBeLessThan(0.44)
  })

  it('rolls each waystation of a run on its own', () => {
    const pattern = Array.from({ length: 12 }, (_, index) => rollEncounters('one run', index).includes('datenkrake'))
    expect(pattern).toContain(true)
    expect(pattern).toContain(false)
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
