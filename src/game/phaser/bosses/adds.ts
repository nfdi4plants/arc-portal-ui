import Phaser from 'phaser'
import type { SpriteRef } from '../../contracts/art'
import type { Combatant, CombatWorld, HitEvent, KillerInfo, StatusEffect } from '../../contracts/combat'
import { DEPTH } from '../../contracts/constants'
import type { PlayerHandle } from '../../contracts/player'
import { addStatus, clearStatus, createStatus, statusTimeScale, tickStatus } from '../combat/status'
import type { StatusState } from '../combat/status'
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
  // Reads the boss killer on demand, because the final boss changes it per phase.
  killer(): KillerInfo | null
}

const MAX_ADDS = 4
const SIZE = 22
const HP = 24
const SPEED = 54
const CONTACT_COOLDOWN_MS = 800
const CONTACT_ACTIVE_MS = 90
const FLASH_MS = 70
const DYING_MS = 220
const FROZEN_TINT = 0x8fd0ff

interface Slot extends Combatant {
  alive: boolean
  hp: number
  x: number
  face: 1 | -1
  damage: number
  contactMs: number
  flashMs: number
  dyingMs: number
  // Freezes and slows. A frozen add stands still and does not hurt on contact.
  status: StatusState
  sprite: Phaser.GameObjects.Sprite
}

// Small minions that run at the player and hurt on contact. They are Combatants of the boss team
// and name the boss as the killer. A fixed set of slots is reused, so a summon never creates objects.
export function createAdds(deps: AddsDeps): Adds {
  const { scene, combat, player, floorY } = deps
  const box = new Phaser.Geom.Rectangle()
  const spot = { x: 0, y: floorY }

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
      x: 0,
      face: 1,
      damage: 0,
      contactMs: 0,
      flashMs: 0,
      dyingMs: 0,
      status: createStatus(),
      sprite,
      hurtbox: () => box.setTo(slot.x - SIZE / 2, floorY - SIZE, SIZE, SIZE),
      facing: () => slot.face,
      position() {
        spot.x = slot.x
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

  function free(slot: Slot) {
    slot.alive = false
    slot.hp = 0
    slot.sprite.setVisible(false).clearTint()
    combat.unregister(slot)
  }

  function touchesPlayer(slot: Slot): boolean {
    const target = player.hurtbox()
    return (
      slot.x - SIZE / 2 < target.right && slot.x + SIZE / 2 > target.left && floorY - SIZE < target.bottom && floorY > target.top
    )
  }

  return {
    spawn(x, damage) {
      const slot = slots.find((candidate) => !candidate.alive)
      if (!slot) return false
      slot.alive = true
      slot.hp = HP
      slot.x = clamp(x, deps.left + SIZE, deps.right - SIZE)
      slot.damage = damage
      slot.contactMs = CONTACT_COOLDOWN_MS / 2
      slot.flashMs = 0
      slot.dyingMs = 0
      clearStatus(slot.status)
      slot.sprite.setPosition(slot.x, floorY).setVisible(true).setAlpha(1)
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
        const dx = player.position().x - slot.x
        slot.face = dx >= 0 ? 1 : -1
        if (Math.abs(dx) > 6) slot.x = clamp(slot.x + slot.face * SPEED * scale * (dtMs / 1000), deps.left + SIZE, deps.right - SIZE)
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
        slot.sprite.setPosition(slot.x, floorY)
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
