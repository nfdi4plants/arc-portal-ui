import { describe, expect, it } from 'vitest'
import { createRingBuffer } from '../../../src/game/phaser/player/weapons/helpers'

describe('createRingBuffer', () => {
  it('has no snapshot before the first push', () => {
    const buffer = createRingBuffer(4)
    expect(buffer.oldest()).toBeNull()
    expect(buffer.size()).toBe(0)
  })

  it('returns the first push as the oldest while it is not full', () => {
    const buffer = createRingBuffer(4)
    buffer.push(1, 2, 30)
    buffer.push(3, 4, 40)
    expect(buffer.oldest()).toEqual({ x: 1, y: 2, hp: 30 })
    expect(buffer.size()).toBe(2)
  })

  it('overwrites the oldest entry once full', () => {
    const buffer = createRingBuffer(3)
    for (let i = 1; i <= 5; i++) buffer.push(i, i * 10, i * 100)
    expect(buffer.size()).toBe(3)
    expect(buffer.oldest()).toEqual({ x: 3, y: 30, hp: 300 })
  })

  it('starts over after clear', () => {
    const buffer = createRingBuffer(3)
    buffer.push(1, 1, 1)
    buffer.clear()
    expect(buffer.oldest()).toBeNull()
    buffer.push(9, 8, 7)
    expect(buffer.oldest()).toEqual({ x: 9, y: 8, hp: 7 })
  })
})
