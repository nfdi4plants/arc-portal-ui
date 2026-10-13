import type { BossArchetype, BossAttackKind } from '../../contracts/content'

export interface AttackTemplate {
  name: string
  kind: BossAttackKind
  heavy: boolean
  damage: number
  cooldownMs: number
}

// Six attacks per archetype, three of them heavy. A boss draws four to six of them and always
// keeps at least two heavy ones.
export const BOSS_ATTACKS: Record<BossArchetype, AttackTemplate[]> = {
  rootTreant: [
    { name: 'Root Eruption', kind: 'slam', heavy: true, damage: 18, cooldownMs: 3200 },
    { name: 'Thorn Volley', kind: 'projectileFan', heavy: false, damage: 8, cooldownMs: 2200 },
    { name: 'Branch Sweep', kind: 'sweep', heavy: false, damage: 10, cooldownMs: 2000 },
    { name: 'Bramble Rain', kind: 'rain', heavy: true, damage: 16, cooldownMs: 3600 },
    { name: 'Sapling Call', kind: 'summon', heavy: false, damage: 6, cooldownMs: 4000 },
    { name: 'Trunk Charge', kind: 'charge', heavy: true, damage: 20, cooldownMs: 3400 },
  ],
  specimenJar: [
    { name: 'Glass Slam', kind: 'slam', heavy: true, damage: 18, cooldownMs: 3200 },
    { name: 'Formalin Splash', kind: 'projectileFan', heavy: false, damage: 8, cooldownMs: 2200 },
    { name: 'Lid Spin', kind: 'sweep', heavy: false, damage: 10, cooldownMs: 2000 },
    { name: 'Shatter Wave', kind: 'shockwave', heavy: true, damage: 20, cooldownMs: 3600 },
    { name: 'Specimen Swarm', kind: 'summon', heavy: false, damage: 6, cooldownMs: 4000 },
    { name: 'Tank Roll', kind: 'charge', heavy: true, damage: 18, cooldownMs: 3400 },
  ],
  reagentGolem: [
    { name: 'Titration Drip', kind: 'rain', heavy: false, damage: 8, cooldownMs: 2000 },
    { name: 'Acid Beam', kind: 'beam', heavy: true, damage: 20, cooldownMs: 3400 },
    { name: 'Flask Slam', kind: 'slam', heavy: true, damage: 18, cooldownMs: 3200 },
    { name: 'Reagent Sweep', kind: 'sweep', heavy: false, damage: 10, cooldownMs: 2000 },
    { name: 'Catalyst Spawn', kind: 'summon', heavy: false, damage: 6, cooldownMs: 4000 },
    { name: 'Crucible Charge', kind: 'charge', heavy: true, damage: 20, cooldownMs: 3400 },
  ],
  glitchDaemon: [
    { name: 'Null Pointer', kind: 'beam', heavy: true, damage: 20, cooldownMs: 3400 },
    { name: 'Packet Fan', kind: 'projectileFan', heavy: false, damage: 8, cooldownMs: 2000 },
    { name: 'Buffer Overflow', kind: 'shockwave', heavy: true, damage: 18, cooldownMs: 3600 },
    { name: 'Glitch Dash', kind: 'charge', heavy: false, damage: 10, cooldownMs: 2200 },
    { name: 'Fork Bomb', kind: 'summon', heavy: false, damage: 6, cooldownMs: 4000 },
    { name: 'Data Rain', kind: 'rain', heavy: true, damage: 16, cooldownMs: 3600 },
  ],
}

// Every final boss phase ends with the crate falling apart.
export const SHARED_HEAVY_ATTACK: AttackTemplate = {
  name: 'Crate Collapse',
  kind: 'rain',
  heavy: true,
  damage: 22,
  cooldownMs: 4000,
}
