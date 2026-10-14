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
  // Actions held in the current step, for moves that change with a direction (down + light).
  held: ReadonlySet<Action>
}

// Which version of a slot's move an attack plays. The attack machine picks it when the attack starts:
// 'dash' during a dash or up to 80 ms after it, else 'up' with up held (and down not held), else
// 'air' for a heavy press in the air, else 'ground'. A slot without the picked version falls through
// to the next one.
export type AttackVariant = 'ground' | 'up' | 'air' | 'dash'

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
  // A lock that starts when the active phase ends. While it runs the mage takes no movement input
  // and cannot jump, dash, attack or cancel the move. Presses in its last 150 ms stay buffered.
  lockMs?: number
  // The same lock, started by the landing that fires onLand.
  landingLockMs?: number
  // From the end of startup the mage falls at `speed` and moves `drift` units per second towards the
  // facing side. The active phase then lasts until the landing and ignores activeMs. Without
  // `maxMs` a plunge that has not landed after 2 s (it fell into a pit, say) ends without onLand.
  // With `maxMs` the fall ends after that long and onLand still fires on a later landing.
  plunge?: { speed: number; drift?: number; maxMs?: number }
  // Fires once on the first landing after the active phase started, also after the move has ended,
  // for up to 1.5 s. A new attack, a dash or a hit drops it.
  onLand?(ctx: AttackContext): void
  // Holds the fall speed near 0 for this long from the start of the move, during startup and active.
  hover?: { ms: number }
  // For dash variants: the dash speed carries through startup and active, then normal friction
  // takes over. Without it the dash stops when the move starts.
  keepsMomentum?: boolean
  // Called once when the active phase starts. Spawns hitboxes or projectiles.
  onActive(ctx: AttackContext): void
}

// The moves a weapon has in one slot. For the light slot this is a combo string. Pressing light
// again during the cancel window advances to the next move. The heavy slot usually has one move.
//
// The variants are optional. Without them the player falls back to a plunge built from the heavy
// move's damage (airHeavy), the first light move with keepsMomentum (dashLight), the heavy move
// (dashHeavy), and the move with its hitboxes turned to point overhead (upLight, upHeavy).
// A variant that returns null has none, and the attack machine tries the next one (see
// AttackVariant). upLight and upHeavy return null for weapons that aim at the pointer, so up
// changes nothing for them.
export interface WeaponMoveset {
  id: PlayerWeaponId
  moves(slot: WeaponSlot, tier: 1 | 2): AttackMove[]
  // Heavy pressed in the air.
  airHeavy?(tier: 1 | 2): AttackMove | null
  // Light or heavy pressed during a dash.
  dashLight?(tier: 1 | 2): AttackMove | null
  dashHeavy?(tier: 1 | 2): AttackMove | null
  // Light or heavy pressed with up held, on the ground or in the air. comboIndex is the place in
  // the light string, so an up combo keeps counting like the ground one.
  upLight?(tier: 1 | 2, comboIndex: number): AttackMove | null
  upHeavy?(tier: 1 | 2): AttackMove | null
}

export interface AbilityHandler {
  cooldownMs: number
  activate(ctx: AttackContext): void
}

export interface PlayerEvents {
  // held is the set of actions held when the attack started, for moves that depend on a direction
  // (down + light in the air is a pogo).
  attackStarted: { slot: WeaponSlot; comboIndex: number; move: AttackMove; held: ReadonlySet<Action>; variant: AttackVariant }
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
  // Freezes input and physics, for hit-stop, level-up cards and pause.
  setFrozen(frozen: boolean): void
  // A shield absorbs the next hit completely. Shield fragments (component monsters) grant one,
  // up to three at a time.
  grantShield(): void
  shieldCount(): number
}
