import type { Action } from '../../contracts/input'

// The interact key of the gameplay scenes is `up`: it trades with the FAIR trader and takes every
// portal and door to the next scene, so nobody walks through one by chance. Pure, so the rules are
// unit-tested.

// The prompt word over a portal that is open.
export const ENTER_ACTION = 'Enter'

// A press of up interacts, unless light or heavy went down in the same step: that press is an up
// attack, and the attack plays instead. Up held from before never interacts, only a new press.
export function interactPressed(pressed: ReadonlySet<Action>): boolean {
  return pressed.has('up') && !pressed.has('light') && !pressed.has('heavy')
}

// What a portal offers the player: 'enter' while the player stands in it and it is open,
// 'blocked' while something holds it shut (the trader fight), null out of reach or while it still
// forms (the portal of a beaten boss shows no prompt until it is whole).
export type PortalOffer = 'enter' | 'blocked' | null

export function portalOffer(inReach: boolean, open: boolean, blocked = false): PortalOffer {
  if (!inReach || !open) return null
  return blocked ? 'blocked' : 'enter'
}

// True when the player goes through the portal in this step.
export function entersPortal(offer: PortalOffer, pressed: ReadonlySet<Action>): boolean {
  return offer === 'enter' && interactPressed(pressed)
}
