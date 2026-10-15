import type Phaser from 'phaser'
import type { PartRef, SpriteRef } from '../../contracts/art'
import { artContext } from '../art/canvas'

type BossArtRef = SpriteRef & { parts: Record<string, PartRef> }

function scaled<T extends SpriteRef>(ref: T, k: number): T {
  const point = (p: { x: number; y: number }) => ({ x: p.x * k, y: p.y * k })
  return { ...ref, width: ref.width * k, height: ref.height * k, anchors: { weapon: point(ref.anchors.weapon), head: point(ref.anchors.head) } }
}

// The boss art at another size: the body, every part and where the parts sit. The textures stay
// the cached ones, the sprites only show them larger or smaller.
export function scaleArt(art: BossArtRef, k: number): BossArtRef {
  if (k === 1) return art
  const parts: Record<string, PartRef> = {}
  for (const [name, part] of Object.entries(art.parts)) {
    parts[name] = { ...scaled(part, k), rest: { x: part.rest.x * k, y: part.rest.y * k }, pivot: { x: part.pivot.x * k, y: part.pivot.y * k } }
  }
  return { ...scaled(art, k), parts }
}

// Puts a sprite on the art of `ref`, sized in world units, and starts the boiling animation.
// Works for the placeholder art (one frame) and the real art (an atlas of variants). The origin is
// the bottom centre, or the joint of a part, see PartRef.pivot.
export function applyRef(sprite: Phaser.GameObjects.Sprite, ref: SpriteRef | PartRef, mirrored = false): void {
  sprite.setTexture(ref.textureKey)
  sprite.play(ref.animKey)
  sprite.setDisplaySize(ref.width, ref.height)
  setOriginOf(sprite, ref, mirrored)
}

export function setOriginOf(sprite: Phaser.GameObjects.Sprite, ref: SpriteRef | PartRef, mirrored: boolean): void {
  const pivot = 'pivot' in ref ? ref.pivot : { x: 0, y: 0 }
  const x = 0.5 + pivot.x / ref.width
  sprite.setOrigin(mirrored ? 1 - x : x, 1 + pivot.y / ref.height)
  sprite.setFlipX(mirrored)
}

// The combat world draws a projectile from a texture key alone. A key of the real art points at a
// strip of jittered variants, which would show as three shots side by side. This copies the first
// variant into a texture of its own. The placeholder art has a single frame and is used as is.
export function stillTexture(scene: Phaser.Scene, ref: SpriteRef): string {
  const texture = scene.textures.get(ref.textureKey)
  const frames = texture.getFrameNames()
  if (frames.length < 2) return ref.textureKey
  const key = `${ref.textureKey}:still`
  if (scene.textures.exists(key)) return key
  const frame = texture.get(frames[0])
  const canvas = document.createElement('canvas')
  canvas.width = frame.cutWidth
  canvas.height = frame.cutHeight
  const context = artContext(canvas)
  if (!context) return ref.textureKey
  context.drawImage(texture.getSourceImage() as CanvasImageSource, frame.cutX, frame.cutY, frame.cutWidth, frame.cutHeight, 0, 0, frame.cutWidth, frame.cutHeight)
  const still = scene.textures.create(key, canvas)
  if (!still) return ref.textureKey
  still.add('__BASE', 0, 0, 0, canvas.width, canvas.height)
  return key
}
