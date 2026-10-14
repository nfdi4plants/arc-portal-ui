import { describe, expect, it } from 'vitest'
import { HoverIntent } from '../../../src/game/phaser/scenes/hoverIntent'

describe('HoverIntent', () => {
  it('opens only after the pointer rested on a target', () => {
    const intent = new HoverIntent<string>(250, 200)
    intent.over('a', 0)
    expect(intent.tick(249)).toBeNull()
    expect(intent.tick(250)).toBe('a')
  })

  it('does not open for a pointer that sweeps across targets', () => {
    const intent = new HoverIntent<string>(250, 200)
    intent.over('a', 0)
    intent.over('b', 200)
    expect(intent.tick(300)).toBeNull()
    expect(intent.tick(450)).toBe('b')
  })

  it('switches at once while open', () => {
    const intent = new HoverIntent<string>(250, 200)
    intent.over('a', 0)
    intent.tick(250)
    intent.over('b', 260)
    expect(intent.tick(261)).toBe('b')
  })

  it('closes after the grace time once the pointer left every target', () => {
    const intent = new HoverIntent<string>(250, 200)
    intent.over('a', 0)
    intent.tick(250)
    intent.over(null, 300)
    expect(intent.tick(499)).toBe('a')
    expect(intent.tick(500)).toBeNull()
  })

  it('returning to the target within the grace time keeps it open', () => {
    const intent = new HoverIntent<string>(250, 200)
    intent.over('a', 0)
    intent.tick(250)
    intent.over(null, 300)
    intent.over('a', 450)
    expect(intent.tick(900)).toBe('a')
  })

  it('stays open while the pointer is on the panel and closes after leaving it', () => {
    const intent = new HoverIntent<string>(250, 200)
    intent.over('a', 0)
    intent.tick(250)
    intent.over(null, 300)
    intent.panel(true, 310)
    expect(intent.tick(2000)).toBe('a')
    intent.panel(false, 2000)
    expect(intent.tick(2100)).toBe('a')
    expect(intent.tick(2200)).toBeNull()
  })

  it('opens again after a reset while the pointer stays on the target', () => {
    const intent = new HoverIntent<string>(250, 200)
    intent.over('a', 0)
    intent.tick(250)
    intent.reset(1000)
    expect(intent.tick(1100)).toBeNull()
    expect(intent.tick(1250)).toBe('a')
  })

  it('closes although the panel state is reported every frame', () => {
    const intent = new HoverIntent<string>(250, 200)
    intent.over('a', 0)
    intent.tick(250)
    intent.over(null, 300)
    let shown: string | null = 'a'
    for (let now = 300; now <= 520; now += 16) {
      intent.panel(false, now)
      intent.over(null, now)
      shown = intent.tick(now)
    }
    expect(shown).toBeNull()
  })
})
