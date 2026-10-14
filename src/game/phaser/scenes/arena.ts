import type Phaser from 'phaser'
import type { ScribbleArt, Theme } from '../../contracts/art'
import { TILE } from '../../contracts/constants'
import type { Arena } from '../bosses'
import type { View } from '../view'
import type { LevelSetup } from './GameplayScene'
import { addParallax, addTiles, type Parallax } from './levelArt'

const T = TILE
const ARENA_VIEWS = 1.6
const WALL_TILES = 16

// A flat floor between two walls, about 1.6 view widths wide, for the boss fights.
export function buildArena(scene: Phaser.Scene, art: ScribbleArt, theme: Theme, view: View): { arena: Arena; setup: LevelSetup; parallax: Parallax } {
  const width = Math.round((ARENA_VIEWS * view.width) / T) * T
  const arena: Arena = { left: 0, right: width, floorY: 0 }
  const tiles = art.tiles(scene, theme)
  const parallax = addParallax(scene, art, tiles.background, -T, width + T)
  parallax.layout(view)

  const bottom = 5 * T
  const top = -WALL_TILES * T
  const statics = [
    scene.physics.add.staticBody(-T, 0, width + 2 * T, bottom),
    scene.physics.add.staticBody(-T, top, T, -top),
    scene.physics.add.staticBody(width, top, T, -top),
  ]
  addTiles(scene, art, tiles.ground, 0, 0, width, T)
  addTiles(scene, art, tiles.wall, 0, T, width, bottom - T).setAlpha(0.55)
  addTiles(scene, art, tiles.wall, -T, top, T, bottom - top)
  addTiles(scene, art, tiles.wall, width, top, T, bottom - top)

  return {
    arena,
    parallax,
    setup: {
      colliders: [statics],
      spawn: { x: 3 * T, y: 0 },
      bounds: { x: -T, y: top, width: width + 2 * T, height: 3 * T - top },
    },
  }
}
