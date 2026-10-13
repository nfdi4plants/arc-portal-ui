import type Phaser from 'phaser'
import type { ScribbleArt, SpriteRef, TileArt } from '../contracts/art'
import { PALETTE } from '../contracts/constants'
import { hashString } from '../contracts/rng'

// Flat coloured rectangles behind the ScribbleArt interface, so scenes run before the real art
// exists and in sandboxes that don't need it.

function hueColor(hue: number): number {
  const c = hsvToRgb(hue / 360, 0.55, 0.85)
  return (c.r << 16) | (c.g << 8) | c.b
}

// Local, so this module needs no runtime import of Phaser.
function hsvToRgb(h: number, s: number, v: number) {
  const i = Math.floor(h * 6)
  const f = h * 6 - i
  const p = v * (1 - s)
  const q = v * (1 - f * s)
  const t = v * (1 - (1 - f) * s)
  const [r, g, b] = [
    [v, t, p],
    [q, v, p],
    [p, v, t],
    [p, q, v],
    [t, p, v],
    [v, p, q],
  ][i % 6]
  return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) }
}

function box(scene: Phaser.Scene, key: string, width: number, height: number, color: number): SpriteRef {
  const textureKey = `placeholder:${key}`
  const animKey = `${textureKey}:idle`
  if (!scene.textures.exists(textureKey)) {
    const g = scene.make.graphics({ x: 0, y: 0 }, false)
    g.fillStyle(color, 1)
    g.fillRect(0, 0, width, height)
    g.lineStyle(2, PALETTE.outline, 1)
    g.strokeRect(1, 1, width - 2, height - 2)
    g.generateTexture(textureKey, width, height)
    g.destroy()
  }
  if (!scene.anims.exists(animKey)) {
    scene.anims.create({ key: animKey, frames: [{ key: textureKey }], frameRate: 1, repeat: -1 })
  }
  return {
    textureKey,
    animKey,
    width,
    height,
    anchors: { weapon: { x: width / 2, y: -height / 2 }, head: { x: 0, y: -height } },
  }
}

const SIZE = { small: 20, medium: 30, large: 44 } as const

export const placeholderArt: ScribbleArt = {
  monster(scene, spec) {
    const s = SIZE[spec.size]
    return box(scene, `monster:${spec.id}`, s, s, hueColor(spec.hue))
  },
  boss(scene, spec) {
    const ref = box(scene, `boss:${spec.archetype}`, 96, 120, hueColor(hashString(spec.archetype) % 360))
    return { ...ref, parts: {} }
  },
  finalBoss(scene) {
    const ref = box(scene, 'finalBoss', 160, 160, PALETTE.navy)
    return { ...ref, parts: {} }
  },
  playerWeapon(scene, id, tier) {
    return box(scene, `weapon:${id}:${tier}`, 28, 8, PALETTE.yellow)
  },
  projectile(scene, kind) {
    return box(scene, `projectile:${kind}`, 8, 8, PALETTE.yellow)
  },
  tiles(scene, theme): TileArt {
    const ground = box(scene, `tile:ground:${theme}`, 24, 24, 0x8a7f6e).textureKey
    const platform = box(scene, `tile:platform:${theme}`, 24, 8, 0xa89a84).textureKey
    const wall = box(scene, `tile:wall:${theme}`, 24, 24, 0x6e6558).textureKey
    const background = [box(scene, `tile:bg:${theme}`, 64, 64, 0xf3efe6).textureKey]
    return { ground, platform, wall, background }
  },
  telegraph(scene, shape, width, height) {
    return box(scene, `telegraph:${shape}:${width}x${height}`, Math.max(2, Math.round(width)), Math.max(2, Math.round(height)), 0xe5484d).textureKey
  },
  fx(scene, kind) {
    // Effects play once, so they get their own non-looping animation.
    const { textureKey } = box(scene, `fx:${kind}`, 12, 12, 0xffffff)
    const animKey = `${textureKey}:once`
    if (!scene.anims.exists(animKey)) {
      scene.anims.create({ key: animKey, frames: [{ key: textureKey }], duration: 250, repeat: 0 })
    }
    return animKey
  },
}
