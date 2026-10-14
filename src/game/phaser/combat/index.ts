import type Phaser from 'phaser'
import type { ScribbleArt } from '../../contracts/art'
import type { Combatant, CombatWorld, HitboxSpec, HitEvent, HitShape, ProjectileSpec, Team } from '../../contracts/combat'
import { DEPTH, PALETTE } from '../../contracts/constants'
import { placeholderArt } from '../placeholderArt'
import { applyDamageModifier, type DamageModifier } from './damage'
import { createFeedback } from './feedback'
import { boundsOf, facingOfVelocity, hitPoint, mirrorKnockback, overlaps, resolveShape, type Facing, type Point, type Rect } from './geometry'
import { createProjectilePool } from './projectilePool'

export * from './damage'
export * from './geometry'

export interface CombatWorldOptions {
  // Defaults to placeholderArt.
  art?: ScribbleArt
  // Draws active hitboxes, projectile shapes and hurtboxes.
  debug?: boolean
}

// What hitboxes and projectiles share while they try to hit something.
interface Attack {
  owner: Combatant
  team: Team
  spec: HitboxSpec | ProjectileSpec
  // World space, refreshed every step.
  shape: HitShape
  facing: Facing
  limit: number
  hits: Set<Combatant>
  done: boolean
}

interface HitboxState extends Attack {
  spec: HitboxSpec
  remainingMs: number
}

interface ProjectileState extends Attack {
  spec: ProjectileSpec
  sprite: Phaser.GameObjects.Sprite
  x: number
  y: number
  vx: number
  vy: number
  ageMs: number
  // Facing for a projectile that has no horizontal speed.
  idleFacing: Facing
}

type Listener = (event: HitEvent) => void

const DEBUG_COLORS = { hurtbox: PALETTE.teal, hitbox: 0xe5484d, reflect: PALETTE.blue, projectile: PALETTE.yellow } as const

export function createCombatWorld(scene: Phaser.Scene, options: CombatWorldOptions = {}): CombatWorld {
  const art = options.art ?? placeholderArt
  const combatants = new Set<Combatant>()
  const killed = new WeakSet<Combatant>()
  const hitboxes: HitboxState[] = []
  const projectiles: ProjectileState[] = []
  const listeners: Record<'hit' | 'kill', Set<Listener>> = { hit: new Set(), kill: new Set() }
  const pool = createProjectilePool(scene, 1 / art.pixelsPerUnit)
  const feedback = createFeedback(scene, art)
  const debugGraphics = options.debug ? scene.add.graphics().setDepth(DEPTH.hud) : null
  const scratch: Rect = { x: 0, y: 0, w: 0, h: 0 }
  // Reused by livingCombatants, so effects that look for targets every step allocate nothing.
  const living: Combatant[] = []
  let modifier: DamageModifier | null = null
  let hitStopMs = 0
  let destroyed = false

  function emit(event: 'hit' | 'kill', payload: HitEvent) {
    for (const listener of [...listeners[event]]) listener(payload)
  }

  function land(attack: Attack, target: Combatant, point: Point) {
    const { damage, crit } = applyDamageModifier(modifier, attack.owner, attack.spec.damage)
    const event: HitEvent = {
      attacker: attack.owner,
      target,
      damage,
      crit,
      knockback: mirrorKnockback(attack.spec.knockback, attack.facing),
      tags: [...(attack.spec.tags ?? [])],
    }
    // Targets react more mildly to shots than to strikes, so every projectile hit says it is one.
    if ('sprite' in attack && !event.tags.includes('projectile')) event.tags.push('projectile')
    const taken = target.receiveHit(event)
    if (typeof taken === 'number') event.damage = taken
    hitStopMs = Math.max(hitStopMs, attack.spec.hitStopMs)
    feedback.hit(point, event.damage, crit)
    emit('hit', event)
    if (target.isDead() && !killed.has(target)) {
      killed.add(target)
      emit('kill', event)
    }
  }

  function strike(attack: Attack) {
    for (const target of combatants) {
      if (attack.done || attack.hits.size >= attack.limit) return
      if (target.team === attack.team || attack.hits.has(target) || target.isDead() || target.isInvulnerable()) continue
      const hurtbox = target.hurtbox()
      scratch.x = hurtbox.x
      scratch.y = hurtbox.y
      scratch.w = hurtbox.width
      scratch.h = hurtbox.height
      if (!overlaps(attack.shape, scratch)) continue
      attack.hits.add(target)
      const point = hitPoint(attack.shape, scratch)
      if (attack.hits.size >= attack.limit) attack.done = true
      land(attack, target, point)
    }
  }

  function placeProjectile(shot: ProjectileState) {
    shot.facing = facingOfVelocity(shot.vx, shot.idleFacing)
    shot.shape = resolveShape(shot.spec.shape, shot, shot.facing)
    shot.sprite.setPosition(shot.x, shot.y)
    shot.sprite.setFlipX(shot.vx < 0)
    shot.sprite.setRotation(Math.atan2(shot.vy, Math.abs(shot.vx)) * (shot.vx < 0 ? -1 : 1))
  }

  function reflectIfHit(shot: ProjectileState, count: number) {
    if (!shot.spec.reflectable) return
    const bounds = boundsOf(shot.shape)
    for (let i = 0; i < count; i++) {
      const box = hitboxes[i]
      if (box.done || box.team === shot.team || !box.spec.tags?.includes('reflect')) continue
      if (!overlaps(box.shape, bounds)) continue
      shot.team = box.team
      shot.owner = box.owner
      shot.idleFacing = box.owner.facing()
      shot.vx = -shot.vx
      shot.hits.clear()
      placeProjectile(shot)
      return
    }
  }

  function compact() {
    let kept = 0
    for (const box of hitboxes) if (!box.done) hitboxes[kept++] = box
    hitboxes.length = kept
    kept = 0
    for (const shot of projectiles) {
      if (shot.done) pool.release(shot.sprite)
      else projectiles[kept++] = shot
    }
    projectiles.length = kept
  }

  // Attacks spawned while a step runs (from a hit listener, say) first act on the next step.
  function step(deltaMs: number) {
    const boxCount = hitboxes.length
    const shotCount = projectiles.length
    const seconds = deltaMs / 1000

    for (let i = 0; i < boxCount; i++) {
      const box = hitboxes[i]
      if (box.done || !box.spec.follow) continue
      box.facing = box.owner.facing()
      box.shape = resolveShape(box.spec.shape, box.owner.position(), box.facing)
    }

    for (let i = 0; i < shotCount; i++) {
      const shot = projectiles[i]
      if (shot.done) continue
      shot.x += shot.vx * seconds
      shot.y += shot.vy * seconds
      shot.vy += shot.spec.gravity * seconds
      placeProjectile(shot)
      reflectIfHit(shot, boxCount)
      strike(shot)
      shot.ageMs += deltaMs
      if (shot.ageMs >= shot.spec.lifetimeMs) shot.done = true
    }

    for (let i = 0; i < boxCount; i++) {
      const box = hitboxes[i]
      if (box.done) continue
      strike(box)
      box.remainingMs -= deltaMs
      if (box.remainingMs <= 0) box.done = true
    }

    compact()
  }

  function strokeShape(shape: HitShape, color: number) {
    if (!debugGraphics) return
    debugGraphics.lineStyle(1, color, 1)
    if (shape.kind === 'rect') debugGraphics.strokeRect(shape.x, shape.y, shape.w, shape.h)
    else debugGraphics.strokeCircle(shape.x, shape.y, shape.r)
  }

  function drawDebug() {
    if (!debugGraphics) return
    debugGraphics.clear()
    for (const combatant of combatants) {
      const box = combatant.hurtbox()
      strokeShape({ kind: 'rect', x: box.x, y: box.y, w: box.width, h: box.height }, DEBUG_COLORS.hurtbox)
    }
    for (const box of hitboxes) {
      if (!box.done) strokeShape(box.shape, box.spec.tags?.includes('reflect') ? DEBUG_COLORS.reflect : DEBUG_COLORS.hitbox)
    }
    for (const shot of projectiles) {
      if (!shot.done) strokeShape(shot.shape, DEBUG_COLORS.projectile)
    }
  }

  function destroy() {
    if (destroyed) return
    destroyed = true
    scene.events.off('shutdown', destroy)
    pool.destroy()
    feedback.destroy()
    debugGraphics?.destroy()
    hitboxes.length = 0
    projectiles.length = 0
    combatants.clear()
    listeners.hit.clear()
    listeners.kill.clear()
  }

  scene.events.once('shutdown', destroy)

  return {
    register(combatant) {
      combatants.add(combatant)
      killed.delete(combatant)
    },
    unregister(combatant) {
      combatants.delete(combatant)
      killed.delete(combatant)
    },
    spawnHitbox(spec) {
      const facing = spec.owner.facing()
      const state: HitboxState = {
        owner: spec.owner,
        team: spec.owner.team,
        spec,
        shape: resolveShape(spec.shape, spec.owner.position(), facing),
        facing,
        limit: spec.maxTargets,
        hits: new Set(),
        done: false,
        remainingMs: spec.activeMs,
      }
      hitboxes.push(state)
      return {
        cancel() {
          state.done = true
        },
      }
    },
    spawnProjectile(spec, origin) {
      const fallback = scene.textures.exists(spec.textureKey) ? null : art.projectile(scene, 'orb')
      const sprite = pool.acquire(fallback?.textureKey ?? spec.textureKey, fallback?.animKey ?? spec.animKey ?? null, origin.x, origin.y)
      const idleFacing = spec.owner.facing()
      const state: ProjectileState = {
        owner: spec.owner,
        team: spec.owner.team,
        spec,
        shape: spec.shape,
        facing: idleFacing,
        limit: Math.min(spec.pierce + 1, spec.maxTargets),
        hits: new Set(),
        done: false,
        sprite,
        x: origin.x,
        y: origin.y,
        vx: spec.velocity.x,
        vy: spec.velocity.y,
        ageMs: 0,
        idleFacing,
      }
      placeProjectile(state)
      projectiles.push(state)
      return {
        cancel() {
          if (state.done) return
          state.done = true
          state.sprite.setVisible(false)
        },
      }
    },
    cancelOwnedBy(owner) {
      for (const box of hitboxes) if (box.owner === owner) box.done = true
      for (const shot of projectiles) {
        if (shot.done || shot.owner !== owner) continue
        shot.done = true
        shot.sprite.setVisible(false)
      }
    },
    livingCombatants(team) {
      living.length = 0
      for (const combatant of combatants) if (combatant.team === team && !combatant.isDead()) living.push(combatant)
      return living
    },
    on(event, listener) {
      listeners[event].add(listener)
      return () => {
        listeners[event].delete(listener)
      }
    },
    setDamageModifier(next) {
      modifier = next
    },
    update(deltaMs) {
      if (destroyed) return
      feedback.update(deltaMs)
      if (hitStopMs > 0) hitStopMs = Math.max(0, hitStopMs - deltaMs)
      else step(deltaMs)
      drawDebug()
    },
    hitStopRemainingMs() {
      return hitStopMs
    },
    destroy,
  }
}
