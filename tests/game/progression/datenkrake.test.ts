import { describe, expect, it } from 'vitest'
import type { PlayerBuild } from '../../../src/game/contracts/progression'
import { createRng } from '../../../src/game/contracts/rng'
import {
  applyCard,
  applyCorrupted,
  canSubmit,
  CARDS,
  CORRUPTED,
  createBuild,
  createLinePicker,
  DATENKRAKE_LINES,
  eligibleAugments,
  fillDealLine,
  removeAugment,
  submitToDatenkrake,
} from '../../../src/game/model/progression'

const pick = (build: PlayerBuild, ...ids: string[]) => ids.reduce(applyCard, build)

// A mid-run build: two weapons, a legendary, two stat cards (one twice), a motion mechanic and an
// ability in slot 1.
function midRun(): { build: PlayerBuild; stacks: Record<string, number> } {
  const build = pick(
    createBuild(),
    'weapon.wand',
    'weapon.beakerHammer',
    'legendary.theOntology',
    'stat.sharpened',
    'stat.sharpened',
    'stat.thickRobe',
    'mechanic.doubleJump',
    'mechanic.centrifugeSpin',
  )
  return { build, stacks: { 'stat.sharpened': 2, 'stat.thickRobe': 1 } }
}

describe('what the Datenkrake may take', () => {
  it('lists every stat stack and mechanic, never a weapon, a legendary or a corrupted augment', () => {
    const { build, stacks } = midRun()
    const corrupted = applyCorrupted(build, 'bigData')
    const pool = eligibleAugments(corrupted, stacks)
    expect(pool).toEqual(['stat.sharpened', 'stat.sharpened', 'stat.thickRobe', 'mechanic.doubleJump', 'mechanic.centrifugeSpin'])
    for (const id of pool) {
      const card = CARDS.find((entry) => entry.id === id)
      expect(card?.kind === 'weapon' || card?.kind === 'legendary').toBe(false)
    }
  })

  it('has nothing to take from a build of weapons and legendaries only, so it cannot deal', () => {
    const build = pick(createBuild(), 'weapon.scalpel', 'legendary.labCoat')
    expect(eligibleAugments(build, {})).toEqual([])
    expect(canSubmit(build, {})).toBe(false)
    expect(submitToDatenkrake(build, {}, createRng('x'))).toBeNull()
  })

  it('takes one stack of a stat card and leaves the others', () => {
    const { build } = midRun()
    const after = removeAugment(build, 'stat.sharpened')
    expect(after.stats.damage).toBeCloseTo(1.15)
    const robe = removeAugment(build, 'stat.thickRobe')
    expect(robe.stats.maxHp).toBe(100)
    expect(robe.hp).toBeLessThanOrEqual(robe.stats.maxHp)
  })

  it('frees the ability slot of a taken ability card for the next one', () => {
    const { build } = midRun()
    expect(build.abilitySlots[0]).toBe('centrifugeSpin')
    const after = removeAugment(build, 'mechanic.centrifugeSpin')
    expect(after.mechanics).toEqual(['doubleJump'])
    expect(after.abilitySlots).toEqual([null, null, null, null])
    expect(applyCard(after, 'mechanic.fumeHood').abilitySlots[0]).toBe('fumeHood')
  })

  it('undoes what Data Reuse and Open Access changed besides being owned', () => {
    const build = pick(createBuild(), 'mechanic.lifesteal', 'mechanic.extraChoice')
    expect(removeAugment(build, 'mechanic.lifesteal').stats.lifesteal).toBe(0)
    expect(removeAugment(build, 'mechanic.extraChoice').offerSize).toBe(3)
  })
})

describe('submitting to the Datenkrake', () => {
  it('swaps one eligible augment for one corrupted augment, the same way for the same seed', () => {
    const { build, stacks } = midRun()
    const deal = submitToDatenkrake(build, stacks, createRng('waystation'))
    expect(deal).not.toBeNull()
    if (!deal) return
    expect(eligibleAugments(build, stacks)).toContain(deal.taken)
    expect(deal.build.corrupted).toEqual([deal.given])
    expect(deal.build.weapons).toEqual(build.weapons)
    expect(deal.build.legendaries).toEqual(build.legendaries)
    expect(submitToDatenkrake(build, stacks, createRng('waystation'))).toEqual(deal)
  })

  it('takes every kind of augment over many waystations and gives every corrupted augment', () => {
    const { build, stacks } = midRun()
    const taken = new Set<string>()
    const given = new Set<string>()
    for (let i = 0; i < 400; i++) {
      const deal = submitToDatenkrake(build, stacks, createRng(`deal-${i}`))
      if (!deal) throw new Error('no deal')
      taken.add(deal.taken)
      given.add(deal.given)
    }
    expect([...taken].sort()).toEqual(['mechanic.centrifugeSpin', 'mechanic.doubleJump', 'stat.sharpened', 'stat.thickRobe'])
    expect(given.size).toBe(CORRUPTED.length)
  })

  it('never gives a corrupted augment twice', () => {
    let { build } = midRun()
    const stacks = { 'stat.sharpened': 2, 'stat.thickRobe': 1 }
    for (let i = 0; i < 3; i++) {
      const deal = submitToDatenkrake(build, stacks, createRng(`again-${i}`))
      if (!deal) throw new Error('no deal')
      if (deal.taken.startsWith('stat.')) stacks[deal.taken as keyof typeof stacks]--
      build = deal.build
    }
    expect(new Set(build.corrupted).size).toBe(3)
  })
})

describe('the Datenkrake lines', () => {
  it('keeps every line short enough for a speech bubble', () => {
    for (const lines of Object.values(DATENKRAKE_LINES)) {
      expect(lines.length).toBeGreaterThanOrEqual(3)
      for (const line of lines) expect(line.length).toBeLessThanOrEqual(75)
    }
  })

  it('never says the same line twice in a row', () => {
    const next = createLinePicker(DATENKRAKE_LINES.grab, createRng('lines'))
    let last = ''
    for (let i = 0; i < 100; i++) {
      const line = next()
      expect(line).not.toBe(last)
      last = line
    }
  })

  it('names what was taken and what was given in a deal line', () => {
    for (const line of DATENKRAKE_LINES.deal) {
      const filled = fillDealLine(line, 'Impact Factor', 'Big Data')
      expect(filled).toContain('Impact Factor')
      expect(filled).toContain('Big Data')
    }
  })
})
