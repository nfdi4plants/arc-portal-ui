import { describe, expect, it } from 'vitest'
import { createRng } from '../../../src/game/contracts/rng'
import { createLinePicker, FAIR_WORDS, TRADER_LINES, TRADER_LORE } from '../../../src/game/model/progression'

const moods = Object.keys(TRADER_LINES) as (keyof typeof TRADER_LINES)[]

describe('FAIR trader lines', () => {
  it('has a dozen or more greetings and goodbyes', () => {
    expect(TRADER_LINES.greeting.length).toBeGreaterThanOrEqual(12)
    expect(TRADER_LINES.goodbye.length).toBeGreaterThanOrEqual(12)
  })

  it('names a FAIR principle in every line', () => {
    for (const mood of moods) {
      for (const line of TRADER_LINES[mood]) expect(FAIR_WORDS.some((word) => line.includes(word)), line).toBe(true)
    }
  })

  it('keeps every line short enough for a speech bubble', () => {
    for (const mood of moods) for (const line of TRADER_LINES[mood]) expect(line.length, line).toBeLessThanOrEqual(95)
  })

  it('has no line twice', () => {
    const all = moods.flatMap((mood) => [...TRADER_LINES[mood]])
    expect(new Set(all).size).toBe(all.length)
  })

  it('names no currency but the Ontology Fragments', () => {
    for (const mood of moods) for (const line of TRADER_LINES[mood]) expect(line, line).not.toMatch(/\b(coins?|money|cash)\b/i)
  })
})

describe('the trader story', () => {
  it('tells about the fragments and the ontologies in every story line', () => {
    for (const mood of moods) {
      for (const line of TRADER_LORE[mood]) {
        expect(TRADER_LINES[mood], line).toContain(line)
        expect(line, line).toMatch(/fragment/i)
        expect(line, line).toMatch(/ontolog|FAIRer/i)
      }
    }
  })

  it('comes up about one line in three, not every time', () => {
    for (const mood of ['greeting', 'goodbye', 'bought', 'poor'] as const) {
      const share = TRADER_LORE[mood].length / TRADER_LINES[mood].length
      expect(share, mood).toBeGreaterThanOrEqual(0.25)
      expect(share, mood).toBeLessThanOrEqual(0.4)
    }
    const lore = new Set<string>(TRADER_LORE.greeting)
    const pick = createLinePicker(TRADER_LINES.greeting, createRng('story'))
    let told = 0
    for (let i = 0; i < 900; i++) if (lore.has(pick())) told++
    expect(told / 900).toBeGreaterThan(0.22)
    expect(told / 900).toBeLessThan(0.42)
  })
})

describe('createLinePicker', () => {
  it('never says the same line twice in a row and gets round to every line', () => {
    const pick = createLinePicker(TRADER_LINES.greeting, createRng('picker'))
    const seen = new Set<string>()
    let last = ''
    for (let i = 0; i < 600; i++) {
      const line = pick()
      expect(line).not.toBe(last)
      seen.add(line)
      last = line
    }
    expect(seen.size).toBe(TRADER_LINES.greeting.length)
  })

  it('picks the same lines for the same seed', () => {
    const a = createLinePicker(TRADER_LINES.goodbye, createRng('seed'))
    const b = createLinePicker(TRADER_LINES.goodbye, createRng('seed'))
    for (let i = 0; i < 20; i++) expect(a()).toBe(b())
  })
})
