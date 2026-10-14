import { describe, expect, it } from 'vitest'
import { nearest, nearestLiving, pickChainTarget } from '../../../src/game/phaser/player/weapons/helpers'

function enemy(id: string, x: number, y = 0, dead = false) {
  return { id, position: () => ({ x, y }), isDead: () => dead }
}

describe('nearest', () => {
  it('picks the closest item within range', () => {
    const near = enemy('near', 40)
    const far = enemy('far', 90)
    expect(nearest({ x: 0, y: 0 }, [far, near], 200)).toBe(near)
  })

  it('returns null when everything is out of range', () => {
    expect(nearest({ x: 0, y: 0 }, [enemy('far', 300)], 200)).toBeNull()
  })

  it('counts an item exactly at the range limit', () => {
    const edge = enemy('edge', 200)
    expect(nearest({ x: 0, y: 0 }, [edge], 200)).toBe(edge)
  })

  it('skips items that accept refuses', () => {
    const near = enemy('near', 10)
    const next = enemy('next', 50)
    expect(nearest({ x: 0, y: 0 }, [near, next], 200, (item) => item !== near)).toBe(next)
  })

  it('keeps the first of two equally distant items', () => {
    const left = enemy('left', -30)
    const right = enemy('right', 30)
    expect(nearest({ x: 0, y: 0 }, [left, right], 200)).toBe(left)
  })
})

describe('nearestLiving', () => {
  it('ignores dead enemies', () => {
    const dead = enemy('dead', 5, 0, true)
    const alive = enemy('alive', 80)
    expect(nearestLiving({ x: 0, y: 0 }, [dead, alive], 200)).toBe(alive)
  })
})

describe('pickChainTarget', () => {
  it('chooses the nearest other tagged enemy within range', () => {
    const source = enemy('source', 0)
    const close = enemy('close', 60)
    const closer = enemy('closer', 40)
    const tagged = new Set([source, close, closer])
    expect(pickChainTarget(source, [source, close, closer], tagged, 160)).toBe(closer)
  })

  it('never returns the source itself', () => {
    const source = enemy('source', 0)
    expect(pickChainTarget(source, [source], new Set([source]), 160)).toBeNull()
  })

  it('skips untagged and dead enemies', () => {
    const source = enemy('source', 0)
    const untagged = enemy('untagged', 20)
    const dead = enemy('dead', 30, 0, true)
    const tagged = new Set([source, dead])
    expect(pickChainTarget(source, [source, untagged, dead], tagged, 160)).toBeNull()
  })

  it('ignores tagged enemies beyond 160 units', () => {
    const source = enemy('source', 0)
    const far = enemy('far', 161)
    expect(pickChainTarget(source, [source, far], new Set([source, far]), 160)).toBeNull()
  })
})
