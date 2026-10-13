import type Phaser from 'phaser'
import type { Annotation } from '../../arc/provenance/types'
import type { BossSpec } from './content'
import type { Segment } from './run'

export type Team = 'player' | 'enemy'

// What the death screen names.
export type KillerInfo =
  | { kind: 'mob'; annotation: Annotation; label: string }
  | { kind: 'boss'; spec: BossSpec; segment: Segment }
  | { kind: 'finalBoss'; title: string; phase: number }
  | { kind: 'hazard'; label: string }

export interface Combatant {
  readonly id: string
  readonly team: Team
  // Null for the player.
  readonly killer: KillerInfo | null
  // World space, current frame.
  hurtbox(): Phaser.Geom.Rectangle
  // Which way the combatant faces, for mirroring hitbox shapes.
  facing(): 1 | -1
  position(): { x: number; y: number }
  isInvulnerable(): boolean
  // Applies damage, knockback and flinch.
  receiveHit(hit: HitEvent): void
  isDead(): boolean
}

export type HitShape =
  | { kind: 'rect'; x: number; y: number; w: number; h: number }
  | { kind: 'circle'; x: number; y: number; r: number }

export interface HitboxSpec {
  owner: Combatant
  // Relative to the owner's position, mirrored when the owner faces left.
  shape: HitShape
  // Moves with the owner while active.
  follow: boolean
  activeMs: number
  damage: number
  knockback: { x: number; y: number }
  hitStopMs: number
  // Infinity for area attacks.
  maxTargets: number
  // For example 'heavy', 'projectile', 'reflect'.
  tags?: string[]
}

export interface ProjectileSpec extends Omit<HitboxSpec, 'follow' | 'activeMs'> {
  textureKey: string
  velocity: { x: number; y: number }
  gravity: number
  lifetimeMs: number
  // How many targets it passes through before it disappears.
  pierce: number
  reflectable: boolean
}

export interface HitEvent {
  attacker: Combatant
  target: Combatant
  damage: number
  crit: boolean
  knockback: { x: number; y: number }
  tags: string[]
}

export interface CombatWorld {
  register(combatant: Combatant): void
  unregister(combatant: Combatant): void
  spawnHitbox(spec: HitboxSpec): { cancel(): void }
  spawnProjectile(spec: ProjectileSpec, origin: { x: number; y: number }): { cancel(): void }
  on(event: 'hit' | 'kill', listener: (event: HitEvent) => void): () => void
  // Lets the attacker's build decide crits and damage multipliers before the hit lands.
  setDamageModifier(modifier: ((attacker: Combatant, base: number) => { damage: number; crit: boolean }) | null): void
  // Called once per fixed step.
  update(deltaMs: number): void
  // Scenes freeze their actors while this is above zero.
  hitStopRemainingMs(): number
  destroy(): void
}
