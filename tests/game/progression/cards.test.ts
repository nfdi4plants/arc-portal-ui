import { describe, expect, it } from 'vitest'
import type { PowerUpKind } from '../../../src/game/contracts/progression'
import { applyCard, canApply, CARDS, cardById, createBuild } from '../../../src/game/model/progression'

const countOf = (kind: PowerUpKind) => CARDS.filter((card) => card.kind === kind).length

describe('catalog', () => {
  it('has eight stat cards, eight weapon cards, 14 mechanics and five legendaries', () => {
    expect({
      stat: countOf('stat'),
      weapon: countOf('weapon'),
      mechanic: countOf('mechanic'),
      legendary: countOf('legendary'),
    }).toEqual({ stat: 8, weapon: 8, mechanic: 14, legendary: 5 })
  })

  it('gives every catalog card an effect that applyCard accepts', () => {
    for (const card of CARDS) {
      expect(() => applyCard(createBuild(), card.id)).not.toThrow()
    }
  })

  it('finds cards by id and returns undefined for the starting staff', () => {
    expect(cardById('weapon.wand')?.name).toBe('Wand')
    expect(cardById('weapon.staff')).toBeUndefined()
  })

  it('throws for an unknown card id, and canApply returns false for it', () => {
    expect(() => applyCard(createBuild(), 'stat.nope')).toThrow('Unknown power-up card: stat.nope')
    expect(canApply(createBuild(), 'stat.nope')).toBe(false)
  })
})

describe('stat cards', () => {
  it('stacks percent bonuses on the current value', () => {
    const build = applyCard(applyCard(createBuild(), 'stat.swiftFeet'), 'stat.swiftFeet')
    expect(build.stats.moveSpeed).toBeCloseTo(1.12 * 1.12)
  })

  it('clamps at the cap and stops being offered there', () => {
    let build = createBuild()
    for (let i = 0; i < 8; i++) build = applyCard(build, 'stat.swiftFeet')
    expect(build.stats.moveSpeed).toBe(1.8)
    expect(canApply(build, 'stat.swiftFeet')).toBe(false)
    expect(applyCard(build, 'stat.swiftFeet')).toBe(build)
  })

  it('shortens dash cooldown by 15% per card and stops at the 250 ms floor', () => {
    expect(applyCard(createBuild(), 'stat.freshBattery').stats.dashCooldownMs).toBeCloseTo(510)
    let build = createBuild()
    for (let i = 0; i < 8; i++) build = applyCard(build, 'stat.freshBattery')
    expect(build.stats.dashCooldownMs).toBe(250)
    expect(canApply(build, 'stat.freshBattery')).toBe(false)
  })

  it('adds 5 points of crit chance', () => {
    expect(applyCard(createBuild(), 'stat.keenEye').stats.critChance).toBeCloseTo(0.1)
  })

  it('raises max HP by 15% and heals the amount gained', () => {
    const build = applyCard({ ...createBuild(), hp: 60 }, 'stat.thickRobe')
    expect(build.stats.maxHp).toBe(115)
    expect(build.hp).toBe(75)
  })

  it('heals half of max HP, and is not offered at full HP', () => {
    expect(canApply(createBuild(), 'stat.secondWind')).toBe(false)
    expect(applyCard({ ...createBuild(), hp: 40 }, 'stat.secondWind').hp).toBe(90)
  })
})

describe('weapon cards', () => {
  it('replaces the staff in its slot at tier 1 and leaves the other slot alone', () => {
    const build = applyCard(createBuild(), 'weapon.wand')
    expect(build.weapons).toEqual({ light: { id: 'wand', tier: 1 }, heavy: { id: 'staff', tier: 1 } })
  })

  it('upgrades a weapon to tier 2 when picked again, and refuses it afterwards', () => {
    const build = applyCard(applyCard(createBuild(), 'weapon.wand'), 'weapon.wand')
    expect(build.weapons.light).toEqual({ id: 'wand', tier: 2 })
    expect(canApply(build, 'weapon.wand')).toBe(false)
    expect(applyCard(build, 'weapon.wand')).toBe(build)
  })

  it('replaces a tier 2 weapon with a different weapon at tier 1', () => {
    const upgraded = applyCard(applyCard(createBuild(), 'weapon.wand'), 'weapon.wand')
    expect(applyCard(upgraded, 'weapon.pipettePistol').weapons.light).toEqual({ id: 'pipettePistol', tier: 1 })
  })
})

describe('mechanic cards', () => {
  it('owns a unique mechanic once', () => {
    const build = applyCard(createBuild(), 'mechanic.doubleJump')
    expect(build.mechanics).toEqual(['doubleJump'])
    expect(canApply(build, 'mechanic.doubleJump')).toBe(false)
    expect(applyCard(build, 'mechanic.doubleJump')).toBe(build)
  })

  it('fills the first free ability slot for parry and familiar', () => {
    const build = applyCard(applyCard(createBuild(), 'mechanic.parry'), 'mechanic.familiar')
    expect(build.abilitySlots).toEqual(['parry', 'familiar', null, null])
    expect(build.mechanics).toEqual(['parry', 'familiar'])
  })

  it('sets lifesteal to 8%', () => {
    expect(applyCard(createBuild(), 'mechanic.lifesteal').stats.lifesteal).toBe(0.08)
  })

  it('raises the offer to four cards with extraChoice', () => {
    expect(applyCard(createBuild(), 'mechanic.extraChoice').offerSize).toBe(4)
  })
})

describe('legendary cards', () => {
  it('takes the next free ability slot for gitRevert', () => {
    const build = applyCard(applyCard(createBuild(), 'mechanic.parry'), 'legendary.gitRevert')
    expect(build.abilitySlots).toEqual(['parry', 'gitRevert', null, null])
    expect(build.legendaries).toEqual(['gitRevert'])
  })
})
