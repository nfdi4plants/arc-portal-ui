// Throwaway stub for Part J. The real weapons module (Part K) replaces this file at merge.
import type Phaser from 'phaser'
import type { ScribbleArt } from '../../../contracts/art'
import type { Combatant, CombatWorld } from '../../../contracts/combat'
import type { PlayerHandle, WeaponMoveset } from '../../../contracts/player'
import type { PlayerBuild } from '../../../contracts/progression'
import type { Rng } from '../../../contracts/rng'

export interface LoadoutDeps {
  scene: Phaser.Scene
  combat: CombatWorld
  art: ScribbleArt
  player: PlayerHandle
  rng: Rng
  enemies(): readonly Combatant[]
}

export interface Loadout {
  sync(build: PlayerBuild): void
  update(dtMs: number): void
  resetFight(): void
  destroy(): void
}

export type LoadoutWithStatus = Loadout & { gitRevertCharged(): boolean }

export function attachLoadout(_deps: LoadoutDeps): LoadoutWithStatus {
  return {
    sync() {},
    update() {},
    resetFight() {},
    destroy() {},
    gitRevertCharged: () => false,
  }
}

export const WEAPON_MOVESETS: readonly WeaponMoveset[] = []
