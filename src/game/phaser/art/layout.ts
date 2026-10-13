import type { TelegraphArt } from '../../contracts/art'
import type { BodyKind, EnemyWeaponKind, MonsterSpec, PassiveKind } from '../../contracts/content'
import { hashString } from '../../contracts/rng'

// Sizes, frame packing and seeds. Pure, so it is unit-tested without a canvas or Phaser.

// Canvas pixels per world unit. Textures are sharp up to a camera zoom of 2 and soften slightly
// above it, which keeps one segment's textures small enough for an integrated GPU.
export const TEXTURE_SCALE = 2
// Jittered copies of every animated sprite, cycled to make the lines boil.
export const VARIANTS = 3
export const BOIL_FPS = 8

export interface FrameRect {
  x: number
  y: number
  w: number
  h: number
}

// Frames sit side by side in one canvas. Sizes are in world units, the result is in pixels.
export function frameRects(count: number, width: number, height: number, scale = TEXTURE_SCALE): FrameRect[] {
  const w = Math.ceil(width * scale)
  const h = Math.ceil(height * scale)
  return Array.from({ length: count }, (_, i) => ({ x: i * w, y: 0, w, h }))
}

export function frameName(index: number): string {
  return `v${index}`
}

// roughjs treats seed 0 as "random" and its generator is weak for small seeds, so mix the inputs
// and keep the result in [2^20, 2^31).
export function seedFor(base: number, variant: number, shape: number): number {
  let h = (base ^ Math.imul(variant + 1, 0x9e3779b1) ^ Math.imul(shape + 1, 0x85ebca6b)) >>> 0
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d)
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b)
  h ^= h >>> 16
  return ((h >>> 1) | (1 << 20)) >>> 0
}

export function telegraphKey(shape: TelegraphArt, width: number, height: number): string {
  return `scribble:telegraph:${shape}:${Math.round(width)}x${Math.round(height)}`
}

// Body height in world units per monster size.
export const MONSTER_HEIGHT = { small: 20, medium: 30, large: 44 } as const

// Body width as a multiple of its height.
export const BODY_ASPECT: Record<BodyKind, number> = {
  slime: 1.25,
  wisp: 0.8,
  beetle: 1.35,
  golem: 1,
  imp: 0.85,
  turret: 1,
  bat: 1.7,
  crawler: 2,
}

// Where the weapon is held, as a fraction of the body box (x from the left, y from the top).
export const BODY_HAND: Record<BodyKind, { x: number; y: number }> = {
  slime: { x: 0.86, y: 0.6 },
  wisp: { x: 0.9, y: 0.5 },
  beetle: { x: 0.9, y: 0.58 },
  golem: { x: 0.94, y: 0.62 },
  imp: { x: 0.9, y: 0.62 },
  turret: { x: 0.9, y: 0.36 },
  bat: { x: 0.76, y: 0.78 },
  crawler: { x: 0.92, y: 0.5 },
}

// Where the face sits, as a fraction of the body box, plus the eye radius as a fraction of height.
export const BODY_FACE: Record<BodyKind, { x: number; y: number; spread: number; eye: number }> = {
  slime: { x: 0.52, y: 0.42, spread: 0.18, eye: 0.15 },
  wisp: { x: 0.55, y: 0.34, spread: 0.2, eye: 0.11 },
  beetle: { x: 0.8, y: 0.48, spread: 0.07, eye: 0.13 },
  golem: { x: 0.5, y: 0.2, spread: 0.2, eye: 0.1 },
  imp: { x: 0.54, y: 0.27, spread: 0.2, eye: 0.1 },
  turret: { x: 0.46, y: 0.54, spread: 0.2, eye: 0.14 },
  bat: { x: 0.5, y: 0.42, spread: 0.1, eye: 0.12 },
  crawler: { x: 0.86, y: 0.42, spread: 0.06, eye: 0.18 },
}

export interface WeaponStyle {
  // Length in world units for a medium monster at scale 1.
  length: number
  // Direction the weapon points in, radians, 0 = forward, negative = up.
  angle: number
  // How far the weapon reaches past the hand, as a multiple of its length.
  reach: number
}

export const ENEMY_WEAPON: Record<EnemyWeaponKind, WeaponStyle> = {
  claw: { length: 9, angle: 0, reach: 1 },
  spear: { length: 22, angle: -0.35, reach: 0.75 },
  bow: { length: 15, angle: 0, reach: 0.45 },
  wand: { length: 14, angle: -0.5, reach: 0.8 },
  bomb: { length: 9, angle: 0, reach: 0.7 },
  shield: { length: 13, angle: 0, reach: 0.8 },
  whip: { length: 18, angle: -0.2, reach: 1 },
  flask: { length: 10, angle: -0.3, reach: 0.7 },
}

const MARK_ABOVE_HEAD: ReadonlySet<PassiveKind> = new Set(['patrol', 'summoner', 'blink', 'chatter'])

export function marksAboveHead(kind: PassiveKind): boolean {
  return MARK_ABOVE_HEAD.has(kind)
}

export interface MonsterLayout {
  // The composite sprite in world units.
  width: number
  height: number
  // Body box inside the sprite.
  body: { x: number; y: number; w: number; h: number }
  hand: { x: number; y: number }
  weaponLength: number
  tip: { x: number; y: number }
}

export const MARK_HEADROOM = 11

export function weaponLength(kind: EnemyWeaponKind, bodyHeight: number, scale: number): number {
  return ENEMY_WEAPON[kind].length * (0.7 + (0.3 * bodyHeight) / 30) * scale
}

// The sprite is centred on the body, so the padding is the same on both sides and the weapon fits
// when the monster faces left or right.
export function monsterLayout(spec: Pick<MonsterSpec, 'body' | 'size' | 'weapon' | 'passive'>): MonsterLayout {
  const h = MONSTER_HEIGHT[spec.size]
  const w = Math.round(h * BODY_ASPECT[spec.body])
  const length = weaponLength(spec.weapon.kind, h, spec.weapon.scale)
  const style = ENEMY_WEAPON[spec.weapon.kind]
  const handFrac = BODY_HAND[spec.body]
  const protrusion = handFrac.x * w + length * style.reach - w
  const padX = Math.ceil(Math.max(3, protrusion + 3))
  const padTop = marksAboveHead(spec.passive.kind) ? MARK_HEADROOM : 4
  const padBottom = 2
  const hand = { x: padX + w * handFrac.x, y: padTop + h * handFrac.y }
  return {
    width: w + padX * 2,
    height: padTop + h + padBottom,
    body: { x: padX, y: padTop, w, h },
    hand,
    weaponLength: length,
    tip: {
      x: hand.x + Math.cos(style.angle) * length * style.reach,
      y: hand.y + Math.sin(style.angle) * length * style.reach,
    },
  }
}

export const FACE_COUNT = 16

// The passive variant only has four values and the tuned passive reads it as a stat choice, so the
// face index comes from the id. The id is a hash of the annotation, which keeps a monster's face.
export function faceIndexOf(spec: Pick<MonsterSpec, 'id'>): number {
  return hashString(spec.id) % FACE_COUNT
}

// Eye and mouth shape from a face index in 0 to 15.
export function faceVariant(variant: number): { eyes: number; mouth: number } {
  const v = Math.abs(Math.trunc(variant))
  return { eyes: v % 4, mouth: Math.floor(v / 4) % 4 }
}
