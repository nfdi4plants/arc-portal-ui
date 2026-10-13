import type Phaser from 'phaser'
import type { ScribbleArt } from './art'
import type { Combatant, CombatWorld, HitEvent } from './combat'
import type { Action } from './input'
import type { PlayerBuild, PlayerWeaponId, WeaponSlot } from './progression'

// Everything an attack or ability needs when it fires.
export interface AttackContext {
  scene: Phaser.Scene
  combat: CombatWorld
  art: ScribbleArt
  player: PlayerHandle
  // Pointer position in world units.
  aim: { x: number; y: number }
  tier: 1 | 2
  // Multiplies hitbox sizes of melee moves (PlayerStats.meleeRange).
  rangeScale: number
  // Actions held in the current step, for moves that change with a direction (down + attack).
  held: ReadonlySet<Action>
}

// One attack. The player's attack state machine runs the timing. All times are divided by
// PlayerStats.attackSpeed.
export interface AttackMove {
  name: string
  startupMs: number
  activeMs: number
  recoveryMs: number
  // After this many ms of recovery, jump, dash and the next attack may cancel the move.
  cancelAfterMs: number
  // Horizontal push at the start of the active phase, world units per second.
  lunge?: number
  allowedInAir: boolean
  // Called once when the active phase starts. Spawns hitboxes or projectiles.
  onActive(ctx: AttackContext): void
}

// The moves a weapon has in one slot. For the light slot this is a combo string. Pressing light
// again during the cancel window advances to the next move. The heavy slot usually has one move.
export interface WeaponMoveset {
  id: PlayerWeaponId
  moves(slot: WeaponSlot, tier: 1 | 2): AttackMove[]
}

export interface AbilityHandler {
  cooldownMs: number
  activate(ctx: AttackContext): void
}

export interface PlayerEvents {
  attackStarted: { slot: WeaponSlot; comboIndex: number; move: AttackMove }
  attackActive: { slot: WeaponSlot; comboIndex: number; move: AttackMove }
  dashed: { direction: 1 | -1 }
  landed: { fallSpeed: number }
  damaged: { hit: HitEvent }
}

export interface PlayerHandle extends Combatant {
  readonly gameObject: Phaser.GameObjects.Container
  getBuild(): PlayerBuild
  // Re-reads stats, mechanics, weapons and ability slots.
  setBuild(build: PlayerBuild): void
  hp(): number
  heal(amount: number): void
  velocity(): { x: number; y: number }
  setVelocity(x: number, y: number): void
  teleport(x: number, y: number): void
  isGrounded(): boolean
  on<K extends keyof PlayerEvents>(event: K, listener: (payload: PlayerEvents[K]) => void): () => void
  // Weapons other than the staff come from the weapons module.
  registerMoveset(moveset: WeaponMoveset): void
  // Slot 0 to 3, bound to ability1 to ability4.
  setAbilityHandler(slot: number, handler: AbilityHandler | null): void
  abilityCooldownRemainingMs(slot: number): number
  // Return true from the interceptor to cancel a lethal hit (git revert).
  setLethalHitInterceptor(interceptor: ((hit: HitEvent) => boolean) | null): void
  // Freezes input and physics, for level-up cards and pause.
  setFrozen(frozen: boolean): void
  // A shield absorbs the next hit completely. Shield fragments (component monsters) grant one,
  // up to three at a time.
  grantShield(): void
  shieldCount(): number
}
