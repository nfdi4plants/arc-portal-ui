import { describe, expect, it } from 'vitest'
import type { PowerUpKind } from '../../../src/game/contracts/progression'
import { ABILITY_IDS, applyCard, canApply, CARDS, createBuild, rollOffer } from '../../../src/game/model/progression'
import { createRng } from '../../../src/game/contracts/rng'

const countOf = (kind: PowerUpKind) => CARDS.filter((card) => card.kind === kind).length

describe('catalog', () => {
  it('has seven stat cards, eight weapon cards, 20 mechanics and seven legendaries', () => {
    expect({
      stat: countOf('stat'),
      weapon: countOf('weapon'),
      mechanic: countOf('mechanic'),
      legendary: countOf('legendary'),
    }).toEqual({ stat: 7, weapon: 8, mechanic: 20, legendary: 7 })
  })

  it('gives every catalog card an effect that applyCard accepts', () => {
    for (const card of CARDS) {
      expect(() => applyCard(createBuild(), card.id)).not.toThrow()
    }
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

  it('shortens dash cooldown by 500 ms per card and stops at the 1 s floor', () => {
    expect(applyCard(createBuild(), 'stat.freshBattery').stats.dashCooldownMs).toBe(1500)
    let build = createBuild()
    for (let i = 0; i < 8; i++) build = applyCard(build, 'stat.freshBattery')
    expect(build.stats.dashCooldownMs).toBe(1000)
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

describe('ability cards', () => {
  const abilityCards = CARDS.filter((card) => (ABILITY_IDS as readonly string[]).includes(card.id.slice(card.id.indexOf('.') + 1)))

  it('has a card for every ability id, and each says it takes a slot', () => {
    expect(abilityCards).toHaveLength(ABILITY_IDS.length)
    for (const card of abilityCards) expect(card.description, card.id).toMatch(/^Takes an ability slot\. /)
    for (const card of CARDS) if (card.description.startsWith('Takes an ability slot.')) expect(abilityCards).toContain(card)
  })

  it('offers Backup Restore (secondWind) at full HP and heals nothing on pick', () => {
    const build = createBuild()
    expect(canApply(build, 'mechanic.secondWind')).toBe(true)
    const picked = applyCard({ ...build, hp: 40 }, 'mechanic.secondWind')
    expect(picked.hp).toBe(40)
    expect(picked.abilitySlots).toEqual(['secondWind', null, null, null])
  })

  it('fills the slots in pick order and refuses a fifth ability', () => {
    let build = createBuild()
    for (const id of ['mechanic.centrifugeSpin', 'mechanic.fumeHood', 'legendary.labCoat', 'mechanic.sampleFreeze']) build = applyCard(build, id)
    expect(build.abilitySlots).toEqual(['centrifugeSpin', 'fumeHood', 'labCoat', 'sampleFreeze'])
    for (const card of abilityCards) expect(canApply(build, card.id), card.id).toBe(false)
    expect(applyCard(build, 'mechanic.autoclave')).toBe(build)
  })

  it('leaves ability cards out of offers once the four slots are full', () => {
    let build = createBuild()
    for (const id of ['mechanic.citationNeeded', 'mechanic.autoclave', 'legendary.peerPressure', 'mechanic.secondWind']) build = applyCard(build, id)
    const rng = createRng('full-slots')
    for (let i = 0; i < 50; i++) {
      for (const card of rollOffer({ ...build, level: 2 + (i % 10) }, rng)) expect(abilityCards).not.toContain(card)
    }
  })
})

describe('legendary cards', () => {
  it('takes the next free ability slot for gitRevert', () => {
    const build = applyCard(applyCard(createBuild(), 'mechanic.parry'), 'legendary.gitRevert')
    expect(build.abilitySlots).toEqual(['parry', 'gitRevert', null, null])
    expect(build.legendaries).toEqual(['gitRevert'])
  })
})
