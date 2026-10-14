import { describe, expect, it, vi } from 'vitest'
import { createScheduler } from '../../../src/game/phaser/player/weapons/scheduler'

describe('createScheduler', () => {
  it('runs a call once, in the step that reaches its delay', () => {
    const scheduler = createScheduler(4)
    const run = vi.fn()
    scheduler.at(50, run)
    for (let step = 0; step < 3; step++) scheduler.update(16)
    expect(run).not.toHaveBeenCalled()
    scheduler.update(16)
    expect(run).toHaveBeenCalledTimes(1)
    scheduler.update(16)
    expect(run).toHaveBeenCalledTimes(1)
  })

  it('drops the pending calls of a cancelled group and keeps the others', () => {
    const scheduler = createScheduler(4)
    const dropped = vi.fn()
    const otherGroup = vi.fn()
    const ungrouped = vi.fn()
    scheduler.at(30, dropped, 1)
    scheduler.at(30, otherGroup, 2)
    scheduler.at(30, ungrouped)
    scheduler.cancel(1)
    scheduler.update(40)
    expect(dropped).not.toHaveBeenCalled()
    expect(otherGroup).toHaveBeenCalledTimes(1)
    expect(ungrouped).toHaveBeenCalledTimes(1)
  })
})
