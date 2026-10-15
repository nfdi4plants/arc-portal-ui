import type { CorruptedId, MechanicId, PlayerBuild } from '../../contracts/progression'
import type { Rng } from '../../contracts/rng'
import { createBuild } from './build'
import { ABILITY_IDS } from './catalog'
import { applyCorrupted, corruptedChoices } from './corrupted'

// The Datenkrake, a chance encounter of the waystation. It grabs the mage and wants an augment. On
// "Submit" it takes one at random and gives a corrupted augment back. It takes stat cards (one stack
// at a time), mechanics and ability cards, never a weapon (the mage must keep fighting) and never a
// legendary. It never takes a corrupted augment back either: that data is already its own.

// Undoes one stack of a stat card. Multipliers divide, so the stacks left keep their full value
// whatever was taken (a stat at its limit comes out slightly lower than an exact replay would).
const STAT_INVERSE: Record<string, (build: PlayerBuild) => PlayerBuild> = {
  'stat.swiftFeet': (b) => ({ ...b, stats: { ...b.stats, moveSpeed: b.stats.moveSpeed / 1.12 } }),
  'stat.quickHands': (b) => ({ ...b, stats: { ...b.stats, attackSpeed: b.stats.attackSpeed / 1.12 } }),
  'stat.sharpened': (b) => ({ ...b, stats: { ...b.stats, damage: b.stats.damage / 1.15 } }),
  'stat.keenEye': (b) => ({ ...b, stats: { ...b.stats, critChance: Math.max(0, b.stats.critChance - 0.05) } }),
  'stat.freshBattery': (b) => ({ ...b, stats: { ...b.stats, dashCooldownMs: b.stats.dashCooldownMs + 500 } }),
  'stat.longReach': (b) => ({ ...b, stats: { ...b.stats, meleeRange: b.stats.meleeRange / 1.15 } }),
  'stat.thickRobe': (b) => {
    const maxHp = Math.max(1, Math.round(b.stats.maxHp / 1.15))
    return { ...b, hp: Math.max(1, Math.min(b.hp, maxHp)), stats: { ...b.stats, maxHp } }
  },
}

// What the mechanics did on top of being owned, undone when one is taken.
const MECHANIC_INVERSE: Partial<Record<MechanicId, (build: PlayerBuild) => PlayerBuild>> = {
  lifesteal: (b) => ({ ...b, stats: { ...b.stats, lifesteal: createBuild().stats.lifesteal } }),
  extraChoice: (b) => ({ ...b, offerSize: createBuild().offerSize }),
}

// Every augment the Datenkrake may take, one entry per stack: `statStacks` counts the stat cards
// taken so far (the level history knows them, the build only has their sum). Stats come first in
// id order, then the mechanics in the order they were taken.
export function eligibleAugments(build: PlayerBuild, statStacks: Readonly<Record<string, number>>): string[] {
  const ids: string[] = []
  for (const id of Object.keys(STAT_INVERSE).sort()) for (let i = 0; i < (statStacks[id] ?? 0); i++) ids.push(id)
  for (const id of build.mechanics) ids.push(`mechanic.${id}`)
  return ids
}

// The build without one stack of `cardId`. An ability card also leaves its slot, which stays empty
// for the next ability card.
export function removeAugment(build: PlayerBuild, cardId: string): PlayerBuild {
  const stat = STAT_INVERSE[cardId]
  if (stat) return stat(build)
  if (!cardId.startsWith('mechanic.')) return build
  const id = cardId.slice('mechanic.'.length) as MechanicId
  if (!build.mechanics.includes(id)) return build
  const undone = MECHANIC_INVERSE[id]?.(build) ?? build
  return {
    ...undone,
    mechanics: undone.mechanics.filter((owned) => owned !== id),
    abilitySlots: (ABILITY_IDS as readonly string[]).includes(id) ? undone.abilitySlots.map((slot) => (slot === id ? null : slot)) : undone.abilitySlots,
  }
}

export interface DatenkrakeDeal {
  build: PlayerBuild
  // The catalog id of the augment taken, such as 'stat.sharpened'.
  taken: string
  given: CorruptedId
}

// The "Submit" outcome: a random eligible augment out, a random corrupted augment in. Null when
// there is nothing to take or nothing left to give.
export function submitToDatenkrake(build: PlayerBuild, statStacks: Readonly<Record<string, number>>, rng: Rng): DatenkrakeDeal | null {
  const pool = eligibleAugments(build, statStacks)
  const choices = corruptedChoices(build)
  if (pool.length === 0 || choices.length === 0) return null
  const taken = rng.pick(pool)
  const given = rng.pick(choices)
  return { build: applyCorrupted(removeAugment(build, taken), given), taken, given }
}

export function canSubmit(build: PlayerBuild, statStacks: Readonly<Record<string, number>>): boolean {
  return eligibleAugments(build, statStacks).length > 0 && corruptedChoices(build).length > 0
}

export type DatenkrakeMood = 'arrive' | 'grab' | 'fight' | 'submit' | 'deal' | 'mock' | 'bridge' | 'lift' | 'eula' | 'cookie'

// German meme meets research data management. Lines stay short enough for a speech bubble in a
// small dashlet. "deal" lines fill in {taken} and {given}.
export const DATENKRAKE_LINES: Record<DatenkrakeMood, readonly string[]> = {
  arrive: [
    'Psst. Free cloud storage, over here!',
    'Datenkrake here. Just browsing your metadata.',
    'Eight arms, eight data pipelines. Come closer.',
    'Your augments look lonely. I have servers for that.',
  ],
  grab: [
    'Ich bin die Datenkrake. Your augments look... unencrypted.',
    'Accept all cookies? There is no Reject button. There never was.',
    'GDPR? Never heard of her. Hand over an augment.',
    'Your augments are stored in plain text. How generous.',
    'Datensparsamkeit? Sounds expensive. I prefer Datenkrake.',
    'Such well-annotated metadata. Shame if someone harvested it.',
    'Free augment backup in my cloud! Terms apply. All of them.',
    'I only collect what is necessary. Everything is necessary.',
    'Hold still. Your data is processed for legitimate interests.',
  ],
  fight: [
    'Fine! I will scrape it from your preprint later.',
    'Rude. Filed under "user did not consent". For now.',
    'Ow! Opt-out noted. And ignored next time.',
    'Pfui, a privacy-conscious one. Go, before I update my terms.',
    'You cannot fight the cloud forever. Today you can.',
    'A data protection officer? In this economy? Off you go.',
  ],
  submit: [
    'Danke! Your data is now shared with trusted partners.',
    'Pleasure doing business. Your augment lives on my servers now.',
    'Thank you for your contribution to my training set.',
    'Stored safely. In a bucket. A public one. It is fine.',
    'Your data is deleted after 30 days. Or 30 years. Who counts.',
  ],
  deal: [
    'Collected: {taken}. Free sample from my data lake: {given}.',
    '{taken} is property of the Datenkrake now. Have {given}. No refunds.',
    'I took {taken}. Here is {given}, uncompressed and unreviewed.',
    'Thanks for sharing {taken}! Enjoy {given}, as is, no warranty.',
  ],
  mock: [
    'Only weapons and legendaries? Not one cookie to steal. Boring.',
    'Your build has no data worth stealing. Level up, then we talk.',
    'Empty pockets, empty metadata. Come back with an augment.',
  ],
  bridge: [
    'Bridge under construction. ISO 27001 certified.',
    "Ich bau dir 'ne Brücke... gegen deine Daten.",
    'Please wait. Your bridge is in the review queue.',
    'Bridge built from recycled cookies. Mind the crumbs.',
    'Deploying bridge to production. On a Friday.',
  ],
  lift: [
    'Lifting legacy user. Do not touch the tentacles.',
    'jump() is deprecated. Upload in progress.',
    'Up you go. Legacy support costs extra.',
    'Hoisting. Please keep your arms inside the kraken.',
  ],
  eula: [
    'Reading the EULA... page 1 of 4,012.',
    'Scrolling to the bottom of the terms...',
    'I have read and agree. (I have not.)',
  ],
  cookie: [
    'Accept all cookies? [Accept] [Accept all]',
    'We value your privacy. Please wait.',
    'Cookie banner! Clicking Accept...',
  ],
}

export function fillDealLine(line: string, taken: string, given: string): string {
  return line.replace('{taken}', taken).replace('{given}', given)
}
