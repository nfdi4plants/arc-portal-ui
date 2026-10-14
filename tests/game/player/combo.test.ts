import { describe, expect, it } from 'vitest'
import type { WeaponMoveset } from '../../../src/game/contracts/player'
import { COMBO_GRACE_MS, createAttackMachine } from '../../../src/game/phaser/player/attacks'
import { staffMoveset } from '../../../src/game/phaser/player/staffMoveset'
import type { Core } from '../../../src/game/phaser/player/weapons/core'
import { scalpelMoveset, wandMoveset } from '../../../src/game/phaser/player/weapons/light'
import { createMoveLayer } from '../../../src/game/phaser/player/weapons/moves'
import { createScheduler } from '../../../src/game/phaser/player/weapons/scheduler'

const STEP_MS = 10
const GROUND = { grounded: true, attackSpeed: 1, canStart: true }

// The move layer with Triple Combo owned. wrap() only reads the flags and the version, so the rest
// of the core is a stand-in.
function wrapped(base: WeaponMoveset, tripleCombo = true): WeaponMoveset {
  const core = {
    deps: { player: { on: () => () => {} }, scene: {}, combat: {} },
    flags: { tripleCombo },
    version: 1,
    scheduler: createScheduler(),
    fx: {},
    build: { stats: { attackSpeed: 1 } },
    own() {},
  } as unknown as Core
  return createMoveLayer(core).wrap(base)
}

// Presses light at the given times (ms from the first step) and returns the moves that started,
// with their start times.
function run(set: WeaponMoveset, pressAt: number[], untilMs = 3000): { name: string; at: number }[] {
  const started: { name: string; at: number }[] = []
  const presses = new Set(pressAt)
  let now = 0
  const machine = createAttackMachine({
    movesFor: (slot) => set.moves(slot, 1),
    onStart: (_slot, _index, move) => started.push({ name: move.name, at: now }),
    onActive: () => {},
  })
  for (now = 0; now < untilMs; now += STEP_MS) machine.step(STEP_MS, { light: presses.has(now), heavy: false }, GROUND)
  return started
}

const mash = (set: WeaponMoveset, pressAt: number[], untilMs = 3000) => run(set, pressAt, untilMs).map((start) => start.name)

const every = (intervalMs: number, count: number) => Array.from({ length: count }, (_, i) => i * intervalMs)

// The first staff jab ends this long after its press (startup, active and recovery).
const JAB_MS = 110 + 85 + 220

describe('light string chaining', () => {
  it('walks the staff string and the Triple Combo finisher with a press every 350 ms', () => {
    expect(mash(wrapped(staffMoveset), every(350, 4))).toEqual(['Staff jab', 'Staff jab', 'Staff thrust', 'Spin finisher'])
  })

  it('also chains a relaxed mash of 2.5 to 3.3 presses per second', () => {
    for (const interval of [300, 330, 400]) {
      expect(mash(wrapped(staffMoveset), every(interval, 4)), `${interval} ms`).toEqual(['Staff jab', 'Staff jab', 'Staff thrust', 'Spin finisher'])
    }
  })

  it('walks the string under a fast mash, extra presses merging into the one that waits', () => {
    expect(mash(wrapped(staffMoveset), every(180, 7))).toEqual(['Staff jab', 'Staff jab', 'Staff thrust', 'Spin finisher'])
  })

  it('appends the finisher to the scalpel string as well', () => {
    expect(mash(wrapped(scalpelMoveset), every(330, 5))).toEqual(['Scalpel cut', 'Scalpel cut', 'Scalpel cut', 'Scalpel slash', 'Spin finisher'])
  })

  it('starts over after the finisher', () => {
    expect(mash(wrapped(staffMoveset), every(350, 5))[4]).toBe('Staff jab')
  })

  it('has no finisher without Triple Combo', () => {
    expect(mash(wrapped(staffMoveset, false), every(350, 4))).toEqual(['Staff jab', 'Staff jab', 'Staff thrust', 'Staff jab'])
  })

  it('restarts at the first jab after a pause longer than the grace window', () => {
    // Rounded to a whole step, so the press lands on one.
    const late = Math.ceil((JAB_MS + COMBO_GRACE_MS + 50) / STEP_MS) * STEP_MS
    expect(mash(wrapped(staffMoveset), [0, late])).toEqual(['Staff jab', 'Staff jab'])
    // The second press opens the second jab's cancel window exactly, so it starts on the press.
    expect(mash(wrapped(staffMoveset), [0, 350, 350 + late])).toEqual(['Staff jab', 'Staff jab', 'Staff jab'])
  })

  it('restarts after a heavy in between', () => {
    const set = wrapped(staffMoveset)
    const started: string[] = []
    const machine = createAttackMachine({
      movesFor: (slot) => set.moves(slot, 1),
      onStart: (_slot, _index, move) => started.push(move.name),
      onActive: () => {},
    })
    for (let t = 0; t < 2500; t += STEP_MS) {
      machine.step(STEP_MS, { light: t === 0 || t === 1500, heavy: t === 300 }, GROUND)
    }
    expect(started).toEqual(['Staff jab', 'Staff slam', 'Staff jab'])
  })
})

describe('mashing', () => {
  // A press every 50 ms, far faster than any player keeps up.
  const frantic = (untilMs: number) => every(50, untilMs / 50)

  it('keeps the staff string with its finisher at or below 3 attacks per second', () => {
    const started = run(wrapped(staffMoveset), frantic(6000), 6000)
    expect(started.length / 6).toBeGreaterThan(2)
    expect(started.length / 6).toBeLessThanOrEqual(3)
  })

  it('keeps the wand, which shoots, at or below 3 shots per second', () => {
    const started = run(wrapped(wandMoveset), frantic(6000), 6000)
    expect(started.length / 6).toBeGreaterThan(2)
    expect(started.length / 6).toBeLessThanOrEqual(3)
  })

  it('stops at most one move after the last press, however long the mash went on', () => {
    for (const set of [wrapped(staffMoveset), wrapped(scalpelMoveset), wrapped(wandMoveset)]) {
      const presses = frantic(4000)
      const last = presses[presses.length - 1]
      const after = run(set, presses, 8000).filter((start) => start.at > last)
      expect(after.length, set.id).toBeLessThanOrEqual(1)
    }
  })
})
