import type Phaser from 'phaser'
import type { Combatant, HitboxSpec, ProjectileSpec } from '../../../contracts/combat'
import { DEPTH, MAGE_FRAME, MAGE_TEXTURE, PALETTE, PLAYER_HEIGHT } from '../../../contracts/constants'
import type { AbilityFeature } from './mechanics'
import type { Core, Feature } from './core'
import { centerOf, createRingBuffer, nearestLiving, pickChainTarget } from './helpers'
import type { Point } from './helpers'

// The Ontology: a hit tags the enemy. Every later hit on a tagged enemy adds half its damage as a
// second hit and passes 30% of the total to the nearest other tagged enemy within 160 units.
// Both extra hits belong to the loadout's stand-in attacker, so they neither tag nor chain.
const ONTOLOGY_BONUS = 0.5
const CHAIN_SHARE = 0.3
const CHAIN_RANGE = 160

export function createOntology(core: Core): Feature {
  const { combat, player } = core.deps
  const tagged = new WeakSet<Combatant>()

  const hitOn = (target: Combatant, damage: number, tags: string[]) => {
    const middle = centerOf(target)
    core.extra.box({ cx: middle.x, cy: middle.y, w: 10, h: 10, face: player.facing(), damage, tags, activeMs: 50 })
  }

  core.own(
    combat.on('hit', (event) => {
      if (!core.flags.theOntology || event.attacker !== player || event.target.team !== 'enemy') return
      const wasTagged = tagged.has(event.target)
      tagged.add(event.target)
      if (!wasTagged || event.target.isDead()) return
      const bonus = event.damage * ONTOLOGY_BONUS
      hitOn(event.target, bonus, ['extra', 'ontology'])
      const other = pickChainTarget(event.target, core.deps.enemies(), tagged, CHAIN_RANGE)
      if (!other) return
      hitOn(other, (event.damage + bonus) * CHAIN_SHARE, ['extra', 'chain'])
      const from = centerOf(event.target)
      const to = centerOf(other)
      core.fx.line(from.x, from.y, to.x, to.y, PALETTE.teal, 220)
    }),
  )
  return { sync() {}, update() {} }
}

const RECORD_MS = 100
const HISTORY_MS = 5000

export type GitRevertFeature = AbilityFeature & { charged(): boolean }

// Records position and hp every 100 ms into a ring that covers the last 5 s. One lethal hit per
// fight is cancelled: the player returns to the oldest snapshot and heals up to its hp (never
// below the current hp). The ability does the same on demand while the charge is available.
export function createGitRevert(core: Core): GitRevertFeature {
  const { player } = core.deps
  const history = createRingBuffer(HISTORY_MS / RECORD_MS + 1)
  let charged = true
  let enabled = false
  let recordMs = 0

  const record = () => {
    const feet = player.position()
    history.push(feet.x, feet.y, player.hp())
  }

  const rewind = (): boolean => {
    const snapshot = history.oldest()
    if (!snapshot) return false
    const { x, y, hp } = snapshot
    const from = player.position()
    charged = false
    player.teleport(x, y)
    if (hp > player.hp()) player.heal(hp - player.hp())
    history.clear()
    record()
    core.fx.line(from.x, from.y - 24, x, y - 24, PALETTE.teal, 420)
    core.fx.burst(from.x, from.y - 24, 30, PALETTE.cream, 300)
    core.fx.burst(x, y - 24, 36, PALETTE.blue, 420)
    return true
  }

  core.lethal.push(() => enabled && charged && rewind())

  return {
    handler: {
      cooldownMs: 0,
      activate() {
        if (enabled && charged) rewind()
      },
    },
    charged: () => enabled && charged,
    sync() {
      const on = core.flags.gitRevert
      if (on && !enabled) {
        charged = true
        history.clear()
        recordMs = 0
      }
      enabled = on
    },
    update(dtMs) {
      if (!enabled || player.isDead()) return
      recordMs += dtMs
      if (recordMs < RECORD_MS) return
      recordMs -= RECORD_MS
      record()
    },
    resetFight() {
      charged = true
      history.clear()
    },
  }
}

const LETTERS: readonly { letter: string; color: number }[] = [
  { letter: 'F', color: PALETTE.yellow },
  { letter: 'A', color: PALETTE.teal },
  { letter: 'I', color: PALETTE.blue },
  { letter: 'R', color: 0xe5484d },
]
const AUTO_BOLT_MS = 2000
const AUTO_BOLT_DAMAGE = 7
const AUTO_BOLT_RANGE = 420
const SHIELD_MS = 8000
const REGEN_MS = 1000
const ORBIT_RADIUS = 30

function cssColor(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`
}

// F is folded into the damage modifier by the loadout. A fires a bolt at the nearest enemy every
// 2 s. I grants one shield every 8 s when the player has none. R heals 1 hp per second.
export function createFairPrinciples(core: Core): Feature {
  const { scene, player } = core.deps
  let letters: Phaser.GameObjects.Text[] = []
  let angle = 0
  let boltMs = AUTO_BOLT_MS
  let shieldMs = SHIELD_MS
  let regenMs = 0
  const spot = { x: 0, y: 0 }

  const place = (index: number) => {
    const mage = player.gameObject
    const a = angle + (index * Math.PI) / 2
    spot.x = mage.x + Math.cos(a) * ORBIT_RADIUS
    spot.y = mage.y - 26 + Math.sin(a) * 12
  }

  const show = () => {
    if (letters.length > 0) return
    letters = LETTERS.map(({ letter, color }) =>
      scene.add
        .text(0, 0, letter, { fontFamily: 'sans-serif', fontStyle: 'bold', fontSize: '11px', color: cssColor(color), stroke: cssColor(PALETTE.outline), strokeThickness: 2 })
        .setResolution(Math.max(2, Math.ceil(scene.cameras.main.zoom)))
        .setOrigin(0.5)
        .setDepth(DEPTH.player + 1),
    )
    core.own(() => {
      for (const text of letters) text.destroy()
    })
  }

  return {
    sync() {
      if (core.flags.fairPrinciples) show()
      for (const text of letters) text.setVisible(core.flags.fairPrinciples)
    },
    update(dtMs) {
      if (!core.flags.fairPrinciples) return
      angle += dtMs * 0.002

      regenMs += dtMs
      if (regenMs >= REGEN_MS) {
        regenMs -= REGEN_MS
        player.heal(1)
      }

      shieldMs -= dtMs
      if (shieldMs <= 0) {
        shieldMs = SHIELD_MS
        if (player.shieldCount() === 0) player.grantShield()
      }

      boltMs -= dtMs
      if (boltMs > 0) return
      const mage = player.gameObject
      const target = nearestLiving({ x: mage.x, y: mage.y }, core.deps.enemies(), AUTO_BOLT_RANGE)
      // Without a target the timer retries soon, so the bolt leaves as soon as an enemy shows up.
      boltMs = target ? AUTO_BOLT_MS : 200
      if (!target) return
      place(1)
      core.autoBolt(spot, centerOf(target), AUTO_BOLT_DAMAGE)
    },
    render() {
      if (!core.flags.fairPrinciples) return
      for (let i = 0; i < letters.length; i++) {
        place(i)
        letters[i].setPosition(spot.x, spot.y)
      }
    },
  }
}

const REVIEW_HITS = 3
const REVIEW_REPLAY_MS = 400
const REVIEW_GAP_MS = 120
const REVIEW_VISIBLE_MS = REVIEW_REPLAY_MS + 3 * REVIEW_GAP_MS + 200
const REVIEWERS = 3

interface Recorded {
  box: HitboxSpec | null
  shot: ProjectileSpec | null
  // Where a projectile left, relative to the player's feet.
  dx: number
  dy: number
  face: 1 | -1
}

// Every third hit of the player summons a reviewer: a translucent mage that stands just ahead of
// the player and, 400 ms later, replays the last three hitbox or projectile specs the player's
// moves spawned (120 ms apart, at the reviewer's position, at the damage the player's stats give
// them). The replays belong to the stand-in attacker, so they do not count as hits.
export function createPeerReview(core: Core): Feature {
  const { scene, combat, player } = core.deps
  const recorded: Recorded[] = Array.from({ length: 3 }, () => ({ box: null, shot: null, dx: 0, dy: 0, face: 1 }))
  let next = 0
  let count = 0
  let hits = 0

  const images: Phaser.GameObjects.Image[] = []
  const visibleMs = new Float64Array(REVIEWERS)
  let nextImage = 0

  const record = (spec: HitboxSpec | ProjectileSpec, origin: Point | null) => {
    if (spec.damage <= 0) return
    const slot = recorded[next]
    next = (next + 1) % recorded.length
    count = Math.min(recorded.length, count + 1)
    const feet = player.position()
    if ('velocity' in spec && origin) {
      slot.shot = spec
      slot.box = null
      slot.dx = origin.x - feet.x
      slot.dy = origin.y - feet.y
    } else {
      slot.box = spec as HitboxSpec
      slot.shot = null
      slot.dx = 0
      slot.dy = 0
    }
    slot.face = player.facing()
  }

  const replay = (item: Recorded, x: number, y: number) => {
    const owner = core.extra.at(x, y, item.face)
    const multiplier = core.damage.multiplier
    if (item.shot) {
      const shot = item.shot
      combat.spawnProjectile(
        { ...shot, owner, damage: shot.damage * multiplier, tags: [...(shot.tags ?? []), 'extra', 'review'] },
        { x: x + item.dx, y: y + item.dy },
      )
    } else if (item.box) {
      const box = item.box
      combat.spawnHitbox({ ...box, owner, follow: false, damage: box.damage * multiplier, tags: [...(box.tags ?? []), 'extra', 'review'] })
    }
    core.fx.burst(x, y - 24, 20, PALETTE.blue, 200)
  }

  const summon = () => {
    if (count === 0) return
    if (images.length === 0) {
      const texture = scene.textures.get(MAGE_TEXTURE)
      const frame = texture.has(MAGE_FRAME) ? MAGE_FRAME : undefined
      for (let i = 0; i < REVIEWERS; i++) {
        images.push(scene.add.image(0, 0, MAGE_TEXTURE, frame).setOrigin(0.5, 1).setDepth(DEPTH.player - 1).setTint(PALETTE.blue).setVisible(false))
      }
      core.own(() => {
        for (const image of images) image.destroy()
      })
    }
    const feet = player.position()
    const face = player.facing()
    const x = feet.x + face * 18
    const y = feet.y
    const index = nextImage
    nextImage = (nextImage + 1) % REVIEWERS
    const image = images[index]
    const scale = PLAYER_HEIGHT / Math.max(1, image.height)
    image.setPosition(x, y).setScale(scale * face, scale).setAlpha(0.5).setVisible(true)
    visibleMs[index] = REVIEW_VISIBLE_MS
    // Oldest first, so the replay repeats the moves in the order they were played.
    for (let k = 0; k < count; k++) {
      const item = { ...recorded[(next - count + k + recorded.length) % recorded.length] }
      core.scheduler.at(REVIEW_REPLAY_MS + k * REVIEW_GAP_MS, () => replay(item, x, y))
    }
    core.fx.burst(x, y - 24, 24, PALETTE.blue, 240)
  }

  core.own(
    combat.on('hit', (event) => {
      if (!core.flags.peerReview || event.attacker !== player) return
      hits++
      if (hits < REVIEW_HITS) return
      hits = 0
      summon()
    }),
  )

  return {
    sync() {
      core.onPlayerSpec = core.flags.peerReview ? record : null
      if (!core.flags.peerReview) hits = 0
    },
    update(dtMs) {
      for (let i = 0; i < images.length; i++) {
        if (visibleMs[i] <= 0) continue
        visibleMs[i] -= dtMs
        if (visibleMs[i] <= 0) images[i].setVisible(false)
        else images[i].setAlpha(0.5 * Math.min(1, visibleMs[i] / 200))
      }
    },
  }
}
