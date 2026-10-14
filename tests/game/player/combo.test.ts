import { describe, expect, it } from 'vitest'
import type { WeaponMoveset } from '../../../src/game/contracts/player'
import { COMBO_GRACE_MS, createAttackMachine } from '../../../src/game/phaser/player/attacks'
import { staffMoveset } from '../../../src/game/phaser/player/staffMoveset'
import type { Core } from '../../../src/game/phaser/player/weapons/core'
import { scalpelMoveset } from '../../../src/game/phaser/player/weapons/light'
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

// Presses light at the given times (ms from the first step) and returns the names of the moves
// that started.
function mash(set: WeaponMoveset, pressAt: number[], untilMs = 3000): string[] {
  const started: string[] = []
  const machine = createAttackMachine({
    movesFor: (slot) => set.moves(slot, 1),
    onStart: (_slot, _index, move) => started.push(move.name),
    onActive: () => {},
  })
  for (let t = 0; t < untilMs; t += STEP_MS) machine.step(STEP_MS, { light: pressAt.includes(t), heavy: false }, GROUND)
  return started
}

const every = (intervalMs: number, count: number) => Array.from({ length: count }, (_, i) => i * intervalMs)

describe('light string chaining', () => {
  it('walks the staff string and the Triple Combo finisher with a press every 180 ms', () => {
    expect(mash(wrapped(staffMoveset), every(180, 4))).toEqual(['Staff jab', 'Staff jab', 'Staff thrust', 'Spin finisher'])
  })

  it('also chains a relaxed mash of about 3 presses per second', () => {
    expect(mash(wrapped(staffMoveset), every(300, 4))).toEqual(['Staff jab', 'Staff jab', 'Staff thrust', 'Spin finisher'])
  })

  it('appends the finisher to the scalpel string as well', () => {
    expect(mash(wrapped(scalpelMoveset), every(180, 5))).toEqual(['Scalpel cut', 'Scalpel cut', 'Scalpel cut', 'Scalpel slash', 'Spin finisher'])
  })

  it('starts over after the finisher', () => {
    expect(mash(wrapped(staffMoveset), every(180, 5))[4]).toBe('Staff jab')
  })

  it('has no finisher without Triple Combo', () => {
    expect(mash(wrapped(staffMoveset, false), every(180, 4))).toEqual(['Staff jab', 'Staff jab', 'Staff thrust', 'Staff jab'])
  })

  it('restarts at the first jab after a pause longer than the grace window', () => {
    // The first jab ends 280 ms after the press.
    const late = 280 + COMBO_GRACE_MS + 50
    expect(mash(wrapped(staffMoveset), [0, late])).toEqual(['Staff jab', 'Staff jab'])
    expect(mash(wrapped(staffMoveset), [0, 180, 180 + late])).toEqual(['Staff jab', 'Staff jab', 'Staff jab'])
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
