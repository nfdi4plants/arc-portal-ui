import { describe, expect, it } from 'vitest'
import { BOSS_FREEZE_SLOW, addStatus, createStatus, statusTimeScale, tickStatus } from '../../../src/game/phaser/combat/status'

describe('status effects', () => {
  it('freezes a mob for the whole time, then lets it run again', () => {
    const state = createStatus()
    addStatus(state, { kind: 'freeze', ms: 1500 }, false)
    expect(statusTimeScale(state)).toBe(0)
    tickStatus(state, 1400)
    expect(statusTimeScale(state)).toBe(0)
    tickStatus(state, 100)
    expect(statusTimeScale(state)).toBe(1)
  })

  it('never freezes a boss and slows it to half speed instead', () => {
    const state = createStatus()
    addStatus(state, { kind: 'freeze', ms: 1500 }, true)
    expect(state.freezeMs).toBe(0)
    expect(statusTimeScale(state)).toBe(BOSS_FREEZE_SLOW)
    tickStatus(state, 1500)
    expect(statusTimeScale(state)).toBe(1)
  })

  it('gives a boss half the slow a mob gets', () => {
    const mob = createStatus()
    const boss = createStatus()
    addStatus(mob, { kind: 'slow', ms: 300, factor: 0.7 }, false)
    addStatus(boss, { kind: 'slow', ms: 300, factor: 0.7 }, true)
    expect(statusTimeScale(mob)).toBeCloseTo(0.7)
    expect(statusTimeScale(boss)).toBeCloseTo(0.85)
  })

  it('keeps the stronger slow and the longer time when slows overlap', () => {
    const state = createStatus()
    addStatus(state, { kind: 'slow', ms: 300, factor: 0.7 }, false)
    addStatus(state, { kind: 'slow', ms: 200, factor: 0.9 }, false)
    expect(statusTimeScale(state)).toBeCloseTo(0.7)
    expect(state.slowMs).toBe(300)
  })

  it('lets a fume hood slow a mob that a freeze just let go', () => {
    const state = createStatus()
    addStatus(state, { kind: 'freeze', ms: 100 }, false)
    addStatus(state, { kind: 'slow', ms: 300, factor: 0.7 }, false)
    expect(statusTimeScale(state)).toBe(0)
    tickStatus(state, 150)
    expect(statusTimeScale(state)).toBeCloseTo(0.7)
  })
})
