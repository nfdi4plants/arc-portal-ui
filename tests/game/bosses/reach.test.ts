import { describe, expect, it } from 'vitest'
import type { BossAttackKind, BossAttackSpec } from '../../../src/game/contracts/content'
import { createRng } from '../../../src/game/contracts/rng'
import { STEP_MS, TILE } from '../../../src/game/contracts/constants'
import { attackTemplate, HEAVY_KINDS, LIGHT_KINDS } from '../../../src/game/model/content/bossAttacks'
import { MOTOR } from '../../../src/game/model/input/motor'
import {
  ADD_CROUCH_MS,
  ADD_HOP_MS,
  ADD_SPEED,
  CAMP_MS,
  CAMP_WEIGHT,
  campWeight,
  createAddMotion,
  createPerchWatch,
  isCamping,
  stepAdd,
  watchPerch,
} from '../../../src/game/phaser/bosses/reach'
import { createScheduler } from '../../../src/game/phaser/bosses/scheduler'
import { arenaPlatforms, JUMP_APEX, PLATFORM_LIFT } from '../../../src/game/phaser/bosses/zones'
import type { ArenaPlatform } from '../../../src/game/phaser/bosses/zones'

// An arena like the boss scenes build at the default view width, floor at y 0.
const WIDTH = Math.round((1.6 * 640) / TILE) * TILE
const ARENA = { left: 0, right: WIDTH, floorY: 0 }
const PLATFORMS = arenaPlatforms(0, WIDTH, 0)
const middle = (p: ArenaPlatform) => p.x + p.w / 2
const reaches = (kind: BossAttackKind) => CAMP_WEIGHT[kind] > 0

function spec(kind: BossAttackKind, heavy: boolean): BossAttackSpec {
  const template = attackTemplate('reagentGolem', kind, heavy)
  return { id: `${kind}.${heavy ? 'h' : 'l'}`, telegraphMs: 400, ...template }
}

describe('watchPerch', () => {
  const p = PLATFORMS[1]

  it('counts the time on a platform and calls it camping after CAMP_MS', () => {
    const watch = createPerchWatch()
    for (let t = 0; t < CAMP_MS - STEP_MS; t += STEP_MS) watchPerch(watch, PLATFORMS, middle(p), p.top, true, STEP_MS)
    expect(watch.ledge).toBe(p)
    expect(isCamping(watch)).toBe(false)
    watchPerch(watch, PLATFORMS, middle(p), p.top, true, 2 * STEP_MS)
    expect(isCamping(watch)).toBe(true)
  })

  it('keeps counting while the player jumps on the platform', () => {
    const watch = createPerchWatch()
    watchPerch(watch, PLATFORMS, middle(p), p.top, true, CAMP_MS)
    watchPerch(watch, PLATFORMS, middle(p), p.top - 50, false, 300)
    expect(watch.ledge).toBe(p)
    expect(isCamping(watch)).toBe(true)
  })

  it('stops on the floor at once, and a short drop does not reset the time up there', () => {
    const watch = createPerchWatch()
    watchPerch(watch, PLATFORMS, middle(p), p.top, true, CAMP_MS + 1000)
    watchPerch(watch, PLATFORMS, middle(p) + 60, 0, true, 300)
    expect(isCamping(watch)).toBe(false)
    watchPerch(watch, PLATFORMS, middle(p), p.top, true, STEP_MS)
    expect(isCamping(watch)).toBe(true)
  })

  it('never counts a player who only jumps from the floor', () => {
    const watch = createPerchWatch()
    for (let t = 0; t < 10_000; t += STEP_MS) {
      const air = t % 800 < 500
      watchPerch(watch, PLATFORMS, 30, air ? -70 : 0, !air, STEP_MS)
    }
    expect(isCamping(watch)).toBe(false)
  })
})

// Plays a fight against a player who jumps onto a platform at the start and stays there. Every
// attack takes ATTACK_MS from its start to its end. Returns each pick with its time.
const ATTACK_MS = 1200

function fightOnPlatform(attacks: BossAttackSpec[], seed: string, totalMs: number): { at: number; kind: BossAttackKind }[] {
  const scheduler = createScheduler<BossAttackSpec>(createRng(seed))
  scheduler.setAttacks(attacks, 0.5, 1200)
  const watch = createPerchWatch()
  const p = PLATFORMS[0]
  const picks: { at: number; kind: BossAttackKind }[] = []
  let busyMs = 0
  for (let t = 0; t < totalMs; t += STEP_MS) {
    watchPerch(watch, PLATFORMS, middle(p), p.top, true, STEP_MS)
    scheduler.tick(STEP_MS)
    if (busyMs > 0) {
      busyMs -= STEP_MS
      if (busyMs <= 0) scheduler.complete()
      continue
    }
    const next = scheduler.next(isCamping(watch) ? campWeight : undefined)
    if (!next) continue
    picks.push({ at: t, kind: next.kind })
    busyMs = ATTACK_MS
  }
  return picks
}

// Every boss a genome can give: one or two heavy kinds and one or two light kinds, all different.
function everyBoss(): BossAttackSpec[][] {
  const bosses: BossAttackSpec[][] = []
  for (const heavy of HEAVY_KINDS) {
    for (const light of LIGHT_KINDS) {
      if (light === heavy) continue
      bosses.push([spec(heavy, true), spec(light, false)])
      for (const light2 of LIGHT_KINDS) if (light2 !== light && light2 !== heavy) bosses.push([spec(heavy, true), spec(light, false), spec(light2, false)])
    }
  }
  return bosses
}

describe('a boss against a player who camps on a platform', () => {
  it('has an attack that reaches a platform in every light slot, so every boss has one', () => {
    for (const kind of LIGHT_KINDS) expect(reaches(kind)).toBe(true)
  })

  it('keeps the floor-only attacks a dodge for the first seconds', () => {
    const picks = fightOnPlatform([spec('shockwave', true), spec('charge', false)], 'early', CAMP_MS)
    expect(picks.some((pick) => pick.kind === 'shockwave' || pick.kind === 'charge')).toBe(true)
  })

  it.each(everyBoss().map((attacks) => [attacks.map((a) => a.id).join(' '), attacks] as const))(
    '%s goes for the platform within a few seconds and keeps at it',
    (_, attacks) => {
      const total = 40_000
      const picks = fightOnPlatform(attacks, attacks.map((a) => a.id).join(), total)
      const camping = picks.filter((pick) => pick.at >= CAMP_MS)
      // Time for the attack that runs when the camping starts, the longest cooldown and the punish window.
      const bound = CAMP_MS + ATTACK_MS + 4400 + 1500
      expect(camping.length).toBeGreaterThan(0)
      expect(camping[0].at).toBeLessThanOrEqual(bound)
      expect(camping.every((pick) => reaches(pick.kind))).toBe(true)
      // No long lull either: the next reaching attack always follows within the same bound.
      for (let i = 1; i < camping.length; i++) expect(camping[i].at - camping[i - 1].at).toBeLessThanOrEqual(bound - CAMP_MS)
      expect(total - camping[camping.length - 1].at).toBeLessThanOrEqual(bound - CAMP_MS)
    },
  )
})

describe('createScheduler with weights', () => {
  const light = { id: 'l', heavy: false, cooldownMs: 0, kind: 'sweep' as BossAttackKind }
  const floor = { id: 'f', heavy: false, cooldownMs: 0, kind: 'shockwave' as BossAttackKind }

  it('never picks an attack of weight 0 while one that weighs more is in the list', () => {
    const scheduler = createScheduler<typeof light>(createRng('weights'))
    scheduler.setAttacks([floor, light], 0)
    for (let i = 0; i < 200; i++) {
      expect(scheduler.next(campWeight)?.id).toBe('l')
      scheduler.complete(0)
    }
  })

  it('picks as usual when nothing in the list weighs more than 0', () => {
    const scheduler = createScheduler<typeof light>(createRng('weights'))
    scheduler.setAttacks([floor], 0)
    expect(scheduler.next(campWeight)?.id).toBe('f')
  })
})

// The time from the moment an add on the floor heads for the player's platform until it stands on
// it. The player stays on the platform the whole time.
function addClimbMs(startX: number, p: ArenaPlatform): number {
  const m = createAddMotion(startX)
  for (let t = 0; t < 60_000; t += STEP_MS) {
    stepAdd(m, middle(p), p, ARENA, 22, STEP_MS)
    if (m.ledge === p) return t + STEP_MS
  }
  return Infinity
}

// The player runs to the platform and jumps on it: the run, then the rise of a plain jump to it.
function playerClimbMs(startX: number, p: ArenaPlatform): number {
  const run = Math.max(0, Math.abs(startX - middle(p)) - p.w / 2)
  const v = Math.sqrt(2 * MOTOR.gravity * JUMP_APEX)
  const rise = (v - Math.sqrt(v * v - 2 * MOTOR.gravity * PLATFORM_LIFT)) / MOTOR.gravity
  return (run / MOTOR.runSpeed + rise) * 1000
}

describe('stepAdd', () => {
  const p = PLATFORMS[1]

  it.each([middle(p), p.x - 10, p.x - 200, p.x + p.w + 150, ARENA.left + 30, ARENA.right - 30])(
    'gets an add from x %d onto the player\'s platform in bounded time, slower than the player',
    (startX) => {
      const ms = addClimbMs(startX, p)
      const walk = (Math.abs(startX - middle(p)) + p.w) / ADD_SPEED
      expect(ms).toBeLessThanOrEqual(walk * 1000 + ADD_CROUCH_MS + ADD_HOP_MS + 50)
      expect(ms).toBeGreaterThan(2 * playerClimbMs(startX, p))
    },
  )

  it('lands it on the platform and keeps it there while it chases the player', () => {
    const m = createAddMotion(p.x - 40)
    for (let t = 0; t < 5000; t += STEP_MS) stepAdd(m, middle(p) + 400, p, ARENA, 22, STEP_MS)
    expect(m.ledge).toBe(p)
    expect(m.lift).toBe(ARENA.floorY - p.top)
    expect(m.x).toBeGreaterThanOrEqual(p.x)
    expect(m.x).toBeLessThanOrEqual(p.x + p.w)
  })

  it('drops it back to the floor when the player leaves the platform, and up the next one', () => {
    const m = createAddMotion(middle(p))
    for (let t = 0; t < 5000 && m.ledge !== p; t += STEP_MS) stepAdd(m, middle(p), p, ARENA, 22, STEP_MS)
    expect(m.ledge).toBe(p)
    let t = 0
    for (; t < 5000 && (m.ledge || m.hopMs >= 0); t += STEP_MS) stepAdd(m, middle(p) + 160, null, ARENA, 22, STEP_MS)
    expect(m.lift).toBe(0)
    expect(t).toBeLessThan(2000)
    const q = PLATFORMS[2]
    for (t = 0; t < 30_000 && m.ledge !== q; t += STEP_MS) stepAdd(m, middle(q), q, ARENA, 22, STEP_MS)
    expect(m.ledge).toBe(q)
  })

  it('never rises much higher than the platform it hops onto', () => {
    const m = createAddMotion(p.x - 40)
    let highest = 0
    for (let t = 0; t < 4000; t += STEP_MS) {
      stepAdd(m, middle(p), p, ARENA, 22, STEP_MS)
      highest = Math.max(highest, m.lift)
    }
    expect(highest).toBeGreaterThan(PLATFORM_LIFT)
    expect(highest).toBeLessThanOrEqual(PLATFORM_LIFT + 30)
  })
})
