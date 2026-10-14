import { describe, expect, it } from 'vitest'
import { createRng } from '../../../src/game/contracts/rng'
import {
  canStagger,
  createScheduler,
  LIGHT_GAP_MS,
  MIN_WINDUP_MS,
  punishWindowMs,
  windupMs,
  type SchedulableAttack,
} from '../../../src/game/phaser/bosses/scheduler'

const attack = (id: string, heavy: boolean, cooldownMs: number): SchedulableAttack => ({ id, heavy, cooldownMs })

const MIXED = [attack('h1', true, 1500), attack('h2', true, 1500), attack('l1', false, 600), attack('l2', false, 600)]

// Runs attacks that end the moment they start and returns the ids in the order they were picked.
function simulate(attacks: SchedulableAttack[], seed: string, totalMs: number): string[] {
  const scheduler = createScheduler(createRng(seed))
  scheduler.setAttacks(attacks, 0)
  const picked: string[] = []
  for (let t = 0; t < totalMs; t += 10) {
    scheduler.tick(10)
    const next = scheduler.next()
    if (!next) continue
    picked.push(next.id)
    scheduler.complete()
  }
  return picked
}

describe('createScheduler', () => {
  it('never picks two heavy attacks in a row', () => {
    const heavy = (id: string) => id.startsWith('h')
    for (const seed of ['a', 'b', 'c']) {
      const picked = simulate(MIXED, seed, 300_000)
      expect(picked.some(heavy)).toBe(true)
      for (let i = 1; i < picked.length; i++) expect(heavy(picked[i - 1]) && heavy(picked[i])).toBe(false)
    }
  })

  it.each([
    { quality: 0, idle: 600 },
    { quality: 0.5, idle: 1050 },
    { quality: 1, idle: 1500 },
  ])('leaves $idle ms to punish after a heavy attack at quality $quality', ({ quality, idle }) => {
    expect(punishWindowMs(quality)).toBe(idle)
    const scheduler = createScheduler(createRng('punish'))
    scheduler.setAttacks([attack('only', true, 0)], quality)
    expect(scheduler.next()?.id).toBe('only')
    scheduler.complete()
    scheduler.tick(idle - 1)
    expect(scheduler.next()).toBeNull()
    scheduler.tick(1)
    expect(scheduler.next()?.id).toBe('only')
  })

  it('waits only a short gap after a light attack', () => {
    const scheduler = createScheduler(createRng('light'))
    scheduler.setAttacks([attack('only', false, 0)], 1)
    scheduler.next()
    scheduler.complete()
    scheduler.tick(LIGHT_GAP_MS - 1)
    expect(scheduler.next()).toBeNull()
    scheduler.tick(1)
    expect(scheduler.next()?.id).toBe('only')
  })

  it('keeps an attack on cooldown until its cooldown has passed', () => {
    const scheduler = createScheduler(createRng('cooldown'))
    scheduler.setAttacks([attack('slow', false, 3000)], 0)
    scheduler.next()
    scheduler.complete()
    scheduler.tick(LIGHT_GAP_MS)
    expect(scheduler.next()).toBeNull()
    scheduler.tick(3000 - LIGHT_GAP_MS - 1)
    expect(scheduler.next()).toBeNull()
    scheduler.tick(1)
    expect(scheduler.next()?.id).toBe('slow')
  })

  it('picks the same sequence for the same seed', () => {
    expect(simulate(MIXED, 'same', 60_000)).toEqual(simulate(MIXED, 'same', 60_000))
  })

  it('switches to the new attack list on a phase change', () => {
    const scheduler = createScheduler(createRng('phase'))
    scheduler.setAttacks([attack('old', false, 5000)], 0)
    scheduler.next()
    scheduler.complete()

    const fresh = [attack('new1', false, 5000), attack('new2', true, 5000)]
    scheduler.setAttacks(fresh, 1, 500)
    expect(scheduler.busy()).toBe(false)
    scheduler.tick(499)
    expect(scheduler.next()).toBeNull()
    scheduler.tick(1)
    expect(fresh.map((a) => a.id)).toContain(scheduler.next()?.id)
  })
})

describe('windupMs', () => {
  it('never shows a zone for less than the minimum flash', () => {
    expect(windupMs(0)).toBe(MIN_WINDUP_MS)
    expect(windupMs(80)).toBe(80)
    expect(windupMs(900)).toBe(900)
  })
})

describe('canStagger', () => {
  it('lets a light attack be staggered at any point', () => {
    for (const phase of ['none', 'windup', 'active', 'recovery'] as const) expect(canStagger(phase, false)).toBe(true)
  })

  it('holds a stagger back while a heavy attack winds up or hits', () => {
    expect(canStagger('windup', true)).toBe(false)
    expect(canStagger('active', true)).toBe(false)
    expect(canStagger('recovery', true)).toBe(true)
    expect(canStagger('none', true)).toBe(true)
  })
})
