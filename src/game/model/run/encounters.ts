import { createRng } from '../../contracts/rng'

// What the mage meets in the waystation between a node boss and the next step. The FAIR trader is
// always there. Chance encounters come on top of it, each rolled on its own, so adding one is a new
// kind here, an entry in CHANCE_ENCOUNTERS and a spawner in the waystation scene.

// The Datenkrake grabs the mage and wants an augment (model/progression/datenkrake.ts).
export type EncounterKind = 'trader' | 'datenkrake'

// Where an encounter stands in the waystation, from the entrance on the left to the exit portal on
// the right.
export type EncounterSlot = 'left' | 'centre' | 'right'

// The order the slots fill in: the first encounter stands in the middle of the room, the second
// between it and the exit, so the mage passes the trader before meeting it.
export const ENCOUNTER_SLOTS: readonly EncounterSlot[] = ['centre', 'right', 'left']

// The chance of each encounter that is not always there, per waystation.
export const CHANCE_ENCOUNTERS: readonly { kind: Exclude<EncounterKind, 'trader'>; chance: number }[] = [{ kind: 'datenkrake', chance: 0.4 }]

// The encounters of the waystation after node boss `afterSegmentIndex`, one per slot at most and
// the trader first. Seeded by the run, so the same run always meets the same encounters.
export function rollEncounters(runSeed: string, afterSegmentIndex: number): EncounterKind[] {
  const rng = createRng(runSeed).fork(`encounters/${afterSegmentIndex}`)
  const encounters: EncounterKind[] = ['trader']
  for (const { kind, chance } of CHANCE_ENCOUNTERS) {
    if (encounters.length >= ENCOUNTER_SLOTS.length) break
    if (rng.chance(chance)) encounters.push(kind)
  }
  return encounters
}
