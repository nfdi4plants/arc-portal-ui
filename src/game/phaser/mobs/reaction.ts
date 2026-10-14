import type { BodyKind, MonsterSpec } from '../../contracts/content'
import { BODY_POISE, BRACE_FACTOR, POISE } from './tuning'

export interface ReactionInput {
  size: MonsterSpec['size']
  body: BodyKind
  heavy: boolean
  // The hit lands on armour from the front.
  armoredFront: boolean
  defensiveStance: boolean
}

export interface Reaction {
  knockbackScale: number
  // Upward speed, 0 for none.
  launch: number
  staggerMs: number
}

// How far a player hit moves and interrupts a mob. Bosses have their own stagger system.
export function hitReaction(input: ReactionInput): Reaction {
  const entry = POISE[input.size][input.heavy ? 'heavy' : 'light']
  const body = BODY_POISE[input.body]
  let brace = 1
  if (input.armoredFront) brace *= BRACE_FACTOR
  if (input.defensiveStance) brace *= BRACE_FACTOR
  const knockbackScale = entry.knockback * (body?.knockback ?? 1) * brace
  const launch = entry.launch * (body?.launch ?? 1) * brace
  let staggerMs = entry.staggerMs * (body?.stagger ?? 1) * brace
  if (input.body === 'turret' && !input.heavy) staggerMs = 0
  return { knockbackScale, launch: Math.round(launch), staggerMs: Math.round(staggerMs) }
}
