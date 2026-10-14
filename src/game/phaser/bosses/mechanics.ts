import type Phaser from 'phaser'
import type { BossMarkerKind } from '../../contracts/art'
import type { HitEvent } from '../../contracts/combat'
import { DEPTH } from '../../contracts/constants'
import type { BossAttackSpec, BossMechanicKind, BossMechanicSpec, BossThemeKind } from '../../contracts/content'
import { INSPECT_DIM_DEPTH } from '../mobs/tuning'
import { hitFromFront } from '../mobs/defense'
import type { AttackEnv } from './attacks'
import { applyRef } from './sprites'
import type { Zone } from './telegraph'
import { clamp, knockback, toOwnerShape } from './zones'

// The mechanic slots of a boss genome at runtime, see BossMechanicKind. Passive ones change the
// numbers (armour, enrage, mirror), timed ones (minion, spill, teleport, shield) start only while
// the boss stands idle, at most one at a time and MECHANIC_GAP_MS apart, so they never pile onto
// an attack. Every object is created once per boss and reused.

export interface MechanicsDeps extends AttackEnv {
  // Moves the boss to x with the blink flash.
  blink(x: number): void
  // Swaps the light attacks for the phase shift.
  shift(attacks: readonly BossAttackSpec[]): void
}

export interface MechanicsState {
  // No attack runs and the boss is not staggered.
  idle: boolean
  // The last attack was heavy, so the player may be punishing it now.
  lastHeavy: boolean
  // Share of the hp of this phase that is left, 1 to 0.
  phaseHp: number
}

export interface Mechanics {
  // A new phase: the mechanics and the theme badge to use, timers start over.
  set(mechanics: readonly BossMechanicSpec[], theme: BossThemeKind | null): void
  update(dtMs: number, state: MechanicsState): void
  // True while a spill is marked or burns. The boss starts no attack then.
  busy(): boolean
  // The damage a player hit deals after armour, shield and mirror. 0 blocks it completely.
  filterHit(hit: HitEvent, damage: number, staggered: boolean, heavyWindup: boolean): number
  // Multiplies attack cooldowns (enrage).
  cooldownScale(): number
  // Once per rendered frame. `top` is the y of the top of the boss.
  render(now: number, top: number, alpha: number, visible: boolean): void
  setRaised(on: boolean): void
  // Ends a running spill and shield, for a stagger, a phase change or the defeat.
  clear(): void
  destroy(): void
}

const MECHANIC_GAP_MS = 2500
const INTERVAL_MS: Partial<Record<BossMechanicKind, number>> = { summoner: 11000, hazard: 8000, teleport: 5000, shieldPulse: 9000 }
// A timer starts at this share of its interval, so the first event comes a little sooner.
const FIRST_SHARE = 0.6
const ARMOR_FACTOR = 0.6
const ENRAGE_AT = 0.4
const ENRAGE_SCALE = 0.7
const SHIFT_AT = 0.5
const SHIFT_DELAY_MS = 700
const SHIELD_MS = 1400
const SPILL = { w: 64, h: 16, warnMs: 900, burnMs: 1000 }
const REFLECT_GAP_MS = 350
const REFLECT_SPEED = 220
const MARKER_GAP = 3
const MARKER_LIFT = 6
const SHIELD_TINT = 0x9fd6ff
// World units, as drawn by the art.
const BOSS_MARKER_SIZE = 14

export function createMechanics(deps: MechanicsDeps): Mechanics {
  const { scene, combat, art, player, rng, arena, telegraphs, body, self, adds } = deps
  let kinds: BossMechanicSpec[] = []
  // One timer per timed mechanic, rebuilt on a phase change only.
  const timers: { kind: BossMechanicKind; leftMs: number }[] = []
  let gateMs = 0
  let shifted = false
  let enraged = false
  let shieldMs = 0
  let reflectMs = 0
  let spillZone: Zone | null = null
  let spillMs = 0
  let spillX = 0
  let raised = false

  const markers: Phaser.GameObjects.Sprite[] = []
  const markerScale: number[] = []
  const markerKinds: BossMarkerKind[] = []
  const orb = art.projectile(scene, 'orb')
  const shield = scene.add.sprite(0, 0, orb.textureKey).setDepth(DEPTH.enemies + 2).setVisible(false)
  applyRef(shield, { ...orb, width: body.hurtW * 1.3, height: body.hurtH * 1.1 })
  shield.setOrigin(0.5, 0.5).setTint(SHIELD_TINT).setAlpha(0.35)

  const has = (kind: BossMechanicKind) => kinds.some((m) => m.kind === kind)
  const specOf = (kind: BossMechanicKind) => kinds.find((m) => m.kind === kind)

  function markerSprite(index: number): Phaser.GameObjects.Sprite {
    let sprite = markers[index]
    if (!sprite) {
      sprite = scene.add.sprite(0, 0, orb.textureKey).setDepth(raised ? INSPECT_DIM_DEPTH + 2 : DEPTH.enemies + 2)
      markers[index] = sprite
    }
    return sprite
  }

  function endSpill() {
    spillZone?.release()
    spillZone = null
    spillMs = 0
  }

  function startSpill() {
    spillX = clamp(player.position().x, arena.left + SPILL.w / 2, arena.right - SPILL.w / 2)
    spillZone = telegraphs.show({ shape: 'rect', x: spillX, y: arena.floorY - SPILL.h / 2, w: SPILL.w, h: SPILL.h, fill: 'wide' })
    spillMs = SPILL.warnMs + SPILL.burnMs
  }

  function burnSpill(damage: number) {
    spillZone?.activate()
    const shape = { kind: 'rect' as const, x: spillX - SPILL.w / 2, y: arena.floorY - SPILL.h, w: SPILL.w, h: SPILL.h }
    combat.spawnHitbox({
      owner: self,
      shape: toOwnerShape(shape, self.position(), self.facing()),
      follow: false,
      activeMs: SPILL.burnMs,
      damage,
      knockback: knockback(player.position().x >= spillX ? 1 : -1, self.facing(), 60, 160),
      hitStopMs: 30,
      maxTargets: Infinity,
      tags: ['light'],
    })
  }

  function teleport() {
    const playerX = player.position().x
    const side = body.x >= playerX ? -1 : 1
    let target = playerX + side * rng.int(150, 230)
    if (target < deps.minX || target > deps.maxX) target = playerX - side * rng.int(150, 230)
    deps.blink(clamp(target, deps.minX, deps.maxX))
  }

  // Starts a timed mechanic. Returns false when its moment has not come.
  function trigger(kind: BossMechanicKind, state: MechanicsState): boolean {
    const spec = specOf(kind)
    if (!spec) return false
    if (kind === 'summoner') return adds.spawn(body.x + (rng.chance(0.5) ? -1 : 1) * (body.hurtW / 2 + 30), spec.damage)
    if (kind === 'hazard') {
      startSpill()
      return true
    }
    if (kind === 'teleport') {
      teleport()
      return true
    }
    // The shield never takes the punish window after a heavy attack.
    if (kind === 'shieldPulse' && !state.lastHeavy) {
      shieldMs = SHIELD_MS
      return true
    }
    return false
  }

  function reflect(damage: number) {
    const from = { x: body.x + body.facing * body.hurtW * 0.3, y: arena.floorY - body.lift - body.height * 0.55 }
    const aim = player.hurtbox()
    const angle = Math.atan2(aim.centerY - from.y, aim.centerX - from.x)
    combat.spawnProjectile(
      {
        owner: self,
        shape: { kind: 'circle', x: 0, y: 0, r: 6 },
        damage,
        knockback: { x: 110, y: -90 },
        hitStopMs: 30,
        maxTargets: Infinity,
        tags: ['projectile', 'light'],
        textureKey: deps.shotKey('orb'),
        velocity: { x: Math.cos(angle) * REFLECT_SPEED, y: Math.sin(angle) * REFLECT_SPEED },
        gravity: 0,
        lifetimeMs: 2500,
        pierce: 0,
        reflectable: true,
      },
      from,
    )
  }

  const api: Mechanics = {
    set(next, theme) {
      endSpill()
      kinds = [...next]
      timers.length = 0
      for (const m of kinds) {
        const interval = INTERVAL_MS[m.kind]
        if (interval) timers.push({ kind: m.kind, leftMs: interval * FIRST_SHARE })
      }
      gateMs = MECHANIC_GAP_MS
      shifted = false
      enraged = false
      shieldMs = 0
      reflectMs = 0
      markerKinds.length = 0
      for (const m of kinds) markerKinds.push(m.kind)
      if (theme) markerKinds.push(theme)
      markerKinds.forEach((kind, i) => {
        const sprite = markerSprite(i)
        applyRef(sprite, art.bossMarker(scene, kind))
        sprite.setOrigin(0.5, 1)
        markerScale[i] = sprite.scaleX
      })
      for (let i = markerKinds.length; i < markers.length; i++) markers[i].setVisible(false)
    },
    update(dtMs, state) {
      gateMs = Math.max(0, gateMs - dtMs)
      shieldMs = Math.max(0, shieldMs - dtMs)
      reflectMs = Math.max(0, reflectMs - dtMs)
      enraged = has('enrage') && state.phaseHp < ENRAGE_AT
      if (!shifted && state.phaseHp <= SHIFT_AT) {
        const spec = specOf('phaseShift')
        if (spec && spec.shiftAttacks.length > 0) {
          shifted = true
          deps.shift(spec.shiftAttacks)
          gateMs = Math.max(gateMs, SHIFT_DELAY_MS)
        }
      }
      if (spillMs > 0) {
        const before = spillMs
        spillMs = Math.max(0, spillMs - dtMs)
        if (before > SPILL.burnMs && spillMs <= SPILL.burnMs) burnSpill(specOf('hazard')?.damage ?? 0)
        else if (spillMs > SPILL.burnMs) spillZone?.setProgress(1 - (spillMs - SPILL.burnMs) / SPILL.warnMs)
        if (spillMs <= 0) endSpill()
        // Nothing else starts while a spill is on the floor.
        gateMs = Math.max(gateMs, MECHANIC_GAP_MS / 2)
      }
      for (const timer of timers) {
        timer.leftMs -= dtMs
        if (timer.leftMs > 0 || gateMs > 0 || !state.idle) continue
        if (!trigger(timer.kind, state)) continue
        timer.leftMs = INTERVAL_MS[timer.kind] ?? 0
        gateMs = MECHANIC_GAP_MS
      }
    },
    busy: () => spillMs > 0,
    filterHit(hit, damage, staggered, heavyWindup) {
      if (shieldMs > 0) return 0
      if (heavyWindup && has('reflect') && hit.tags.includes('projectile')) {
        if (reflectMs <= 0) {
          reflectMs = REFLECT_GAP_MS
          reflect(specOf('reflect')?.damage ?? 0)
        }
        return 0
      }
      if (!staggered && has('armoredFront')) {
        const from = hit.attacker.position()
        const top = arena.floorY - body.lift - body.hurtH
        const above = from.y < top + body.hurtH * 0.35
        if (!above && hitFromFront(body.x, body.facing, from.x)) return damage * ARMOR_FACTOR
      }
      return damage
    },
    cooldownScale: () => (enraged ? ENRAGE_SCALE : 1),
    render(now, top, alpha, visible) {
      const count = markerKinds.length
      const left = body.x - ((count - 1) * (BOSS_MARKER_SIZE + MARKER_GAP)) / 2
      for (let i = 0; i < count; i++) {
        const sprite = markers[i]
        sprite.setVisible(visible)
        if (!visible) continue
        // An enraged boss shakes its badge.
        const pulse = markerKinds[i] === 'enrage' && enraged ? 1 + 0.2 * Math.abs(Math.sin(now / 90)) : 1
        sprite.setPosition(left + i * (BOSS_MARKER_SIZE + MARKER_GAP), top - MARKER_LIFT).setAlpha(alpha).setScale(markerScale[i] * pulse)
      }
      shield.setVisible(visible && shieldMs > 0)
      if (shieldMs > 0) {
        shield.setPosition(body.x, arena.floorY - body.lift - body.hurtH / 2)
        shield.setAlpha(0.25 + 0.15 * Math.sin(now / 80))
      }
    },
    setRaised(on) {
      raised = on
      for (const sprite of markers) sprite.setDepth(on ? INSPECT_DIM_DEPTH + 2 : DEPTH.enemies + 2)
    },
    clear() {
      endSpill()
      shieldMs = 0
    },
    destroy() {
      endSpill()
      for (const sprite of markers) sprite.destroy()
      markers.length = 0
      shield.destroy()
    },
  }
  return api
}
