import type Phaser from 'phaser'
import type { DatasetKind } from '../../arc/provenance/types'
import type { BossSpec, FinalBossSpec, MonsterSpec } from './content'
import type { PlayerWeaponId } from './progression'

export interface SpriteRef {
  textureKey: string
  // Looping animation that cycles the jittered variants ("boiling" lines).
  animKey: string
  // World units.
  width: number
  height: number
  // Relative to the origin, which is the bottom centre.
  anchors: { weapon: { x: number; y: number }; head: { x: number; y: number } }
}

// study = greenhouse, assay = wet lab, run = server room.
export type Theme = DatasetKind

export type ProjectileArt = 'bolt' | 'droplet' | 'disc' | 'arrow' | 'bomb' | 'flame' | 'orb'
export type TelegraphArt = 'rect' | 'circle' | 'cone' | 'line'
export type FxArt = 'hit' | 'crit' | 'dust' | 'levelUp' | 'death' | 'xp'

export interface TileArt {
  ground: string
  platform: string
  wall: string
  // Parallax layers, back to front.
  background: string[]
}

export interface ScribbleArt {
  monster(scene: Phaser.Scene, spec: MonsterSpec): SpriteRef
  boss(scene: Phaser.Scene, spec: BossSpec): SpriteRef & { parts: Record<string, SpriteRef> }
  finalBoss(scene: Phaser.Scene, spec: FinalBossSpec): SpriteRef & { parts: Record<string, SpriteRef> }
  playerWeapon(scene: Phaser.Scene, id: PlayerWeaponId, tier: 1 | 2): SpriteRef
  projectile(scene: Phaser.Scene, kind: ProjectileArt): SpriteRef
  tiles(scene: Phaser.Scene, theme: Theme): TileArt
  // Returns a texture key. The caller scales and fills it over the telegraph time.
  telegraph(scene: Phaser.Scene, shape: TelegraphArt, width: number, height: number): string
  // Returns an animation key that plays once.
  fx(scene: Phaser.Scene, kind: FxArt): string
}
