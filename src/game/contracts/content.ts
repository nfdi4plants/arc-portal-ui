import type { Annotation, DatasetKind, IoKind } from '../../arc/provenance/types'
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
}

export type BossArchetype =
  | 'rootTreant' // source
  | 'specimenJar' // sample
  | 'reagentGolem' // material
  | 'glitchDaemon' // data

export type BossAttackKind = 'slam' | 'sweep' | 'projectileFan' | 'charge' | 'rain' | 'beam' | 'summon' | 'shockwave'

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
  attacks: BossAttackSpec[]
  xp: number
}

export interface FinalBossPhase {
  segmentIndex: number
  datasetKind: DatasetKind
  // Archetype of the boss after this segment.
  archetype: BossArchetype
  quality: number
  telegraphMs: number
  attacks: BossAttackSpec[]
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
