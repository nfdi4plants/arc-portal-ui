import { describe, expect, it } from 'vitest'
import { relativeTime } from './time.ts'

const now = new Date('2026-10-13T12:00:00Z')
const ago = (ms: number) => new Date(now.getTime() - ms).toISOString()
const MIN = 60_000, HOUR = 60 * MIN, DAY = 24 * HOUR

describe('relativeTime', () => {
  it.each([
    [30_000, 'just now'],
    [5 * MIN, '5 minutes ago'],
    [DAY, 'yesterday'],
    [3 * DAY, '3 days ago'],
    [35 * DAY, 'last month'],
    [800 * DAY, '2 years ago'],
  ])('formats %i ms ago as "%s"', (elapsed, text) => {
    expect(relativeTime(ago(elapsed), now)).toBe(text)
  })
})
