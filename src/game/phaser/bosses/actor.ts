import Phaser from 'phaser'
import type { Annotation } from '../../../arc/provenance/types'
import type { PartRef, ProjectileArt, SpriteRef } from '../../contracts/art'
import type { Combatant, HitEvent, KillerInfo, StatusEffect } from '../../contracts/combat'
import type { BossArchetype, BossAttackSpec } from '../../contracts/content'
import { DEPTH, PALETTE } from '../../contracts/constants'
import { cssColor } from '../color'
import { addStatus, clearStatus, createStatus, statusTimeScale, tickStatus } from '../combat/status'
import { createAdds } from './adds'
import { ATTACK_KINDS, createRun, resetRun } from './attacks'
import type { AttackEnv, BossBody } from './attacks'
import type { Arena, BossDeps, BossHandle } from './index'
import { createScheduler, OPENING_DELAY_MS, windupMs } from './scheduler'
import { applyRef, setOriginOf, stillTexture } from './sprites'
import { staggerBarSize, staggerDurationMs, staggerLocked, staggerProgress } from './stagger'
import { createTelegraphPool, createTextPool } from './telegraph'
import { clamp, formatTell, highestWeakPoint, hitsWeakPoint } from './zones'

// What a boss looks like to the actor in one phase. A node boss has one phase, the final boss one
// per segment.
export interface PhaseConfig {
  archetype: BossArchetype
  attacks: readonly BossAttackSpec[]
  quality: number
  showHpBar: boolean
  showAttackNames: boolean
  safeZones: number
  weakPoints: number
  staggerWindowMs: number
  tells: readonly Annotation[]
}

export interface ActorConfig {
  id: string
  art: SpriteRef & { parts: Record<string, PartRef> }
  hp: number
  phases: readonly PhaseConfig[]
  killerFor(phase: number): KillerInfo
  // False keeps the body and its limbs as drawn when the boss faces left (the final boss has its title written on it).
  mirror?: boolean
  deps: BossDeps
  arena: Arena
}

export interface Actor extends BossHandle {
  phaseIndex(): number
  onPhaseChange(listener: (phase: number) => void): () => void
}

const WEAK_MULTIPLIER = 2
const WEAK_SIZE = 16
const STAGGER_MULTIPLIER = 1.5
const STAGGER_RECOVER_MS = 350
// A stagger pushes the boss this far away from the player, over STAGGER_PUSH_MS.
const STAGGER_PUSH = 36
const STAGGER_PUSH_MS = 220
const TRANSITION_MS = 1200
const DEFEAT_FADE_MS = 900
// The tint of a boss that a freeze or a fume hood slows.
const SLOWED_TINT = 0x9fd6ff
const HURT_FLASH_MS = 70
const LIGHT_FLASH_MS = 110
const TELL_MS = 1400
const RECOVERY_HEAVY_MS = 280
const RECOVERY_LIGHT_MS = 160
const ARMS_DROP_MS = 150
const HOVER = 22
const HOP_MS = 520
const HOP_HEIGHT = 36
const EPSILON = 1e-6
// scenes/arena.ts builds the arena this many camera views wide.
const ARENA_VIEWS = 1.6
// How far the boss may start from the player, in views. A little under one leaves the body on screen.
const START_REACH = 0.75

const CREAM = cssColor(PALETTE.cream)
const OUTLINE = cssColor(PALETTE.outline)

interface Limb {
  sprite: Phaser.GameObjects.Sprite
  ref: PartRef
  // -1 left, 1 right, 0 centred, as drawn facing right.
  side: number
  phase: number
  mirrored: boolean
}

type State = 'fighting' | 'dying' | 'defeated'

// Everything a boss does, shared by node bosses and the final boss. The scheduler decides when to
// attack and attacks.ts defines what an attack is. This file adds the body, the hit handling, the
// rewards of annotation quality and the visuals.
export function createActor(scene: Phaser.Scene, config: ActorConfig): Actor {
  const { art, deps, arena, phases } = config
  const { combat, player } = deps
  const rng = deps.rng.fork(config.id)
  const floorY = arena.floorY
  const width = art.width
  const height = art.height
  const hurtW = width * 0.7
  const hurtH = height * 0.9
  const minX = arena.left + hurtW / 2
  const maxX = arena.right - hurtW / 2
  const homeX = (arena.left + arena.right) / 2
  const maxHp = config.hp
  const phaseHp = maxHp / phases.length
  const hoverOf = (archetype: BossArchetype) => (archetype === 'glitchDaemon' ? HOVER : 0)

  let phase = 0
  let killer = config.killerFor(0)
  let hp = maxHp
  let state: State = 'fighting'
  let destroyed = false
  // Boss time in ms. It stops during hit-stop because the scene skips update().
  let clock = 0
  let staggerMs = 0
  let transitionMs = 0
  let hurtFlashMs = 0
  let lightFlashMs = 0
  let blinkMs = 0
  let defeatMs = 0
  let tellMs = 0
  let tellIndex = 0
  let tellText: Phaser.GameObjects.Text | null = null
  let staggerFill = 0
  let staggerTotalMs = 0
  let pushMs = 0
  let pushDir = 1
  const listeners = new Set<(phase: number) => void>()
  // A boss is never frozen. A freeze slows its clock instead (addStatus with boss = true).
  const status = createStatus()
  const move = { hopping: false, hopMs: 0, fromX: 0, toX: 0, waitMs: 700, blinkInMs: 2500 }

  const first = phases[0]
  // The camera starts at the left wall with the player, so a boss further right than the first view
  // would be off screen when the fight begins.
  const viewReachX = player.position().x + ((arena.right - arena.left) / ARENA_VIEWS) * START_REACH - hurtW / 2
  const startX = first.archetype === 'rootTreant' ? homeX : homeX + (arena.right - arena.left) * 0.22
  const body: BossBody = {
    x: clamp(startX, minX, Math.max(minX, Math.min(maxX, viewReachX))),
    lift: hoverOf(first.archetype),
    facing: -1,
    alpha: 1,
    lean: 0,
    hurtW,
    hurtH,
    height,
  }

  const hurt = new Phaser.Geom.Rectangle()
  const pos = { x: 0, y: 0 }
  const run = createRun()
  const scheduler = createScheduler<BossAttackSpec>(rng.fork('attacks'))
  scheduler.setAttacks(first.attacks, first.quality, OPENING_DELAY_MS)
  const cfg = () => phases[phase]

  // Visuals.
  const sprite = scene.add.sprite(body.x, floorY, art.textureKey).setDepth(DEPTH.enemies)
  applyRef(sprite, art)
  const baseScale = { x: sprite.scaleX, y: sprite.scaleY }
  const limbs: Limb[] = []
  for (const [name, ref] of Object.entries(art.parts)) {
    if (name === 'weakPoint') continue
    const limbSprite = scene.add.sprite(0, 0, ref.textureKey).setDepth(DEPTH.enemies + 1)
    applyRef(limbSprite, ref)
    limbs.push({ sprite: limbSprite, ref, side: Math.sign(ref.rest.x), phase: limbs.length * 1.7, mirrored: false })
  }
  const orb = deps.art.projectile(scene, 'orb')
  const glowRef: SpriteRef = art.parts.weakPoint ?? orb
  const weakSprites = [0, 1, 2].map(() => {
    const s = scene.add.sprite(0, 0, glowRef.textureKey).setDepth(DEPTH.enemies + 2).setVisible(false)
    applyRef(s, { ...glowRef, width: WEAK_SIZE, height: WEAK_SIZE })
    return s.setOrigin(0.5, 0.5)
  })
  const weakScale = weakSprites[0].scaleX
  const dizzySprites = [0, 1, 2].map(() => {
    const s = scene.add.sprite(0, 0, orb.textureKey).setDepth(DEPTH.enemies + 3).setVisible(false)
    applyRef(s, { ...orb, width: 9, height: 9 })
    return s.setOrigin(0.5, 0.5).setTint(PALETTE.yellow)
  })
  let deathFx: Phaser.GameObjects.Sprite | null = null
  // 0 untinted, 1 white flash, 2 slowed.
  let lastTint = 0

  const telegraphs = createTelegraphPool(scene, deps.art)
  const tellPool = createTextPool(scene, { fontFamily: 'sans-serif', fontStyle: 'bold', fontSize: '9px', color: CREAM, stroke: OUTLINE, strokeThickness: 2 })
  const adds = createAdds({
    scene,
    combat,
    player,
    look: orb,
    floorY,
    left: arena.left,
    right: arena.right,
    killer: () => killer,
  })
  const shotKeys = new Map<ProjectileArt, string>()

  const self: Actor = {
    id: config.id,
    team: 'enemy',
    get killer() {
      return killer
    },
    // The rectangle and the position are reused. Read them, do not keep them.
    hurtbox: () => hurt.setTo(body.x - hurtW / 2, floorY - body.lift - hurtH, hurtW, hurtH),
    facing: () => body.facing,
    position() {
      pos.x = body.x
      pos.y = floorY - body.lift
      return pos
    },
    isInvulnerable: () => transitionMs > 0 || state !== 'fighting',
    isDead: () => hp <= 0,
    receiveHit,
    applyStatus(effect: StatusEffect) {
      if (state === 'fighting') addStatus(status, effect, true)
    },
    update,
    hpFraction: () => hp / maxHp,
    showHpBar: () => cfg().showHpBar,
    currentAttackName: () => (cfg().showAttackNames && (run.phase === 'windup' || run.phase === 'active') ? run.spec.name : null),
    staggerFraction: () => (staggerMs > 0 ? staggerMs / staggerTotalMs : Math.min(1, staggerFill / staggerBarSize(cfg().quality))),
    staggerState: () => (staggerMs > 0 ? 'staggered' : staggerLocked(run.phase, run.spec.heavy) ? 'locked' : 'filling'),
    isDefeated: () => state === 'defeated',
    destroy,
    phaseIndex: () => phase,
    onPhaseChange(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }

  const env: AttackEnv = {
    scene,
    combat,
    art: deps.art,
    player,
    rng,
    arena,
    telegraphs,
    body,
    self,
    adds,
    archetype: first.archetype,
    safeZones: first.safeZones,
    hover: hoverOf(first.archetype),
    minX,
    maxX,
    shotKey(kind) {
      let key = shotKeys.get(kind)
      if (!key) {
        key = stillTexture(scene, deps.art.projectile(scene, kind))
        shotKeys.set(kind, key)
      }
      return key
    },
  }
  body.facing = player.position().x >= body.x ? 1 : -1

  function releaseZones() {
    for (const zone of run.zones) zone.release()
    run.zones.length = 0
  }

  function releaseTell() {
    if (tellText) tellPool.release(tellText)
    tellText = null
    tellMs = 0
  }

  // Stops the attack that is running. With clearShots it also cancels that attack's own shots.
  // Shots of earlier attacks keep flying, and a phase change or the defeat cancels them through
  // the combat world.
  function interrupt(clearShots: boolean) {
    if (run.phase === 'none') return
    releaseZones()
    for (const box of run.boxes) box.cancel()
    if (clearShots) for (const shot of run.shots) shot.cancel()
    run.boxes.length = 0
    run.shots.length = 0
    run.phase = 'none'
    body.lean = 0
    body.alpha = 1
    body.lift = env.hover
    body.x = clamp(body.x, minX, maxX)
  }

  function finishAttack() {
    releaseZones()
    run.boxes.length = 0
    run.shots.length = 0
    run.phase = 'none'
    body.lean = 0
    body.alpha = 1
    scheduler.complete()
  }

  function showTell() {
    const tells = cfg().tells
    if (tells.length === 0) return
    if (tellText) tellPool.release(tellText)
    tellText = tellPool.acquire().setText(formatTell(tells[tellIndex % tells.length]))
    tellIndex++
    tellMs = TELL_MS
  }

  function beginAttack(spec: BossAttackSpec) {
    resetRun(run, spec, windupMs(spec.telegraphMs))
    ATTACK_KINDS[spec.kind].begin(run, env)
    if (spec.heavy) showTell()
    else lightFlashMs = LIGHT_FLASH_MS
  }

  function stepAttack(dtMs: number) {
    const kind = ATTACK_KINDS[run.spec.kind]
    run.elapsedMs += dtMs
    if (run.phase === 'windup') {
      kind.windup?.(run, env, Math.min(1, run.elapsedMs / run.windupMs))
      if (run.elapsedMs >= run.windupMs) {
        run.phase = 'active'
        run.elapsedMs = 0
        kind.fire(run, env)
        for (const zone of run.zones) zone.activate()
      }
    } else if (run.phase === 'active') {
      kind.active?.(run, env, dtMs)
      if (run.elapsedMs >= run.activeMs) {
        run.phase = 'recovery'
        run.elapsedMs = 0
        releaseZones()
      }
    } else if (run.phase === 'recovery') {
      body.lean -= body.lean * Math.min(1, dtMs / 120)
      if (run.elapsedMs >= (run.spec.heavy ? RECOVERY_HEAVY_MS : RECOVERY_LIGHT_MS)) finishAttack()
    }
  }

  // Idle movement per archetype. Returns true when the boss may start an attack.
  function moveIdle(dtMs: number): boolean {
    const seconds = dtMs / 1000
    const playerX = player.position().x
    const dx = playerX - body.x
    if (Math.abs(dx) > 14 && !move.hopping) body.facing = dx > 0 ? 1 : -1
    if (!move.hopping) {
      const hover = env.hover + (env.archetype === 'glitchDaemon' ? Math.sin(clock / 420) * 5 : 0)
      body.lift += (hover - body.lift) * Math.min(1, dtMs / 120)
    }
    switch (env.archetype) {
      case 'rootTreant': {
        const away = homeX - body.x
        if (Math.abs(away) > 2) body.x += Math.sign(away) * Math.min(Math.abs(away), 45 * seconds)
        return true
      }
      case 'specimenJar': {
        if (move.hopping) {
          move.hopMs += dtMs
          const u = Math.min(1, move.hopMs / HOP_MS)
          body.x = move.fromX + (move.toX - move.fromX) * u
          body.lift = 4 * HOP_HEIGHT * u * (1 - u)
          if (u >= 1) {
            move.hopping = false
            body.lift = 0
            move.waitMs = rng.int(450, 900)
          }
          return false
        }
        move.waitMs -= dtMs
        if (move.waitMs <= 0 && Math.abs(dx) > 120) {
          move.hopping = true
          move.hopMs = 0
          move.fromX = body.x
          move.toX = clamp(body.x + Math.sign(dx) * Math.min(110, Math.abs(dx) - 90), minX, maxX)
          body.facing = dx > 0 ? 1 : -1
        }
        return !move.hopping
      }
      case 'reagentGolem': {
        if (Math.abs(dx) > 90) body.x += Math.sign(dx) * 34 * seconds
        break
      }
      case 'glitchDaemon': {
        move.blinkInMs -= dtMs
        if (move.blinkInMs <= 0) {
          move.blinkInMs = rng.int(2200, 3600)
          blinkMs = 220
          const side = rng.chance(0.5) ? -1 : 1
          let target = playerX + side * rng.int(150, 250)
          if (target < minX || target > maxX) target = playerX - side * rng.int(150, 250)
          body.x = target
        }
        break
      }
    }
    body.x = clamp(body.x, minX, maxX)
    return true
  }

  // Weak points are glowing spots on the body, as many as the phase has (0 to 3). A hit on one takes
  // double damage, see hitsWeakPoint for how a hit is matched to a spot.
  const weakSpot = { x: 0, y: 0, size: WEAK_SIZE, rear: false }
  const attackerPoint = { x: 0, y: 0 }

  function placeWeakSpot(index: number) {
    const bottom = floorY - body.lift
    weakSpot.rear = index === 2
    if (index === 0) {
      // Where the art puts its marker.
      const part = art.parts.weakPoint
      weakSpot.x = part ? body.x + body.facing * part.rest.x : body.x
      weakSpot.y = part ? bottom + part.rest.y - part.height / 2 : bottom - height * 0.5
    } else if (index === 1) {
      // The head. A mage on the ground cannot reach it, a jump does.
      weakSpot.x = body.x
      weakSpot.y = bottom - height * 0.88
    } else {
      // The back, low on the side away from where the boss faces. Only hits from behind count.
      weakSpot.x = body.x - body.facing * hurtW * 0.4
      weakSpot.y = bottom - height * 0.3
    }
    // A tall boss or a hovering one would put the head above what a jump reaches.
    weakSpot.y = Math.max(weakSpot.y, floorY - highestWeakPoint(WEAK_SIZE))
  }

  function isWeakHit(attacker: Combatant): boolean {
    const box = attacker.hurtbox()
    attackerPoint.x = box.centerX
    attackerPoint.y = box.centerY
    for (let i = 0; i < cfg().weakPoints; i++) {
      placeWeakSpot(i)
      if (hitsWeakPoint(weakSpot, attackerPoint, body.x, hurtW / 2, body.facing)) return true
    }
    return false
  }

  function floorHp(): number {
    return phase >= phases.length - 1 ? 0 : maxHp - (phase + 1) * phaseHp
  }

  // Ends a hop in mid-air, for the moments when idle movement stops running.
  function landFromHop() {
    move.hopping = false
    body.lift = env.hover
  }

  function startStagger() {
    staggerFill = 0
    staggerMs = staggerTotalMs = staggerDurationMs(cfg().staggerWindowMs)
    pushMs = STAGGER_PUSH_MS
    pushDir = player.position().x >= body.x ? -1 : 1
    landFromHop()
    interrupt(false)
    scheduler.complete()
    scheduler.delay(staggerMs + STAGGER_RECOVER_MS)
    releaseTell()
  }

  function startTransition() {
    phase++
    killer = config.killerFor(phase)
    transitionMs = TRANSITION_MS
    // The next phase starts at full speed.
    clearStatus(status)
    staggerMs = 0
    staggerFill = 0
    pushMs = 0
    interrupt(true)
    combat.cancelOwnedBy(self)
    adds.clear()
    releaseTell()
    const next = cfg()
    env.archetype = next.archetype
    env.safeZones = next.safeZones
    env.hover = hoverOf(next.archetype)
    landFromHop()
    scheduler.setAttacks(next.attacks, next.quality, TRANSITION_MS + OPENING_DELAY_MS / 2)
    hurtFlashMs = 200
    for (const listener of [...listeners]) listener(phase)
  }

  function startDefeat() {
    state = 'dying'
    defeatMs = 0
    staggerMs = 0
    pushMs = 0
    landFromHop()
    interrupt(true)
    combat.cancelOwnedBy(self)
    adds.clear()
    releaseTell()
    hurtFlashMs = 200
    const fx = scene.add
      .sprite(body.x, floorY - body.lift - height * 0.5, '__DEFAULT')
      .setDepth(DEPTH.fx)
      .setScale(3 / deps.art.pixelsPerUnit)
    fx.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      fx.destroy()
      if (deathFx === fx) deathFx = null
    })
    deathFx = fx
    fx.play({ key: deps.art.fx(scene, 'death'), repeat: 0 })
  }

  function receiveHit(hit: HitEvent): number {
    if (state !== 'fighting' || self.isInvulnerable()) return 0
    let damage = hit.damage
    if (isWeakHit(hit.attacker)) damage *= WEAK_MULTIPLIER
    if (staggerMs > 0) damage *= STAGGER_MULTIPLIER
    const floor = floorHp()
    hp = Math.max(floor, hp - damage)
    hurtFlashMs = HURT_FLASH_MS
    if (hp <= 0) {
      startDefeat()
      return damage
    }
    if (hp <= floor + EPSILON) {
      startTransition()
      return damage
    }
    // The hit fills the stagger bar unless the boss is staggered already or a heavy attack locks it.
    if (staggerMs > 0 || cfg().staggerWindowMs <= 0 || staggerLocked(run.phase, run.spec.heavy)) return damage
    staggerFill += staggerProgress(hit)
    if (staggerFill >= staggerBarSize(cfg().quality)) startStagger()
    return damage
  }

  // A slow runs the whole boss on a slower clock: movement, windups, telegraphs and cooldowns. The
  // adds keep their own time, and the stagger bar works as always.
  function update(realMs: number) {
    if (destroyed || state === 'defeated') return
    tickStatus(status, realMs)
    if (state !== 'fighting') clearStatus(status)
    const dtMs = realMs * statusTimeScale(status)
    clock += dtMs
    hurtFlashMs = Math.max(0, hurtFlashMs - dtMs)
    if (state === 'dying') {
      defeatMs += dtMs
      if (defeatMs >= DEFEAT_FADE_MS) state = 'defeated'
      return
    }
    lightFlashMs = Math.max(0, lightFlashMs - dtMs)
    blinkMs = Math.max(0, blinkMs - dtMs)
    if (tellMs > 0) {
      tellMs -= dtMs
      if (tellMs <= 0) releaseTell()
    }
    scheduler.tick(dtMs)
    adds.update(realMs)
    if (transitionMs > 0) {
      transitionMs = Math.max(0, transitionMs - dtMs)
      return
    }
    if (staggerMs > 0) {
      staggerMs = Math.max(0, staggerMs - dtMs)
      if (pushMs > 0) {
        const step = Math.min(pushMs, dtMs)
        pushMs -= step
        body.x = clamp(body.x + pushDir * STAGGER_PUSH * (step / STAGGER_PUSH_MS), minX, maxX)
      }
      return
    }
    if (run.phase !== 'none') {
      stepAttack(dtMs)
      return
    }
    if (!moveIdle(dtMs) || player.isDead()) return
    const next = scheduler.next()
    if (next) beginAttack(next)
  }

  // Runs once per rendered frame. Positions, poses and fills are derived from the state that
  // update() advanced, so a frame with two physics steps does the visual work once.
  function render() {
    if (destroyed) return
    const now = scene.time.now
    const facing = body.facing
    const mirrored = config.mirror !== false && facing < 0
    // Limbs follow the body, so an unmirrored body keeps them where they are drawn.
    const limbFacing = config.mirror === false ? 1 : facing
    const y = floorY - body.lift

    let alpha = body.alpha
    if (state === 'dying') alpha *= 1 - defeatMs / DEFEAT_FADE_MS
    else if (state === 'defeated') alpha = 0
    if (blinkMs > 0) alpha *= 0.25
    const visible = alpha > 0

    let raise = 0
    let crouch = 0
    let stretch = 0
    if (run.phase === 'windup') {
      raise = Math.min(1, run.elapsedMs / run.windupMs)
      crouch = raise
      for (const zone of run.zones) zone.setProgress(raise)
    } else if (run.phase === 'active') {
      raise = Math.max(0, 1 - run.elapsedMs / ARMS_DROP_MS)
      stretch = Math.max(0, 1 - run.elapsedMs / (ARMS_DROP_MS + 20))
    }
    const breathe = Math.sin(now / 450) * 0.015
    const wobble = staggerMs > 0 ? Math.sin(now / 70) * 0.1 : 0
    const white = hurtFlashMs > 0 || lightFlashMs > 0 || (transitionMs > 0 && Math.floor(now / 90) % 2 === 0)
    const tint = white ? 1 : status.slowMs > 0 ? 2 : 0
    const tintChanged = tint !== lastTint
    lastTint = tint

    sprite.setVisible(visible)
    if (visible) {
      sprite.setPosition(body.x, y)
      sprite.setFlipX(mirrored)
      sprite.setScale(baseScale.x * (1 + 0.05 * crouch - 0.05 * stretch), baseScale.y * (1 - 0.08 * crouch + 0.08 * stretch + breathe))
      sprite.setRotation(body.lean + wobble)
      sprite.setAlpha(alpha)
      if (tintChanged) paintTint(sprite, tint)
    }

    for (const limb of limbs) {
      const part = limb.sprite
      part.setVisible(visible)
      if (!visible) continue
      if (limb.mirrored !== mirrored) {
        limb.mirrored = mirrored
        setOriginOf(part, limb.ref, mirrored)
      }
      const { rest, pivot, height: partHeight } = limb.ref
      const worldSide = limb.side * limbFacing
      // Arms swing from the shoulder, a hand or lid turns less.
      const reach = -pivot.y / partHeight >= 0.9 ? 2 : 0.7
      const swing = worldSide === 0 ? -limbFacing * 0.6 * raise : -worldSide * reach * raise
      part.setPosition(body.x + limbFacing * (rest.x + pivot.x), y + rest.y + pivot.y)
      part.setRotation(swing + Math.sin(now / 500 + limb.phase) * 0.06)
      part.setAlpha(alpha)
      if (tintChanged) paintTint(part, tint)
    }

    const spots = state === 'fighting' ? cfg().weakPoints : 0
    for (let i = 0; i < weakSprites.length; i++) {
      const glow = weakSprites[i]
      glow.setVisible(i < spots)
      if (i >= spots) continue
      placeWeakSpot(i)
      glow.setPosition(weakSpot.x, weakSpot.y)
      glow.setScale(weakScale * (1 + 0.18 * Math.sin(now / 160 + i)))
    }

    const dizzy = staggerMs > 0
    for (let i = 0; i < dizzySprites.length; i++) {
      const star = dizzySprites[i]
      star.setVisible(dizzy)
      if (!dizzy) continue
      const angle = now / 260 + (i * Math.PI * 2) / dizzySprites.length
      star.setPosition(body.x + Math.cos(angle) * 22, y - height - 6 + Math.sin(angle) * 6)
    }

    if (tellText) tellText.setPosition(body.x, y - height - (dizzy ? 20 : 8)).setAlpha(Math.min(1, tellMs / 300))
    telegraphs.update(now)
  }

  function paintTint(target: Phaser.GameObjects.Sprite, tint: number) {
    if (tint === 1) target.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL)
    else if (tint === 2) target.setTint(SLOWED_TINT).setTintMode(Phaser.TintModes.MULTIPLY)
    else target.clearTint()
  }

  function destroy() {
    if (destroyed) return
    destroyed = true
    interrupt(true)
    scene.events.off('postupdate', render)
    scene.events.off('shutdown', destroy)
    adds.destroy()
    tellPool.destroy()
    telegraphs.destroy()
    combat.unregister(self)
    sprite.destroy()
    for (const limb of limbs) limb.sprite.destroy()
    for (const s of weakSprites) s.destroy()
    for (const s of dizzySprites) s.destroy()
    deathFx?.destroy()
    listeners.clear()
  }

  combat.register(self)
  scene.events.on('postupdate', render)
  scene.events.once('shutdown', destroy)
  return self
}
