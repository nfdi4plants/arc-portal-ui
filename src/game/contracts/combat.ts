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
  // Bottom centre (the feet), the origin of hitbox shapes.
  position(): { x: number; y: number }
  isInvulnerable(): boolean
  // Applies damage, knockback and flinch. Returns the damage actually taken after armour, weak
  // points and similar modifiers, so damage numbers and lifesteal show the real value. Returning
  // nothing means hit.damage was taken unchanged.
  receiveHit(hit: HitEvent): number | void
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
  // Relative to the owner's facing: positive x pushes away in the direction the owner faces.
  // The combat world mirrors it, so HitEvent.knockback is in world space.
  knockback: { x: number; y: number }
  hitStopMs: number
  // Infinity for area attacks.
  maxTargets: number
  // For example 'heavy', 'projectile', 'reflect'.
  tags?: string[]
  // Multiplies how much the hit fills a boss stagger bar. Defaults to 1.
  stagger?: number
}

export interface ProjectileSpec extends Omit<HitboxSpec, 'follow' | 'activeMs'> {
  textureKey: string
  // The SpriteRef's animation. Art textures hold several variants side by side, so without it the
  // projectile shows the whole strip.
  animKey?: string
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
  // The stagger multiplier of the hitbox or projectile, 1 when it set none.
  stagger?: number
}

export interface CombatWorld {
  register(combatant: Combatant): void
  unregister(combatant: Combatant): void
  spawnHitbox(spec: HitboxSpec): { cancel(): void }
  spawnProjectile(spec: ProjectileSpec, origin: { x: number; y: number }): { cancel(): void }
  // Cancels every hitbox and projectile the combatant owns, for a boss that is beaten or changes phase.
  cancelOwnedBy(owner: Combatant): void
  // Registered combatants of a team that are alive, for effects that target or chain.
  livingCombatants(team: Team): readonly Combatant[]
  on(event: 'hit' | 'kill', listener: (event: HitEvent) => void): () => void
  // Lets the attacker's build decide crits and damage multipliers before the hit lands.
  setDamageModifier(modifier: ((attacker: Combatant, base: number) => { damage: number; crit: boolean }) | null): void
  // Called once per fixed step.
  update(deltaMs: number): void
  // Scenes freeze their actors while this is above zero.
  hitStopRemainingMs(): number
  destroy(): void
}
