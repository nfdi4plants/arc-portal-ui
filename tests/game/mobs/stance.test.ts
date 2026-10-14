import { describe, expect, it } from 'vitest'
import { STANCE_MS, createStance, stanceMods, stepStance } from '../../../src/game/phaser/mobs/stance'

const STEP_MS = 1000 / 120

describe('stance clock', () => {
  it('starts aggressive and flips after three seconds of fixed steps', () => {
    const stance = createStance()
    let flips = 0
    let elapsed = 0
    while (elapsed < STANCE_MS - STEP_MS) {
      if (stepStance(stance, STEP_MS)) flips++
      elapsed += STEP_MS
    }
    expect(flips).toBe(0)
    expect(stance.aggressive).toBe(true)
    while (!stepStance(stance, STEP_MS)) elapsed += STEP_MS
    expect(stance.aggressive).toBe(false)
  })

  it('flips back after another three seconds', () => {
    const stance = createStance()
    stepStance(stance, STANCE_MS)
    stepStance(stance, STANCE_MS)
    expect(stance.aggressive).toBe(true)
  })

  it('keeps the offset it starts with, so mobs do not flip together', () => {
    const early = createStance(2900)
    expect(stepStance(early, 150)).toBe(true)
  })
})

describe('stanceMods', () => {
  it('speeds up and attacks faster when aggressive', () => {
    expect(stanceMods(createStance(0, true))).toEqual({ speed: 1.3, cooldown: 0.7, damageTaken: 1 })
  })

  it('takes less damage when defensive', () => {
    expect(stanceMods(createStance(0, false)).damageTaken).toBe(0.6)
  })
})
