import type Phaser from 'phaser'
import type { DatasetKind } from '../../arc/provenance/types'
import type { BossMechanicKind, BossSpec, BossThemeKind, FinalBossSpec, MonsterSpec } from './content'
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

// A boss limb or marker, positioned relative to the boss body.
export interface PartRef extends SpriteRef {
  // Where the part's origin (bottom centre) sits relative to the origin of the boss body at rest.
  rest: { x: number; y: number }
  // The joint the part swings around, relative to the part's own origin. Rotate a part around its
  // pivot by setting the sprite origin to (0.5 + pivot.x / width, 1 + pivot.y / height).
  pivot: { x: number; y: number }
}

// study = greenhouse, assay = wet lab, run = server room.
export type Theme = DatasetKind

export type ProjectileArt = 'bolt' | 'droplet' | 'disc' | 'arrow' | 'bomb' | 'flame' | 'orb'
// 'safe' is the teal spot where an area attack does not hit.
export type TelegraphArt = 'rect' | 'circle' | 'cone' | 'line' | 'safe'
// A badge over a boss for one of its mechanics or its theme.
export type BossMarkerKind = BossMechanicKind | BossThemeKind
export type FxArt = 'hit' | 'crit' | 'dust' | 'levelUp' | 'death' | 'xp'

export interface TileArt {
  ground: string
  platform: string
  wall: string
  // Parallax layers, back to front.
  background: string[]
}

export interface ScribbleArt {
  // Texture pixels per world unit. SpriteRef sizes are already in world units, but raw texture and
  // animation keys (projectile textures, fx, telegraphs, tiles) are drawn this many times larger,
  // so sprites and TileSprites showing them need a scale of 1 / pixelsPerUnit.
  readonly pixelsPerUnit: number
  monster(scene: Phaser.Scene, spec: MonsterSpec): SpriteRef
  boss(scene: Phaser.Scene, spec: BossSpec): SpriteRef & { parts: Record<string, PartRef> }
  finalBoss(scene: Phaser.Scene, spec: FinalBossSpec): SpriteRef & { parts: Record<string, PartRef> }
  bossMarker(scene: Phaser.Scene, kind: BossMarkerKind): SpriteRef
  playerWeapon(scene: Phaser.Scene, id: PlayerWeaponId, tier: 1 | 2): SpriteRef
  projectile(scene: Phaser.Scene, kind: ProjectileArt): SpriteRef
  tiles(scene: Phaser.Scene, theme: Theme): TileArt
  // Returns a texture key. The caller scales and fills it over the telegraph time.
  telegraph(scene: Phaser.Scene, shape: TelegraphArt, width: number, height: number): string
  // Returns an animation key that plays once.
  fx(scene: Phaser.Scene, kind: FxArt): string
}
