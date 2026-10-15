import { describe, expect, it } from 'vitest'
import type { Action } from '../../../src/game/contracts/input'
import { entersPortal, interactPressed, portalOffer } from '../../../src/game/phaser/scenes/interaction'
import { createPortalFrame, PORTAL_SPAWN_MS, portalAt } from '../../../src/game/phaser/scenes/portalSpawn'

const keys = (...actions: Action[]): ReadonlySet<Action> => new Set(actions)

describe('the interact key', () => {
  it('is a fresh press of up', () => {
    expect(interactPressed(keys('up'))).toBe(true)
    expect(interactPressed(keys('up', 'right'))).toBe(true)
    expect(interactPressed(keys())).toBe(false)
    expect(interactPressed(keys('jump'))).toBe(false)
  })

  it('leaves an up attack pressed in the same step to the attack', () => {
    expect(interactPressed(keys('up', 'light'))).toBe(false)
    expect(interactPressed(keys('up', 'heavy'))).toBe(false)
  })
})

describe('portals', () => {
  it('are never entered by walking in, only with the interact key', () => {
    const offer = portalOffer(true, true)
    expect(offer).toBe('enter')
    expect(entersPortal(offer, keys('right'))).toBe(false)
    expect(entersPortal(offer, keys())).toBe(false)
    expect(entersPortal(offer, keys('up'))).toBe(true)
  })

  it('offer nothing out of reach', () => {
    expect(portalOffer(false, true)).toBeNull()
    expect(entersPortal(portalOffer(false, true), keys('up'))).toBe(false)
  })

  it('show no prompt and let nobody through while the boss portal forms', () => {
    const frame = createPortalFrame()
    for (let ms = 0; ms < PORTAL_SPAWN_MS; ms += 100) {
      const offer = portalOffer(true, portalAt(frame, ms).ready)
      expect(offer).toBeNull()
      expect(entersPortal(offer, keys('up'))).toBe(false)
    }
    expect(portalOffer(true, portalAt(frame, PORTAL_SPAWN_MS).ready)).toBe('enter')
  })

  it('stay shut while something blocks them, with a prompt that says so', () => {
    const offer = portalOffer(true, true, true)
    expect(offer).toBe('blocked')
    expect(entersPortal(offer, keys('up'))).toBe(false)
  })

  it('do not take a mage that starts an up attack in the portal', () => {
    expect(entersPortal(portalOffer(true, true), keys('up', 'light'))).toBe(false)
  })
})
