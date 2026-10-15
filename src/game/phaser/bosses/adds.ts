import Phaser from 'phaser'
import type { SpriteRef } from '../../contracts/art'
import type { Combatant, CombatWorld, HitEvent, KillerInfo, StatusEffect } from '../../contracts/combat'
import { DEPTH } from '../../contracts/constants'
import type { PlayerHandle } from '../../contracts/player'
import { addStatus, clearStatus, createStatus, statusTimeScale, tickStatus } from '../combat/status'
import type { StatusState } from '../combat/status'
import { addCrouching, createAddMotion, stepAdd } from './reach'
import type { AddMotion, PerchWatch } from './reach'
import { applyRef } from './sprites'
import { clamp } from './zones'

export interface Adds {
  // Returns false when every add slot is in use.
  spawn(x: number, damage: number): boolean
  update(dtMs: number): void
  // Removes every add without a kill event, for a phase change or the boss going down.
  clear(): void
  destroy(): void
}

export interface AddsDeps {
  scene: Phaser.Scene
  combat: CombatWorld
  player: PlayerHandle
  // The orb art, drawn at SIZE.
  look: SpriteRef
  floorY: number
  left: number
  right: number
  // Where the player stands. The adds hop up to the platform in it.
  perch: PerchWatch
  // Reads the boss killer on demand, because the final boss changes it per phase.
  killer(): KillerInfo | null
}

const MAX_ADDS = 4
const SIZE = 22
const HP = 24
// The squash of a crouching add, before it hops.
const CROUCH_SQUASH = { x: 1.18, y: 0.78 }
const CONTACT_COOLDOWN_MS = 800
const CONTACT_ACTIVE_MS = 90
const FLASH_MS = 70
const DYING_MS = 220
const FROZEN_TINT = 0x8fd0ff

interface Slot extends Combatant {
  alive: boolean
  hp: number
  // Position and hop state, see stepAdd.
  motion: AddMotion
  face: 1 | -1
  damage: number
  contactMs: number
  flashMs: number
  dyingMs: number
  // Freezes and slows. A frozen add stands still and does not hurt on contact.
  status: StatusState
  sprite: Phaser.GameObjects.Sprite
}

// Small minions that run at the player and hurt on contact. A player up on a platform does not
// escape them for long: they crouch beside it and hop up, at a quarter of the player's speed (see
// stepAdd). They are Combatants of the boss team and name the boss as the killer. A fixed set of
// slots is reused, so a summon never creates objects.
export function createAdds(deps: AddsDeps): Adds {
  const { scene, combat, player, floorY } = deps
  const box = new Phaser.Geom.Rectangle()
  const spot = { x: 0, y: floorY }
  const bounds = { left: deps.left, right: deps.right, floorY }

  function makeSlot(index: number): Slot {
    const sprite = scene.add.sprite(0, floorY, deps.look.textureKey).setDepth(DEPTH.enemies).setVisible(false)
    applyRef(sprite, { ...deps.look, width: SIZE, height: SIZE })
    const slot: Slot = {
      id: `add:${index}`,
      team: 'enemy',
      get killer() {
        return deps.killer()
      },
      alive: false,
      hp: 0,
      motion: createAddMotion(0),
      face: 1,
      damage: 0,
      contactMs: 0,
      flashMs: 0,
      dyingMs: 0,
      status: createStatus(),
      sprite,
      hurtbox: () => box.setTo(slot.motion.x - SIZE / 2, floorY - slot.motion.lift - SIZE, SIZE, SIZE),
      facing: () => slot.face,
      position() {
        spot.x = slot.motion.x
        spot.y = floorY - slot.motion.lift
        return spot
      },
      isInvulnerable: () => false,
      isDead: () => slot.hp <= 0,
      receiveHit(hit: HitEvent) {
        if (slot.hp <= 0) return 0
        slot.hp -= hit.damage
        slot.flashMs = FLASH_MS
        if (slot.hp <= 0) slot.dyingMs = DYING_MS
        return hit.damage
      },
      applyStatus(effect: StatusEffect) {
        if (slot.hp > 0) addStatus(slot.status, effect, false)
      },
    }
    return slot
  }

  const slots = Array.from({ length: MAX_ADDS }, (_, i) => makeSlot(i))
  const baseScale = { x: slots[0].sprite.scaleX, y: slots[0].sprite.scaleY }

  function free(slot: Slot) {
    slot.alive = false
    slot.hp = 0
    slot.sprite.setVisible(false).clearTint()
    combat.unregister(slot)
  }

  function touchesPlayer(slot: Slot): boolean {
    const target = player.hurtbox()
    const { x, lift } = slot.motion
    const feet = floorY - lift
    return x - SIZE / 2 < target.right && x + SIZE / 2 > target.left && feet - SIZE < target.bottom && feet > target.top
  }

  return {
    spawn(x, damage) {
      const slot = slots.find((candidate) => !candidate.alive)
      if (!slot) return false
      slot.alive = true
      slot.hp = HP
      const m = slot.motion
      m.x = clamp(x, deps.left + SIZE, deps.right - SIZE)
      m.lift = 0
      m.ledge = null
      m.hopMs = -1
      slot.damage = damage
      slot.contactMs = CONTACT_COOLDOWN_MS / 2
      slot.flashMs = 0
      slot.dyingMs = 0
      clearStatus(slot.status)
      slot.sprite.setPosition(m.x, floorY).setScale(baseScale.x, baseScale.y).setVisible(true).setAlpha(1)
      combat.register(slot)
      return true
    },
    update(dtMs) {
      for (const slot of slots) {
        if (!slot.alive) continue
        if (slot.hp <= 0) {
          slot.dyingMs -= dtMs
          slot.sprite.setAlpha(Math.max(0, slot.dyingMs / DYING_MS))
          if (slot.dyingMs <= 0) free(slot)
          continue
        }
        tickStatus(slot.status, dtMs)
        const scale = statusTimeScale(slot.status)
        const m = slot.motion
        const playerX = player.position().x
        slot.face = playerX >= m.x ? 1 : -1
        // Stops a few units short of the player on the same surface.
        if (m.hopMs >= 0 || m.ledge !== deps.perch.ledge || Math.abs(playerX - m.x) > 6) {
          stepAdd(m, playerX, deps.perch.ledge, bounds, SIZE, dtMs * scale)
        }
        slot.contactMs = Math.max(0, slot.contactMs - dtMs * scale)
        if (scale > 0 && slot.contactMs <= 0 && !player.isDead() && touchesPlayer(slot)) {
          slot.contactMs = CONTACT_COOLDOWN_MS
          combat.spawnHitbox({
            owner: slot,
            shape: { kind: 'rect', x: -SIZE / 2, y: -SIZE, w: SIZE, h: SIZE },
            follow: true,
            activeMs: CONTACT_ACTIVE_MS,
            damage: slot.damage,
            knockback: { x: 150, y: -120 },
            hitStopMs: 25,
            maxTargets: Infinity,
            tags: ['light', 'contact'],
          })
        }
        slot.flashMs = Math.max(0, slot.flashMs - dtMs)
        if (slot.flashMs > 0) slot.sprite.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL)
        else if (slot.status.freezeMs > 0) slot.sprite.setTint(FROZEN_TINT).setTintMode(Phaser.TintModes.MULTIPLY)
        else slot.sprite.clearTint()
        const crouch = addCrouching(m)
        slot.sprite.setScale(baseScale.x * (crouch ? CROUCH_SQUASH.x : 1), baseScale.y * (crouch ? CROUCH_SQUASH.y : 1))
        slot.sprite.setPosition(m.x, floorY - m.lift)
      }
    },
    clear() {
      for (const slot of slots) {
        if (!slot.alive) continue
        // A contact hitbox follows its owner, so it would keep hurting after the add is gone.
        combat.cancelOwnedBy(slot)
        free(slot)
      }
    },
    destroy() {
      for (const slot of slots) {
        if (slot.alive) combat.unregister(slot)
        slot.sprite.destroy()
      }
    },
  }
}
