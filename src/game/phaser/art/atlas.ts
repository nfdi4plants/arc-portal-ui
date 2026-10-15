import type Phaser from 'phaser'
import type { SpriteRef } from '../../contracts/art'
import { hashString } from '../../contracts/rng'
import { BOIL_FPS, TEXTURE_SCALE, VARIANTS, frameName, frameRects } from './layout'
import { Pen } from './pen'

// Turns a drawing function into a Phaser texture with one frame per jittered variant and an
// animation over those frames. The canvas is drawn once. Boiling is frame swapping only.

export interface SpriteDef {
  // Texture key. The animation key is derived from it.
  key: string
  // World units.
  width: number
  height: number
  // Jittered copies, or the frames of a one-shot animation. 1 gives a still sprite.
  variants?: number
  anchors: SpriteRef['anchors']
  // Draws one variant in world units from the top left of the frame. Every variant must draw the
  // same shapes in the same order, the seeds make them differ.
  draw(pen: Pen, variant: number): void
  // Repeat shapes that cross the left or right edge on the opposite side, so the sprite tiles
  // horizontally without a seam.
  tileable?: boolean
  // Animation speed. Defaults to the boil speed.
  frameRate?: number
  // -1 loops, 0 plays once. Defaults to looping.
  repeat?: number
}

interface Memo<T> {
  value?: T
}

// Textures live in the game's texture manager, so a result stored on its texture survives scene
// restarts and disappears together with the game.
export function cached<T>(scene: Phaser.Scene, key: string, build: () => T): T {
  const textures = scene.textures
  if (textures.exists(key)) {
    const hit = (textures.get(key).customData as Memo<T>).value
    if (hit !== undefined) return hit
  }
  const value = build()
  if (textures.exists(key)) (textures.get(key).customData as Memo<T>).value = value
  return value
}

export function animKeyOf(textureKey: string): string {
  return `${textureKey}:idle`
}

function drawCanvas(def: SpriteDef, count: number): HTMLCanvasElement {
  const rects = frameRects(count, def.width, def.height)
  const canvas = document.createElement('canvas')
  canvas.width = rects.length * rects[0].w
  canvas.height = rects[0].h
  const pen = new Pen(canvas, TEXTURE_SCALE)
  const base = hashString(def.key)
  rects.forEach((rect, i) => {
    pen.begin(rect, base, i, def.tileable ? def.width : 0)
    def.draw(pen, i)
    pen.end()
  })
  return canvas
}

export function spriteFrom(scene: Phaser.Scene, def: SpriteDef): SpriteRef {
  return cached(scene, def.key, () => {
    const count = def.variants ?? VARIANTS
    const canvas = drawCanvas(def, count)
    // textures.create skips the CanvasTexture wrapper that addCanvas builds. That wrapper reads
    // every pixel back on creation.
    const texture = scene.textures.create(def.key, canvas)
    if (!texture) throw new Error(`Texture ${def.key} already exists`)
    texture.add('__BASE', 0, 0, 0, canvas.width, canvas.height)
    const rects = frameRects(count, def.width, def.height)
    rects.forEach((rect, i) => texture.add(frameName(i), 0, rect.x, rect.y, rect.w, rect.h))
    const animKey = animKeyOf(def.key)
    if (!scene.anims.exists(animKey)) {
      scene.anims.create({
        key: animKey,
        frames: rects.map((_, i) => ({ key: def.key, frame: frameName(i) })),
        frameRate: def.frameRate ?? BOIL_FPS,
        repeat: def.repeat ?? -1,
      })
    }
    return { textureKey: def.key, animKey, width: def.width, height: def.height, anchors: def.anchors }
  })
}

// Bytes the textures whose key starts with the prefix take on the GPU, at 4 bytes per pixel and
// without mipmaps.
export function textureBytes(scene: Phaser.Scene, keyPrefix: string): number {
  let bytes = 0
  for (const key of scene.textures.getTextureKeys()) {
    if (!key.startsWith(keyPrefix)) continue
    const source = scene.textures.get(key).source[0]
    bytes += source.width * source.height * 4
  }
  return bytes
}
