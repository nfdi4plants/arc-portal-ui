import Phaser from 'phaser'
import { DEPTH, PALETTE, TILE } from '../../contracts/constants'
import { applySpriteRef, doorArt, glowTexture, portalSparkArt, portalSwirlArt } from '../art'
import { createPortalFrame, PORTAL_SPARKS, portalAt, portalSparkAt, type PortalSpark } from './portalSpawn'
import { addText } from './ui'

const T = TILE
// The door has the size of the one at the end of a stretch.
export const BOSS_PORTAL = { w: 2 * T, h: 3 * T }
// The player enters through the lower part of the arch only. Arena platforms (60 units up) may
// cross the arch, and a mage standing on one must not fall through the portal.
const ENTER_HEIGHT = 2 * T
// The middle of the swirl of doorArt, above the floor.
const SWIRL_LIFT = 30
const FLASH_SIZE = 46

export interface BossPortal {
  // Where the player walks in, once the portal is open (PORTAL_SPAWN_MS).
  readonly box: Phaser.Geom.Rectangle
  // Poses the portal `elapsedMs` after the boss fell. Allocates nothing.
  update(elapsedMs: number): void
}

// Draws the textures up front, so the frame the boss falls in does not stall.
export function prewarmBossPortal(scene: Phaser.Scene): void {
  doorArt(scene, BOSS_PORTAL.w, BOSS_PORTAL.h)
  portalSwirlArt(scene)
  portalSparkArt(scene)
  glowTexture(scene)
}

// The portal a beaten node boss leaves at `x` on the floor. It forms over PORTAL_SPAWN_MS (see
// portalSpawn.ts): dim and flickering while it forms, then a flash, a pulse of the swirl and the
// sign tell that it is open.
export function createBossPortal(scene: Phaser.Scene, x: number, floorY: number, sign: { title: string; detail: string }): BossPortal {
  const { w, h } = BOSS_PORTAL
  const box = new Phaser.Geom.Rectangle(x - w / 2, floorY - ENTER_HEIGHT, w, ENTER_HEIGHT)
  const doorRef = doorArt(scene, w, h)
  // Behind the tiles, so a platform over the middle of the arena crosses in front of the arch.
  const door = scene.add.sprite(x, floorY, doorRef.textureKey).setDepth(DEPTH.tiles - 2)
  applySpriteRef(door, doorRef)
  const frameW = door.frame.width
  const frameH = door.frame.height
  const swirlRef = portalSwirlArt(scene)
  const swirl = scene.add.sprite(x, floorY - SWIRL_LIFT, swirlRef.textureKey).setDepth(DEPTH.tiles - 1)
  applySpriteRef(swirl, swirlRef)
  swirl.setOrigin(0.5, 0.5)
  const swirlScale = swirl.scaleX
  const sparkRef = portalSparkArt(scene)
  const sparks = Array.from({ length: PORTAL_SPARKS }, () => {
    const spark = scene.add.sprite(x, floorY - SWIRL_LIFT, sparkRef.textureKey).setDepth(DEPTH.fx)
    applySpriteRef(spark, sparkRef)
    return spark.setOrigin(0.5, 0.5).setAlpha(0)
  })
  const flash = scene.add
    .image(x, floorY - SWIRL_LIFT, glowTexture(scene))
    .setTint(PALETTE.yellow)
    .setDepth(DEPTH.fx)
    .setVisible(false)
  const title = addText(scene, sign.title, 8, { color: PALETTE.navy, bold: true, align: 'center' })
    .setOrigin(0.5, 1)
    .setPosition(x, floorY - h - 12)
    .setDepth(DEPTH.tiles + 1)
  const detail = addText(scene, sign.detail, 6, { color: PALETTE.navy, align: 'center' })
    .setOrigin(0.5, 1)
    .setPosition(x, floorY - h - 4)
    .setDepth(DEPTH.tiles + 1)
  const opening = addText(scene, 'Opening…', 7, { color: PALETTE.navy, bold: true, align: 'center' })
    .setOrigin(0.5, 1)
    .setPosition(x, floorY - h - 4)
    .setDepth(DEPTH.tiles + 1)
  const frame = createPortalFrame()
  const spark: PortalSpark = { dx: 0, dy: 0, alpha: 0 }
  let open = false

  function update(elapsedMs: number) {
    const f = portalAt(frame, elapsedMs)
    // The arch draws in from the floor up.
    const shown = Math.round(frameH * f.arch)
    door.setVisible(shown > 0).setCrop(0, frameH - shown, frameW, shown).setAlpha(f.archAlpha)
    swirl.setScale(swirlScale * f.swirlScale).setRotation(f.spin).setAlpha(f.swirlAlpha)
    for (let i = 0; i < sparks.length; i++) {
      portalSparkAt(spark, elapsedMs, i)
      sparks[i].setPosition(x + spark.dx, floorY - SWIRL_LIFT + spark.dy).setAlpha(spark.alpha)
    }
    opening.setAlpha(f.ready ? 0 : f.archAlpha + 0.3)
    title.setAlpha(f.label)
    detail.setAlpha(f.label)
    flash.setVisible(f.flash > 0)
    if (f.flash > 0) flash.setDisplaySize(FLASH_SIZE * (2.6 - 1.6 * f.flash), FLASH_SIZE * (2.6 - 1.6 * f.flash)).setAlpha(f.flash)
    if (f.ready && !open) {
      open = true
      for (const s of sparks) s.setVisible(false)
      opening.setVisible(false)
    }
  }

  update(0)
  return { box, update }
}
