// The hit area of a card on the level-up screen and in the FAIR trade store. Free of Phaser.
//
// A card at rest is tilted a few degrees. Under the pointer it straightens, lifts and grows, and it
// always bobs a little. A hit area at the rest size missed the top of a hovered card (its name) and
// its sides. The area is the box around every pose the card takes, so a click anywhere on the
// drawn card counts and the area does not move with the card, which would flicker the hover at its
// edges.

export interface CardPose {
  // Card size at rest.
  w: number
  h: number
  // Largest rest tilt in radians, either way.
  tilt: number
  // Hover lift and bob as fractions of the card height, hover growth as a scale.
  lift: number
  bob: number
  hoverScale: number
  // Free room to the next card. The area takes at most half of it on each side, so neighbours
  // never overlap.
  gap: number
}

// Offsets from the card's rest centre: the area spans [left, right] x [top, bottom].
export interface HitRect {
  left: number
  right: number
  top: number
  bottom: number
}

export function cardHitRect(pose: CardPose): HitRect {
  const { w, h, tilt, lift, bob, hoverScale, gap } = pose
  const cos = Math.cos(tilt)
  const sin = Math.abs(Math.sin(tilt))
  const restHalfW = (w * cos + h * sin) / 2
  const restHalfH = (w * sin + h * cos) / 2
  const hoverHalfW = (w * hoverScale) / 2
  const hoverHalfH = (h * hoverScale) / 2
  const halfW = Math.min(Math.max(restHalfW, hoverHalfW), (w + gap) / 2)
  const sway = bob * h
  return {
    left: -halfW,
    right: halfW,
    top: Math.min(-restHalfH, -lift * h - hoverHalfH) - sway,
    bottom: Math.max(restHalfH, -lift * h + hoverHalfH) + sway,
  }
}
