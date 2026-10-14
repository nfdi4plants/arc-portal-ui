import { describe, expect, it } from 'vitest'
import { createMark, inCone, nearestAhead } from '../../../src/game/phaser/player/weapons/helpers'

function enemy(id: string, x: number, y = 0, dead = false) {
  return { id, position: () => ({ x, y }), isDead: () => dead }
}

describe('inCone', () => {
  const origin = { x: 0, y: 0 }

  it('takes points ahead within range and angle', () => {
    expect(inCone(origin, 1, { x: 100, y: 10 }, 144, 0.6)).toBe(true)
    expect(inCone(origin, -1, { x: -100, y: -10 }, 144, 0.6)).toBe(true)
  })

  it('leaves out points behind, too far or too far off to the side', () => {
    expect(inCone(origin, 1, { x: -40, y: 0 }, 144, 0.6)).toBe(false)
    expect(inCone(origin, 1, { x: 160, y: 0 }, 144, 0.6)).toBe(false)
    expect(inCone(origin, 1, { x: 30, y: 60 }, 144, 0.6)).toBe(false)
  })

  it('counts a body that overlaps the edge through the slack', () => {
    expect(inCone(origin, 1, { x: 150, y: 0 }, 144, 0.6, 12)).toBe(true)
    expect(inCone(origin, 1, { x: -8, y: 0 }, 144, 0.6, 12)).toBe(true)
  })
})

describe('nearestAhead', () => {
  it('picks the nearest living enemy on the facing side', () => {
    const behind = enemy('behind', -20)
    const ahead = enemy('ahead', 60)
    const far = enemy('far', 120)
    expect(nearestAhead({ x: 0, y: 0 }, 1, [behind, far, ahead], 300)).toBe(ahead)
    expect(nearestAhead({ x: 0, y: 0 }, -1, [behind, far, ahead], 300)).toBe(behind)
  })

  it('skips the dead and returns null with nothing in reach', () => {
    expect(nearestAhead({ x: 0, y: 0 }, 1, [enemy('dead', 30, 0, true), enemy('far', 400)], 300)).toBeNull()
  })
})

describe('createMark', () => {
  const boss = enemy('boss', 50)
  const mob = enemy('mob', 80)

  it('adds 30% to hits on the marked target only', () => {
    const mark = createMark<object>(0.3)
    mark.set(boss, 6000)
    expect(mark.bonus(boss, 20)).toBeCloseTo(6)
    expect(mark.bonus(mob, 20)).toBe(0)
  })

  it('runs out after its time', () => {
    const mark = createMark<object>(0.3)
    mark.set(mob, 6000)
    mark.tick(5990)
    expect(mark.bonus(mob, 10)).toBeCloseTo(3)
    mark.tick(10)
    expect(mark.target()).toBeNull()
    expect(mark.bonus(mob, 10)).toBe(0)
  })

  it('moves to a new target when marked again', () => {
    const mark = createMark<object>(0.3)
    mark.set(mob, 6000)
    mark.set(boss, 6000)
    expect(mark.bonus(mob, 10)).toBe(0)
    expect(mark.bonus(boss, 10)).toBeCloseTo(3)
  })
})
