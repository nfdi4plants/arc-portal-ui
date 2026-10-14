import { describe, expect, it } from 'vitest'
import { visibleBounds } from '../../src/game/model/image'

function image(width: number, height: number, opaque: ReadonlyArray<readonly [number, number]>) {
  const data = new Uint8ClampedArray(width * height * 4)
  for (const [x, y] of opaque) data[(y * width + x) * 4 + 3] = 255
  return data
}

describe('visibleBounds', () => {
  it('returns null for an empty image', () => {
    expect(visibleBounds(image(4, 3, []), 4, 3)).toBeNull()
  })

  it('returns a 1 x 1 box for a single pixel', () => {
    expect(visibleBounds(image(5, 4, [[3, 2]]), 5, 4)).toEqual({ x: 3, y: 2, width: 1, height: 1 })
  })

  it('returns the box around a rectangle', () => {
    const pixels: Array<readonly [number, number]> = []
    for (let y = 1; y <= 3; y++) for (let x = 2; x <= 5; x++) pixels.push([x, y])
    expect(visibleBounds(image(8, 6, pixels), 8, 6)).toEqual({ x: 2, y: 1, width: 4, height: 3 })
  })
})
