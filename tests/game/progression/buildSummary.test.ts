import { describe, expect, it } from 'vitest'
import type { PlayerBuild } from '../../../src/game/contracts/progression'
import { applyCard, createBuild } from '../../../src/game/model/progression/build'
import { buildSummary, changeText } from '../../../src/game/model/progression/buildSummary'

const pick = (build: PlayerBuild, ...ids: string[]) => ids.reduce(applyCard, build)
const row = (build: PlayerBuild, label: string) => buildSummary(build).stats.find((r) => r.label === label)

describe('changeText', () => {
  it('shows base, current and the bonus', () => {
    expect(changeText(10, 13)).toBe('10 -> 13 (+30%)')
    expect(changeText(4, 3)).toBe('4 -> 3 (-25%)')
  })

  it('shows one value when nothing changed', () => {
    expect(changeText(10, 10)).toBe('10')
  })
})

describe('buildSummary weapons', () => {
  it('shows the staff in both slots at the base values', () => {
    const [light, heavy] = buildSummary(createBuild()).weapons
    expect(light).toMatchObject({ name: 'Staff', slot: 'light', damageText: '14.7', reachText: '76' })
    expect(heavy).toMatchObject({ name: 'Staff', slot: 'heavy', damageText: '36', reachText: '70' })
  })

  it('adds the damage, attack speed and range bonus to the weapon lines', () => {
    const build = pick(createBuild(), 'stat.sharpened', 'stat.sharpened', 'stat.quickHands', 'stat.longReach')
    const [light] = buildSummary(build).weapons
    expect(light.damageText).toBe('14.7 -> 19.4 (+32%)')
    expect(light.speedText).toBe('2.6 -> 2.9 (+12%)')
    expect(light.reachText).toBe('76 -> 87 (+15%)')
  })

  it('names a tier 2 weapon and keeps shots ranged', () => {
    const build = pick(createBuild(), 'weapon.wand', 'weapon.wand')
    const [light] = buildSummary(build).weapons
    expect(light).toMatchObject({ id: 'wand', tier: 2, name: 'Overclocked Wand', reachText: 'ranged' })
  })
})

describe('buildSummary stats', () => {
  it('has base equal to current and no bonus for a fresh build', () => {
    const damage = row(createBuild(), 'Damage')
    expect(damage).toMatchObject({ base: '1.00x', current: '1.00x', capped: false })
    expect(damage?.bonusText).toBe('(max 4.00x)')
  })

  it('shows the bonus with the limit', () => {
    const build = pick(createBuild(), 'stat.swiftFeet')
    expect(row(build, 'Move speed')).toMatchObject({ current: '1.12x', bonusText: '+12% (max 1.80x)' })
  })

  it('marks a stat at its cap', () => {
    let build = createBuild()
    for (let i = 0; i < 12; i++) build = applyCard(build, 'stat.swiftFeet')
    expect(row(build, 'Move speed')).toMatchObject({ current: '1.80x', bonusText: '+80% (max)', capped: true })
    for (let i = 0; i < 20; i++) build = applyCard(build, 'stat.quickHands')
    expect(row(build, 'Attack speed')).toMatchObject({ current: '2.50x', capped: true })
  })

  it('shows crit chance in points with its cap', () => {
    const build = pick(createBuild(), 'stat.keenEye', 'stat.keenEye')
    expect(row(build, 'Crit chance')).toMatchObject({ base: '5%', current: '15%', bonusText: '+10 pts (max 60%)' })
    let capped = createBuild()
    for (let i = 0; i < 14; i++) capped = applyCard(capped, 'stat.keenEye')
    expect(row(capped, 'Crit chance')).toMatchObject({ current: '60%', capped: true })
  })

  it('shows the dash cooldown down to its floor', () => {
    expect(row(createBuild(), 'Dash cooldown')).toMatchObject({ base: '2.0 s', current: '2.0 s', bonusText: '(min 1.0 s)' })
    const one = pick(createBuild(), 'stat.freshBattery')
    expect(row(one, 'Dash cooldown')).toMatchObject({ current: '1.5 s', bonusText: '-0.5 s (min 1.0 s)', capped: false })
    const two = pick(one, 'stat.freshBattery')
    expect(row(two, 'Dash cooldown')).toMatchObject({ current: '1.0 s', bonusText: '-1.0 s (min)', capped: true })
  })

  it('shows current and max HP', () => {
    const hurt = { ...pick(createBuild(), 'stat.thickRobe'), hp: 40 }
    expect(row(hurt, 'HP')).toMatchObject({ base: '100', current: '40/115', bonusText: '+15%' })
  })

  it('shows lifesteal only above 0', () => {
    expect(row(createBuild(), 'Lifesteal')).toBeUndefined()
    expect(row(pick(createBuild(), 'mechanic.lifesteal'), 'Lifesteal')).toMatchObject({ current: '8%' })
  })
})

describe('buildSummary mechanics and legendaries', () => {
  it('lists the names of the owned ones', () => {
    const summary = buildSummary(pick(createBuild(), 'mechanic.doubleJump', 'mechanic.wallJump', 'legendary.peerReview'))
    expect(summary.mechanics).toEqual(['Double Blind', 'Paywall Jump'])
    expect(summary.legendaries).toEqual(['Peer Review'])
  })

  it('is empty for a fresh build', () => {
    const summary = buildSummary(createBuild())
    expect(summary.mechanics).toEqual([])
    expect(summary.legendaries).toEqual([])
  })
})
