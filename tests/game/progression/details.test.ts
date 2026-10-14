import { describe, expect, it } from 'vitest'
import { applyCard, CARDS, cardDetails, createBuild, FLAVOR, STAT_CAPS } from '../../../src/game/model/progression'

describe('cardDetails', () => {
  it('shows the current and the new value of a stat with its cap', () => {
    expect(cardDetails(createBuild(), 'stat.swiftFeet')[0]).toBe('Move speed: 1.00x -> 1.12x (max 1.80x)')
    expect(cardDetails(createBuild(), 'stat.keenEye')[0]).toBe('Crit chance: 5% -> 10% (max 60%)')
    expect(cardDetails(createBuild(), 'stat.freshBattery')[0]).toBe('Dash cooldown: 600 ms -> 510 ms (min 250 ms)')
  })

  it('says so when a stat is already at its cap', () => {
    const build = createBuild()
    build.stats.moveSpeed = STAT_CAPS.moveSpeed
    expect(cardDetails(build, 'stat.swiftFeet')[0]).toContain('Already at the limit')
  })

  it('shows max HP and the heal for the hp cards', () => {
    const build = { ...createBuild(), hp: 60 }
    expect(cardDetails(build, 'stat.thickRobe')).toContain('Max HP: 100 -> 115')
    expect(cardDetails(build, 'stat.secondWind')[0]).toBe('HP: 60/100 -> 100/100')
  })

  it('names the slot and the replaced weapon', () => {
    const fresh = cardDetails(createBuild(), 'weapon.wand')
    expect(fresh[0]).toMatch(/^Light slot:/)
    expect(fresh[1]).toBe('New weapon. It replaces your Staff in the light slot.')
    const swapped = applyCard(createBuild(), 'weapon.wand')
    expect(cardDetails(swapped, 'weapon.scalpel')[1]).toBe('Replaces your Wand in the light slot.')
    expect(cardDetails(createBuild(), 'weapon.beakerHammer')[0]).toMatch(/^Heavy slot:/)
  })

  it('names the tier 2 weapon when the same weapon is picked again', () => {
    const build = applyCard(createBuild(), 'weapon.scalpel')
    expect(cardDetails(build, 'weapon.scalpel')[1]).toBe('Upgrades your Scalpel to Dual Scalpels (tier 2).')
    const upgraded = applyCard(build, 'weapon.scalpel')
    expect(cardDetails(upgraded, 'weapon.wand')[1]).toBe('Replaces your Dual Scalpels in the light slot.')
  })

  it('tells which ability slot and key an ability card lands on', () => {
    expect(cardDetails(createBuild(), 'mechanic.parry')).toContain('Lands on ability slot 1 (Q).')
    const build = applyCard(createBuild(), 'mechanic.parry')
    expect(cardDetails(build, 'legendary.gitRevert')).toContain('Lands on ability slot 2 (E).')
  })

  it('uses the label function for the key', () => {
    const lines = cardDetails(createBuild(), 'mechanic.familiar', (slot) => `K${slot}`)
    expect(lines).toContain('Lands on ability slot 1 (K0).')
  })

  it('gives passive mechanics no slot line', () => {
    const lines = cardDetails(createBuild(), 'mechanic.doubleJump')
    expect(lines.some((line) => line.includes('ability slot'))).toBe(false)
  })

  it('ends every card with its flavour line', () => {
    const build = createBuild()
    for (const card of CARDS) {
      const lines = cardDetails(build, card.id)
      expect(lines.length).toBeGreaterThan(1)
      expect(lines[lines.length - 1]).toBe(FLAVOR[card.id])
    }
  })

  it('has a one-sentence flavour line without em dashes for every catalog card', () => {
    for (const card of CARDS) {
      const line = FLAVOR[card.id]
      expect(line, card.id).toBeTruthy()
      expect(line).not.toContain('—')
    }
    expect(Object.keys(FLAVOR).sort()).toEqual(CARDS.map((card) => card.id).sort())
  })

  it('returns no lines for an unknown card', () => {
    expect(cardDetails(createBuild(), 'stat.nope')).toEqual([])
  })
})
