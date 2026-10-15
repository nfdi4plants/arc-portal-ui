import { describe, expect, it } from 'vitest'
import { cardHitRect, type CardPose } from '../../../src/game/phaser/scenes/cardHit'

// The poses of the level-up screen: 4 degrees of tilt, a lift of 4% and 7% growth under the pointer.
const pose: CardPose = { w: 100, h: 136, tilt: (4 * Math.PI) / 180, lift: 0.04, bob: 0.012, hoverScale: 1.07, gap: 12 }

describe('cardHitRect', () => {
  it('covers the top of a hovered card, which lifts and grows past the rest size', () => {
    const rect = cardHitRect(pose)
    const hoveredTop = -pose.lift * pose.h - (pose.h * pose.hoverScale) / 2
    expect(rect.top).toBeLessThanOrEqual(hoveredTop - pose.bob * pose.h)
    expect(rect.top).toBeLessThan(-pose.h / 2)
  })

  it('covers the sides of a hovered card and the corners of a tilted one', () => {
    const rect = cardHitRect(pose)
    expect(rect.right).toBeGreaterThanOrEqual((pose.w * pose.hoverScale) / 2)
    expect(rect.left).toBe(-rect.right)
    // The lower corner of a card tilted at rest, bobbed down.
    const tiltedBottom = (pose.w * Math.sin(pose.tilt) + pose.h * Math.cos(pose.tilt)) / 2
    expect(rect.bottom).toBeGreaterThanOrEqual(tiltedBottom + pose.bob * pose.h - 1e-9)
  })

  it('never reaches past the middle of the gap to the next card', () => {
    const rect = cardHitRect({ ...pose, gap: 2 })
    expect(rect.right).toBeLessThanOrEqual(51)
  })

  it('is the card itself for a card that neither tilts, lifts nor bobs', () => {
    expect(cardHitRect({ ...pose, tilt: 0, lift: 0, bob: 0, hoverScale: 1 })).toEqual({ left: -50, right: 50, top: -68, bottom: 68 })
  })
})
