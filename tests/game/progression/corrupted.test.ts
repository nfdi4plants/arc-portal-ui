import { describe, expect, it } from 'vitest'
import { TILE } from '../../../src/game/contracts/constants'
import type { CorruptedId, PlayerBuild } from '../../../src/game/contracts/progression'
import { availableJump, canDash, createMotorState, JUMP_VELOCITY, MOTOR, type MotorEnv } from '../../../src/game/model/input/motor'
import {
  addXp,
  applyCard,
  applyCorrupted,
  canApply,
  CORRUPTED,
  CORRUPTION,
  corruptedChoices,
  corruptionFlags,
  createBuild,
  createHitMemory,
  incomingFactor,
  outgoingFactor,
} from '../../../src/game/model/progression'
import { MAX_GAP_TILES } from '../../../src/game/phaser/scenes/levelGen'

const corrupt = (id: CorruptedId, build: PlayerBuild = createBuild()) => applyCorrupted(build, id)
const flagsOf = (...ids: CorruptedId[]) => corruptionFlags(ids.reduce((build, id) => applyCorrupted(build, id), createBuild()))
const enemy = () => ({})

// The damage factor of one of the mage's own hits.
function hit(ids: CorruptedId[], tags: string[]): number {
  return outgoingFactor(flagsOf(...ids), tags, enemy(), createHitMemory())
}

describe('the corrupted catalog', () => {
  it('has 16 augments, each with a name, a boon, a curse and a flavour line', () => {
    expect(CORRUPTED).toHaveLength(16)
    expect(new Set(CORRUPTED.map((augment) => augment.id)).size).toBe(16)
    for (const augment of CORRUPTED) {
      for (const text of [augment.name, augment.boon, augment.curse, augment.flavor]) expect(text.length).toBeGreaterThan(3)
    }
  })

  it('is never given twice, and In Silico and In Vitro never together', () => {
    const silico = corrupt('inSilico')
    expect(corruptedChoices(silico)).not.toContain('inSilico')
    expect(corruptedChoices(silico)).not.toContain('inVitro')
    expect(corruptedChoices(createBuild())).toHaveLength(16)
    expect(corrupt('bigData', corrupt('bigData')).corrupted).toEqual(['bigData'])
  })
})

describe('each corrupted augment', () => {
  it('Big Data doubles the damage and makes the mage take 75% more', () => {
    expect(corrupt('bigData').stats.damage).toBe(2)
    expect(incomingFactor(flagsOf('bigData'))).toBe(1.75)
    expect(incomingFactor(flagsOf('dataLake'))).toBe(1)
  })

  it('Deprecated jump() gives 2.5 times the max HP at full health and takes every jump', () => {
    const build = corrupt('deprecatedJump', { ...createBuild(), hp: 40 })
    expect(build.stats.maxHp).toBe(250)
    expect(build.hp).toBe(250)
    // Extra jumps and the glide are of no use any more, so they are not offered.
    for (const id of ['mechanic.doubleJump', 'mechanic.wallJump', 'mechanic.hatGlide']) expect(canApply(build, id)).toBe(false)
    expect(canApply(build, 'mechanic.airDash')).toBe(true)
  })

  it('Shadow IT doubles the dash cooldown', () => {
    expect(corrupt('shadowIt').stats.dashCooldownMs).toBe(4000)
  })

  it('Data Lake slows the mage by 30%', () => {
    expect(corrupt('dataLake').stats.moveSpeed).toBeCloseTo(0.7)
  })

  it('Overfitting rewards the same target and punishes every other', () => {
    const flags = flagsOf('overfitting')
    const memory = createHitMemory()
    const a = enemy()
    const b = enemy()
    expect(outgoingFactor(flags, ['light'], a, memory)).toBe(0.5)
    expect(outgoingFactor(flags, ['light'], a, memory)).toBe(2.5)
    expect(outgoingFactor(flags, ['light'], b, memory)).toBe(0.5)
  })

  it('Rogue Admin takes Quality Control off the offers, its crits come from the loadout', () => {
    const build = corrupt('rogueAdmin')
    expect(canApply(build, 'stat.keenEye')).toBe(false)
    expect(CORRUPTION.rogueAdmin.abilityCooldown).toBe(3)
  })

  it('Terms of Service heals every level-up to full', () => {
    const build = { ...corrupt('termsOfService'), hp: 10 }
    const { build: after, levelsGained } = addXp(build, 20)
    expect(levelsGained).toBe(1)
    expect(after.hp).toBe(after.stats.maxHp)
    expect(addXp({ ...createBuild(), hp: 10 }, 20).build.hp).toBeLessThan(110)
  })

  it('In Silico boosts shots and weakens melee, In Vitro the other way round', () => {
    expect(hit(['inSilico'], ['light', 'projectile'])).toBeCloseTo(1.6)
    expect(hit(['inSilico'], ['light'])).toBeCloseTo(0.5)
    expect(hit(['inVitro'], ['heavy'])).toBeCloseTo(1.6)
    expect(hit(['inVitro'], ['light', 'projectile'])).toBeCloseTo(0.4)
    expect(corrupt('inVitro').stats.meleeRange).toBeCloseTo(1.4)
  })

  it('Heavy Metadata boosts heavy attacks and halves light ones', () => {
    expect(hit(['heavyMetadata'], ['heavy'])).toBe(2.5)
    expect(hit(['heavyMetadata'], ['light'])).toBe(0.5)
    expect(hit(['heavyMetadata'], ['dash', 'shadowIt'])).toBe(1)
  })

  it('Reviewer 2 rejects the first hit on every enemy and deals 10x on every tenth hit', () => {
    const flags = flagsOf('reviewer2')
    const memory = createHitMemory()
    const boss = enemy()
    const factors = Array.from({ length: 10 }, () => outgoingFactor(flags, ['light'], boss, memory))
    expect(factors[0]).toBe(0)
    expect(factors.slice(1, 9)).toEqual(Array(8).fill(1))
    expect(factors[9]).toBe(10)
  })

  it('Infinite Scroll quarters the dash cooldown, lifts the air dash limit and slows attacks by 40%', () => {
    const build = corrupt('infiniteScroll')
    expect(build.stats.dashCooldownMs).toBe(500)
    expect(build.stats.attackSpeed).toBeCloseTo(0.6)
    const env: MotorEnv = {
      grounded: false,
      touchingWallLeft: false,
      touchingWallRight: false,
      stats: { moveSpeed: 1, dashCooldownMs: 500 },
      mechanics: { doubleJump: false, airDash: false, wallJump: false, hatGlide: false, infiniteAirDash: true },
    }
    expect(canDash({ ...createMotorState(), airDashUsed: true }, env)).toBe(true)
  })

  it('the rest only flag the build, their effects run in the game: Blockchain, Data Leak, Mirror Site, Accept All Cookies', () => {
    for (const id of ['blockchain', 'dataLeak', 'mirrorSite', 'acceptAllCookies'] as const) {
      const build = corrupt(id)
      expect(build.stats).toEqual(createBuild().stats)
      expect(corruptionFlags(build)[id]).toBe(true)
    }
  })

  it('stacks with the stat cards both ways', () => {
    const build = applyCard(corrupt('bigData'), 'stat.sharpened')
    expect(build.stats.damage).toBeCloseTo(2.3)
  })
})

describe('movement curses never trap the mage', () => {
  const env = (mechanics: Partial<MotorEnv['mechanics']>): MotorEnv => ({
    grounded: true,
    touchingWallLeft: false,
    touchingWallRight: false,
    stats: { moveSpeed: 1, dashCooldownMs: 0 },
    mechanics: { doubleJump: true, airDash: false, wallJump: true, hatGlide: false, ...mechanics },
  })

  it('Deprecated jump() takes the jump, the double jump and the wall jump, but not the dash', () => {
    const state = createMotorState()
    expect(availableJump(state, env({ noJump: true }))).toBeNull()
    expect(availableJump(state, env({ noJump: true, wallJump: true }))).toBeNull()
    expect(canDash(state, env({ noJump: true }))).toBe(true)
    expect(availableJump(state, env({}))).toBe('ground')
  })

  it('the slowest build the augments can make still jumps the widest gap with the plain jump', () => {
    // Taking stat cards never goes below the starting speed, so the curses alone set the floor.
    const slowest = CORRUPTED.reduce((build, augment) => applyCorrupted(build, augment.id), createBuild()).stats.moveSpeed
    expect(slowest).toBeCloseTo(0.7)
    const airtime = (2 * JUMP_VELOCITY) / MOTOR.gravity
    expect(MOTOR.runSpeed * slowest * airtime).toBeGreaterThan(MAX_GAP_TILES * TILE)
  })
})
