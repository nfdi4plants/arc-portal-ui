import { describe, expect, it } from 'vitest'
import { SPREAD_DEG, aimVelocity, leadPoint, lobFlightS, lobVelocity } from '../../../src/game/phaser/mobs/aim'

const origin = { x: 0, y: 0 }
const still = { x: 0, y: 0 }

describe('leadPoint', () => {
  it('meets a moving target where the shot and the target arrive together', () => {
    const target = { x: 100, y: 0 }
    const velocity = { x: 50, y: 0 }
    const point = leadPoint(origin, target, velocity, 200)
    const targetTime = (point.x - target.x) / velocity.x
    const shotTime = Math.hypot(point.x - origin.x, point.y - origin.y) / 200
    expect(point.x).toBeGreaterThan(target.x)
    expect(shotTime).toBeCloseTo(targetTime, 1)
  })

  it('aims at the target itself when it stands still', () => {
    expect(leadPoint(origin, { x: 80, y: -40 }, still, 200)).toEqual({ x: 80, y: -40 })
  })
})

describe('aimVelocity', () => {
  const target = { x: 100, y: 0 }
  const rising = { x: 0, y: -100 }
  const angleOf = (v: { x: number; y: number }) => (Math.atan2(v.y, v.x) * 180) / Math.PI

  it('leads the target with a calibrated weapon', () => {
    const calibrated = aimVelocity(origin, target, rising, 200, true, 0.5)
    expect(calibrated.y).toBeLessThan(0)
    expect(Math.hypot(calibrated.x, calibrated.y)).toBeCloseTo(200)
  })

  it('aims at the current position and adds no spread at the middle of the random range', () => {
    const v = aimVelocity(origin, target, rising, 200, false, 0.5)
    expect(v.x).toBeCloseTo(200)
    expect(v.y).toBeCloseTo(0)
  })

  it('spreads an uncalibrated shot by up to 12 degrees either way', () => {
    const low = angleOf(aimVelocity(origin, target, still, 200, false, 0))
    const high = angleOf(aimVelocity(origin, target, still, 200, false, 0.999999))
    expect(low).toBeCloseTo(-SPREAD_DEG, 1)
    expect(high).toBeCloseTo(SPREAD_DEG, 1)
  })

  it('ignores the random roll for a calibrated weapon', () => {
    expect(aimVelocity(origin, target, still, 200, true, 0)).toEqual(aimVelocity(origin, target, still, 200, true, 0.9))
  })
})

describe('lobVelocity', () => {
  it('brings a lobbed shot onto a standing target after the flight time', () => {
    const target = { x: 150, y: 20 }
    const flight = lobFlightS(Math.hypot(target.x, target.y))
    const v = lobVelocity(origin, target, still, flight, 900, true, 0)
    expect(v.x * flight).toBeCloseTo(target.x)
    expect(v.y * flight + 0.5 * 900 * flight * flight).toBeCloseTo(target.y)
  })

  it('aims at where a calibrated weapon expects a walking target to be', () => {
    const v = lobVelocity(origin, { x: 100, y: 0 }, { x: 40, y: 0 }, 0.5, 900, true, 0)
    expect(v.x * 0.5).toBeCloseTo(120)
  })
})
