import type Phaser from 'phaser'
import type { Annotation } from '../../arc/provenance/types'
import type { BossSpec } from './content'
import type { Segment } from './run'

// 'neutral' is a bystander, the FAIR trader before he fights: every hit lands on it, but nothing
// looks for it as a target.
export type Team = 'player' | 'enemy' | 'neutral'

// What the death screen names.
export type KillerInfo =
  | { kind: 'mob'; annotation: Annotation; label: string }
  | { kind: 'boss'; spec: BossSpec; segment: Segment }
  | { kind: 'finalBoss'; title: string; phase: number }
  | { kind: 'hazard'; label: string }
  // The FAIR trader, with the line he had for the mage.
  | { kind: 'trader'; line: string }

// Crowd control from the mage's abilities, applied straight to a combatant without a hit. Bosses
// turn a freeze into a slow and take slows at half strength (combat/status.ts).
export type StatusEffect = { kind: 'freeze'; ms: number } | { kind: 'slow'; ms: number; factor: number }

// A box where projectiles of every team but `team` move at `factor` of their speed. Only
// reflectable shots slow down: bombs, falling debris and ground waves pass at full speed.
export interface SlowZone {
  x: number
  y: number
  w: number
  h: number
  factor: number
  team: Team
}

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
  // Combatants without it ignore freezes and slows.
  applyStatus?(status: StatusEffect): void
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
  // Adds a slow zone until the returned function removes it. The world reads the object every
  // step, so the caller may move it.
  addSlowZone(zone: SlowZone): () => void
  // Cancels the reflectable projectiles of `team` whose centre lies in the box. Returns how many.
  cancelShots(team: Team, area: { x: number; y: number; w: number; h: number }): number
  // Registered combatants of a team that are alive, for effects that target or chain.
  livingCombatants(team: Team): readonly Combatant[]
  on(event: 'hit' | 'kill', listener: (event: HitEvent) => void): () => void
  // Lets the attacker's build decide crits and damage multipliers before the hit lands.
  // `tags` are the hit's tags ('projectile' included for shots) and `target` the one it lands on.
  // Every loadout adds its own, and each passes hits that are not its owner's on unchanged, so a
  // hit runs through all of them in turn. Returns the function that removes it.
  addDamageModifier(
    modifier: (attacker: Combatant, base: number, tags: readonly string[], target: Combatant) => { damage: number; crit: boolean },
  ): () => void
  // Called once per fixed step.
  update(deltaMs: number): void
  // Scenes freeze their actors while this is above zero.
  hitStopRemainingMs(): number
  destroy(): void
}
