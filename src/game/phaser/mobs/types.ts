import type Phaser from 'phaser'
import type { ScribbleArt } from '../../contracts/art'
import type { Combatant, CombatWorld } from '../../contracts/combat'
import type { MonsterSpec } from '../../contracts/content'
import type { PlayerHandle } from '../../contracts/player'
import type { Rng } from '../../contracts/rng'

export interface MobDeps {
  combat: CombatWorld
  art: ScribbleArt
  player: PlayerHandle
  colliders: Phaser.Types.Physics.Arcade.ArcadeColliderType[]
  rng: Rng
}

export interface Mob extends Combatant {
  readonly spec: MonsterSpec
  // Call once per fixed step (from the scene's 'worldstep' handler) unless asleep or frozen by hit-stop.
  update(dtMs: number): void
  // Asleep mobs keep their place, skip AI and physics, and are not registered with combat.
  setAsleep(asleep: boolean): void
  // True after the death animation finished and every minion a summoner called is gone. The scene
  // may then drop the mob.
  isGone(): boolean
  destroy(): void
}
