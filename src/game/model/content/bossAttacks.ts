import type { BossArchetype, BossAttackKind } from '../../contracts/content'

export interface AttackTemplate {
  name: string
  kind: BossAttackKind
  heavy: boolean
  damage: number
  cooldownMs: number
}

// The building blocks of a boss genome. A heavy slot draws its kind from HEAVY_KINDS, a light slot
// from LIGHT_KINDS. Damage and cooldown belong to the kind and its weight, the archetype only
// names the attack.
export const HEAVY_KINDS: readonly BossAttackKind[] = ['slam', 'rain', 'charge', 'beam', 'shockwave', 'pillars', 'sweep']
export const LIGHT_KINDS: readonly BossAttackKind[] = ['sweep', 'projectileFan', 'charge', 'rain', 'summon']

const STATS: Record<BossAttackKind, { heavy: [number, number]; light: [number, number] }> = {
  slam: { heavy: [18, 3200], light: [10, 2200] },
  sweep: { heavy: [18, 3000], light: [10, 2000] },
  projectileFan: { heavy: [14, 3200], light: [8, 2200] },
  charge: { heavy: [20, 3400], light: [10, 2200] },
  rain: { heavy: [16, 3600], light: [8, 2000] },
  beam: { heavy: [20, 3400], light: [9, 2400] },
  summon: { heavy: [8, 4400], light: [6, 4000] },
  shockwave: { heavy: [20, 3600], light: [10, 2400] },
  pillars: { heavy: [18, 3600], light: [9, 2400] },
}

const NAMES: Record<BossArchetype, Record<BossAttackKind, string>> = {
  rootTreant: {
    slam: 'Root Eruption',
    sweep: 'Branch Sweep',
    projectileFan: 'Thorn Volley',
    charge: 'Trunk Charge',
    rain: 'Bramble Rain',
    beam: 'Sap Lance',
    summon: 'Sapling Call',
    shockwave: 'Root Quake',
    pillars: 'Taproot Spikes',
  },
  specimenJar: {
    slam: 'Glass Slam',
    sweep: 'Lid Spin',
    projectileFan: 'Formalin Splash',
    charge: 'Tank Roll',
    rain: 'Brine Drizzle',
    beam: 'Pipette Jet',
    summon: 'Specimen Swarm',
    shockwave: 'Shatter Wave',
    pillars: 'Test Tube Rack',
  },
  reagentGolem: {
    slam: 'Flask Slam',
    sweep: 'Reagent Sweep',
    projectileFan: 'Spatter Shot',
    charge: 'Crucible Charge',
    rain: 'Titration Drip',
    beam: 'Acid Beam',
    summon: 'Catalyst Spawn',
    shockwave: 'Exotherm Wave',
    pillars: 'Burette Columns',
  },
  glitchDaemon: {
    slam: 'Stack Smash',
    sweep: 'Scanline Swipe',
    projectileFan: 'Packet Fan',
    charge: 'Glitch Dash',
    rain: 'Data Rain',
    beam: 'Null Pointer',
    summon: 'Fork Bomb',
    shockwave: 'Buffer Overflow',
    pillars: 'Firewall Bars',
  },
}

// What a kind does, for the inspect panel.
export const KIND_TEXT: Record<BossAttackKind, string> = {
  slam: 'leaps or smashes down on you',
  sweep: 'a low or high swing in front',
  projectileFan: 'a fan of shots',
  charge: 'a dash along the floor',
  rain: 'drops from above',
  beam: 'a straight beam',
  summon: 'calls two minions',
  shockwave: 'floor waves to both walls',
  pillars: 'columns burst from the floor',
}

// The attack an empty slot falls back to, so every boss keeps one heavy and one light attack.
export const PLAIN_HEAVY: Record<BossArchetype, BossAttackKind> = {
  rootTreant: 'slam',
  specimenJar: 'slam',
  reagentGolem: 'slam',
  glitchDaemon: 'beam',
}
export const PLAIN_LIGHT: BossAttackKind = 'sweep'

export function attackTemplate(archetype: BossArchetype, kind: BossAttackKind, heavy: boolean): AttackTemplate {
  const [damage, cooldownMs] = STATS[kind][heavy ? 'heavy' : 'light']
  return { name: NAMES[archetype][kind], kind, heavy, damage, cooldownMs }
}

// Every final boss phase adds this attack to the ones its step's genome gives it.
export const SHARED_HEAVY_ATTACK: AttackTemplate = {
  name: 'Crate Collapse',
  kind: 'rain',
  heavy: true,
  damage: 22,
  cooldownMs: 4000,
}
