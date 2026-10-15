import { describe, expect, it } from 'vitest'
import type { Action } from '../../../src/game/contracts/input'
import { createRng } from '../../../src/game/contracts/rng'
import { createTraderBrain, inRange, rangeStep, TRADER_RANGES, type TraderPlan, type TraderSense } from '../../../src/game/phaser/scenes/traderAi'

const room = { left: 0, right: 600 }
const STEP = 1000 / 120

function sense(selfX: number, foeX: number, extra: Partial<TraderSense> = {}): TraderSense {
  return {
    self: { x: selfX, y: 300, grounded: true },
    foe: { x: foeX, y: 300, dead: false, heavyWindup: false },
    room,
    pressureReady: false,
    preprintReady: false,
    ...extra,
  }
}

const melee: TraderPlan = { light: 'melee', heavy: 'melee', pressureSlot: 1, preprintSlot: 2 }

// Runs the brain for `ms` and counts the steps each action goes down.
function presses(plan: TraderPlan, at: TraderSense, ms: number, seed = 'ai'): Map<Action, number> {
  const brain = createTraderBrain(plan, createRng(seed))
  const held = new Set<Action>()
  const before = new Set<Action>()
  const counts = new Map<Action, number>()
  for (let t = 0; t < ms; t += STEP) {
    brain.think(at, STEP, held)
    for (const action of held) if (!before.has(action)) counts.set(action, (counts.get(action) ?? 0) + 1)
    before.clear()
    for (const action of held) before.add(action)
  }
  return counts
}

describe('the trader keeps the distance of his weapons', () => {
  it('walks in for melee and backs off for a ranged weapon', () => {
    expect(rangeStep(100, 400, 'melee', room)).toBe(1)
    expect(rangeStep(400, 100, 'melee', room)).toBe(-1)
    expect(rangeStep(100, 140, 'melee', room)).toBe(0)
    expect(rangeStep(300, 340, 'ranged', room)).toBe(-1)
    expect(rangeStep(300, 300 + TRADER_RANGES.ranged.min + 10, 'ranged', room)).toBe(0)
  })

  it('does not back into a wall', () => {
    expect(rangeStep(20, 60, 'ranged', room)).toBe(0)
  })

  it('knows when an attack reaches', () => {
    expect(inRange(100, 150, 'melee')).toBe(true)
    expect(inRange(100, 400, 'melee')).toBe(false)
    expect(inRange(100, 280, 'ranged')).toBe(true)
  })
})

describe('the trader brain', () => {
  it('attacks a mage in reach with light strings and heavies, with breathers between', () => {
    const counts = presses(melee, sense(100, 150), 6000)
    expect(counts.get('light') ?? 0).toBeGreaterThan(6)
    expect(counts.get('heavy') ?? 0).toBeGreaterThan(0)
    // Breathers keep him readable: well under the mage's own mash rate of 3 per second.
    expect((counts.get('light') ?? 0) / 6).toBeLessThan(3)
  })

  it('walks towards a mage out of reach and attacks nothing', () => {
    const brain = createTraderBrain(melee, createRng('walk'))
    const held = new Set<Action>()
    brain.think(sense(100, 500), STEP, held)
    expect(held.has('right')).toBe(true)
    expect(held.has('light')).toBe(false)
  })

  it('shouts before Peer Pressure and presses it only after the shout', () => {
    const brain = createTraderBrain(melee, createRng('shout'))
    const held = new Set<Action>()
    let shoutAt = -1
    let pressAt = -1
    for (let t = 0; t < 20000 && pressAt < 0; t += STEP) {
      const shout = brain.think(sense(100, 400, { pressureReady: true }), STEP, held)
      if (shout === 'pressure' && shoutAt < 0) shoutAt = t
      if (held.has('ability2')) pressAt = t
    }
    expect(shoutAt).toBeGreaterThanOrEqual(0)
    expect(pressAt - shoutAt).toBeGreaterThanOrEqual(700)
  })

  it('stops when the mage is dead', () => {
    const counts = presses(melee, sense(100, 150, { foe: { x: 150, y: 300, dead: true, heavyWindup: false } }), 3000)
    expect(counts.size).toBe(0)
  })

  it('plays the same fight for the same seed', () => {
    expect([...presses(melee, sense(100, 150), 4000, 'same')]).toEqual([...presses(melee, sense(100, 150), 4000, 'same')])
  })
})
