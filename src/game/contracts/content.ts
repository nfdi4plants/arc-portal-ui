import type { Annotation, AnnotationCategory, DatasetKind, IoKind } from '../../arc/provenance/types'
import type { Rng } from './rng'
import type { RunNode, RunPlan, Segment } from './run'

export type BodyKind = 'slime' | 'wisp' | 'beetle' | 'golem' | 'imp' | 'turret' | 'bat' | 'crawler'
export type EnemyWeaponKind = 'claw' | 'spear' | 'bow' | 'wand' | 'bomb' | 'shield' | 'whip' | 'flask'

// One passive per ISA annotation category.
export type PassiveKind =
  | 'armored' // characteristic: front armour, reduced damage unless hit from behind or above
  | 'stanceShift' // factor: alternates between an aggressive and a defensive stance on a timer
  | 'tuned' // parameter: one seeded stat is boosted (speed, damage, range or attack rate)
  | 'shieldDrop' // component: drops a shield fragment that absorbs one hit
  | 'patrol' // protocol: fixed scripted route, predictable but hits harder
  | 'summoner' // performer: spawns two weak minions once
  | 'blink' // date: short-range teleports with a brief flash before each
  | 'chatter' // comment: speech bubbles with its value text, low HP

export interface EnemyWeaponSpec {
  kind: EnemyWeaponKind
  // 0.75 to 1.6, from the magnitude of a numeric value. 1 for text values.
  scale: number
  // The value has a unit, so the weapon aims precisely.
  calibrated: boolean
  damage: number
  cooldownMs: number
  // World units.
  range: number
}

export interface MonsterSpec {
  // Stable hash of the annotation's five fields.
  id: string
  source: Annotation
  // For example "Parameter · temperature day = 22 °C".
  label: string
  body: BodyKind
  // 0 to 360.
  hue: number
  size: 'small' | 'medium' | 'large'
  weapon: EnemyWeaponSpec
  // `variant` seeds the sub-behaviour, for example which stat a tuned monster boosts.
  passive: { kind: PassiveKind; variant: number }
  stats: { hp: number; contactDamage: number; speed: number; aggroRange: number }
  xp: number
  segmentIndex: number
  // The annotation has no value (null, empty or only spaces). The monster is nearly invisible and a
  // kill by it gets its own death screen. Its stats are not changed by this.
  phantom: boolean
}

// The boss silhouettes. The genome picks one from the most common annotation key of the step, a
// step without annotations takes the one of its node kind (in the comments).
export type BossArchetype =
  | 'rootTreant' // source
  | 'specimenJar' // sample
  | 'reagentGolem' // material
  | 'glitchDaemon' // data

export type BossAttackKind = 'slam' | 'sweep' | 'projectileFan' | 'charge' | 'rain' | 'beam' | 'summon' | 'shockwave' | 'pillars'

// One boss characteristic per ISA annotation category, see bossGenome.
export type BossMechanicKind =
  | 'armoredFront' // characteristic: hits from the front deal 40 percent less
  | 'enrage' // parameter: below 40 percent hp its attacks recharge 30 percent faster
  | 'phaseShift' // factor: at half hp it swaps its light attacks for others
  | 'summoner' // component: calls a minion every few seconds
  | 'hazard' // protocol: marks a spill on the floor under the mage, which then burns
  | 'teleport' // performer: blinks to the other side of the mage
  | 'shieldPulse' // date: raises a shield that blocks every hit for a moment
  | 'reflect' // comment: sends the mage's shots back while it winds up a heavy attack

// From the units of the step, see bossGenome.
export type BossThemeKind =
  | 'tempo' // time units: attacks recharge 15 percent faster
  | 'heat' // temperature units: flame shots, light attacks hit 15 percent harder
  | 'reach' // length units: sweeps, charges and beams reach 25 percent further
  | 'dense' // mass, amount or volume units: 15 percent more hp
  | 'precise' // other units: fans fire two more shots and drops aim at the mage more often

export interface BossAttackSpec {
  id: string
  // Shown only when the boss spec allows attack names.
  name: string
  kind: BossAttackKind
  // Heavy attacks use the segment's telegraph time, light ones a fixed short wind-up.
  heavy: boolean
  telegraphMs: number
  damage: number
  cooldownMs: number
}

export interface BossMechanicSpec {
  kind: BossMechanicKind
  // Damage of what the mechanic spawns (the spill, a sent back shot, a minion), already scaled by
  // the damage multiplier. 0 when it spawns nothing.
  damage: number
  // The light attacks after a phase shift. Empty for the other kinds.
  shiftAttacks: BossAttackSpec[]
}

// A heavy or light attack slot. An empty slot has no source, and only the first slot of each kind
// falls back to a plain attack, so every boss has at least one heavy and one light attack.
export interface BossAttackSlot {
  source: Annotation | null
  attack: BossAttackSpec | null
}

export interface BossMechanicSlot {
  // The annotation type behind the mechanic, null for an empty slot.
  category: AnnotationCategory | null
  sources: Annotation[]
  mechanic: BossMechanicKind | null
}

// What a boss is built from: the annotations of the one step that leads into it. Every slot names
// the annotations that filled it, so the pause inspection can explain the boss.
export interface BossGenome {
  segmentIndex: number
  processName: string
  annotationCount: number
  body: {
    archetype: BossArchetype
    size: 'small' | 'medium' | 'large'
    // Draw scale of the body.
    scale: number
    // The annotation key most annotations of the step share, null without annotations (then the
    // node kind picks the body).
    key: string | null
    sources: Annotation[]
  }
  // Two each. The sources: ontology terms for heavy slots, values with a unit for light slots.
  heavy: BossAttackSlot[]
  light: BossAttackSlot[]
  // Three, one per annotation type on the step, most common first.
  mechanics: BossMechanicSlot[]
  theme: { kind: BossThemeKind | null; sources: Annotation[] }
  // Slots with an annotation behind them, of BOSS_SLOT_COUNT.
  filledSlots: number
  // From the quality of the step only: 1 at quality 1, up to about 1.55 at quality 0.
  damageScale: number
}

export interface BossSpec {
  nodeId: string
  nodeKind: IoKind
  archetype: BossArchetype
  // The node id, shortened for display.
  label: string
  segmentIndex: number
  quality: number
  telegraphMs: number
  showHpBar: boolean
  showAttackNames: boolean
  // 0 to 3 each.
  safeZones: number
  weakPoints: number
  staggerWindowMs: number
  // The node's own annotations, shown above the boss before heavy attacks.
  tells: Annotation[]
  hp: number
  // The heavy and light slots of the genome, damage scaled and capped.
  attacks: BossAttackSpec[]
  mechanics: BossMechanicSpec[]
  theme: BossThemeKind | null
  damageScale: number
  genome: BossGenome
  xp: number
}

export interface FinalBossPhase {
  segmentIndex: number
  datasetKind: DatasetKind
  // How the phase moves and shoots, the body of its genome.
  archetype: BossArchetype
  quality: number
  telegraphMs: number
  attacks: BossAttackSpec[]
  // At most two of the genome's mechanics.
  mechanics: BossMechanicSpec[]
  theme: BossThemeKind | null
  damageScale: number
  // Built from the phase's own segment.
  genome: BossGenome
}

export interface FinalBossSpec {
  // The investigation title.
  title: string
  // Base HP times the number of node bosses.
  hp: number
  phases: FinalBossPhase[]
}

export type MonsterFromAnnotation = (annotation: Annotation, segmentIndex: number) => MonsterSpec
export type BossFromNode = (node: RunNode, segment: Segment, rng: Rng) => BossSpec
export type FinalBossFromPlan = (plan: RunPlan, rng: Rng) => FinalBossSpec
export type AnnotationLabel = (annotation: Annotation) => string
