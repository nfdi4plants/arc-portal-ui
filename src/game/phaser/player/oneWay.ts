import type Phaser from 'phaser'
import { isOneWay as hasOnlyTopSide } from '../mobs/ledge'

type ArcadeBody = Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody

// A scene marks a static body as a one-way platform by turning off collision on every side
// except the top. The player lands on it from above, jumps up through it, and drops through
// it with down + jump.
export function markOneWay(body: ArcadeBody): void {
  body.checkCollision.down = false
  body.checkCollision.left = false
  body.checkCollision.right = false
}

// The rule itself is the pure predicate in mobs/ledge.ts, which its tests cover without Phaser.
export function isOneWay(body: ArcadeBody): boolean {
  return hasOnlyTopSide(body.checkCollision)
}

// Arcade hands a collision callback either a body or the game object that owns one.
export function bodyOf(object: unknown): ArcadeBody | null {
  if (typeof object !== 'object' || object === null) return null
  const o = object as { isBody?: boolean; body?: unknown }
  if (o.isBody) return object as ArcadeBody
  if (o.body && (o.body as { isBody?: boolean }).isBody) return o.body as ArcadeBody
  return null
}
