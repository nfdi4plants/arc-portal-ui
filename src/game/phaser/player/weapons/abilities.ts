import type Phaser from 'phaser'
import type { Combatant, SlowZone, StatusEffect } from '../../../contracts/combat'
import { DEPTH, PALETTE, TILE } from '../../../contracts/constants'
import { createBossCharge } from '../../../model/progression/charge'
import { cssColor } from '../../color'
import type { Core } from './core'
import { createMark, inCone, nearestAhead, opposingTeam } from './helpers'
import type { Point } from './helpers'
import type { AbilityFeature } from './mechanics'

// The ability cards that do their work when pressed: Centrifuge Spin, Fume Hood, Sample Freeze,
// Citation Needed, Autoclave, Second Wind, Peer Pressure and Lab Coat. Hits that pull or push go
// through the loadout's stand-in attacker as knockback, so bosses, turrets and boss minions, which
// ignore knockback, are never moved. Freezes and slows go through Combatant.applyStatus, which
// turns a freeze into a slow on a boss.

const FROST = 0xbfe9ff
// Height of the mage's middle over the feet.
const MIDDLE = 22

// The middle of a combatant's hurtbox, written into `out`, so a loop over enemies allocates nothing.
function middleOf(target: Combatant, out: Point): Point {
  const box = target.hurtbox()
  out.x = box.x + box.width / 2
  out.y = box.y + box.height / 2
  return out
}

// Half the larger side of the hurtbox, so a big body at the edge of a radius still counts.
function reachOf(target: Combatant): number {
  const box = target.hurtbox()
  return Math.max(box.width, box.height) / 2
}

// Alive and not invulnerable (a boss between phases, say).
const touchable = (enemy: Combatant) => !enemy.isDead() && !enemy.isInvulnerable()

const SPIN_MS = 600
const SPIN_HITS = 4
const SPIN_RADIUS = 4 * TILE
const SPIN_DAMAGE = 5
// The pull is a knockback towards the mage: this much per unit of distance, up to the cap. Mobs
// take half of a knockback, less when they are big.
const SPIN_PULL_PER_UNIT = 4
const SPIN_PULL_MAX = 380
const SPIN_STAGGER = 0.5
const SPIN_DISCS = 3
const SPIN_ORBIT = 26
const SPIN_COOLDOWN_MS = 8000

// Three discs whirl around the mage for 0.6 s. Four times in that span every enemy within 4 tiles
// takes a light hit that pulls it in.
export function createCentrifugeSpin(core: Core): AbilityFeature {
  const { scene, art, player } = core.deps
  const discs: Phaser.GameObjects.Sprite[] = []
  const middle = { x: 0, y: 0 }
  let spinMs = 0
  let hitsLeft = 0
  let nextHitMs = 0
  let angle = 0

  const whirl = () => {
    const feet = player.position()
    const cx = feet.x
    const cy = feet.y - MIDDLE
    const damage = SPIN_DAMAGE * core.damage.multiplier
    for (const enemy of core.deps.enemies()) {
      if (!touchable(enemy)) continue
      middleOf(enemy, middle)
      const dx = middle.x - cx
      const distance = Math.hypot(dx, middle.y - cy)
      if (distance - reachOf(enemy) > SPIN_RADIUS) continue
      const { width, height } = enemy.hurtbox()
      // A positive knockback pushes the way the stand-in faces, so facing the enemy and pushing
      // backwards pulls it towards the mage.
      const pull = Math.min(SPIN_PULL_MAX, distance * SPIN_PULL_PER_UNIT)
      core.extra.box({
        cx: middle.x,
        cy: middle.y,
        w: width + 8,
        h: height + 8,
        face: dx >= 0 ? 1 : -1,
        damage,
        knockback: { x: -pull, y: -40 },
        tags: ['extra', 'spin'],
        stagger: SPIN_STAGGER,
      })
    }
  }

  const stop = () => {
    spinMs = 0
    hitsLeft = 0
    for (const disc of discs) disc.setVisible(false)
  }

  return {
    handler: {
      cooldownMs: SPIN_COOLDOWN_MS,
      activate() {
        if (discs.length === 0) {
          const ref = art.projectile(scene, 'disc')
          for (let i = 0; i < SPIN_DISCS; i++) {
            const disc = scene.add.sprite(0, 0, ref.textureKey).setDepth(DEPTH.player + 1).setScale(1 / art.pixelsPerUnit)
            if (scene.anims.exists(ref.animKey)) disc.play(ref.animKey)
            discs.push(disc)
          }
          core.own(() => {
            for (const disc of discs) disc.destroy()
          })
        }
        for (const disc of discs) disc.setVisible(true)
        spinMs = SPIN_MS
        hitsLeft = SPIN_HITS
        nextHitMs = 0
        const feet = player.position()
        core.fx.burst(feet.x, feet.y - 4, 'dust', 1.6)
      },
    },
    sync() {
      if (!core.flags.centrifugeSpin) stop()
    },
    update(dtMs) {
      if (spinMs <= 0) return
      angle += dtMs * 0.03
      nextHitMs -= dtMs
      while (hitsLeft > 0 && nextHitMs <= 0) {
        whirl()
        hitsLeft--
        nextHitMs += SPIN_MS / SPIN_HITS
      }
      spinMs -= dtMs
      if (spinMs <= 0) stop()
    },
    render() {
      if (spinMs <= 0) return
      const mage = player.gameObject
      for (let i = 0; i < discs.length; i++) {
        const a = angle + (i * Math.PI * 2) / discs.length
        discs[i].setPosition(mage.x + Math.cos(a) * SPIN_ORBIT, mage.y - MIDDLE + Math.sin(a) * SPIN_ORBIT * 0.45)
      }
    },
  }
}

const HOOD_MS = 4000
const HOOD_W = 5 * TILE
const HOOD_H = 4 * TILE
// The near edge of the hood sits this far behind the mage's middle, so shots that reach the mage
// pass through it.
const HOOD_OVERLAP = 8
const HOOD_SHOT_FACTOR = 0.3
// Mobs inside get this slow every pulse. It outlasts the pulse a little, so it fades just after
// a mob leaves the hood.
const HOOD_SLOW: StatusEffect = { kind: 'slow', ms: 300, factor: 0.7 }
const HOOD_PULSE_MS = 200
const HOOD_PUFF_MS = 320
// Where the fume puffs rise, as shares of the hood's width and height, in turn.
const HOOD_PUFFS: readonly Point[] = [
  { x: 0.25, y: 0.7 },
  { x: 0.7, y: 0.45 },
  { x: 0.45, y: 0.85 },
  { x: 0.8, y: 0.75 },
  { x: 0.15, y: 0.4 },
]
const HOOD_COOLDOWN_MS = 12000

// A fume hood in front of the mage for 4 s. Enemy shots inside fly at 30% speed (a slow zone of
// the combat world) and enemies inside are slowed to 70%. Pressing again later moves it.
export function createFumeHood(core: Core): AbilityFeature {
  const { scene, combat, player } = core.deps
  const zone: SlowZone = { x: 0, y: 0, w: HOOD_W, h: HOOD_H, factor: HOOD_SHOT_FACTOR, team: player.team }
  const middle = { x: 0, y: 0 }
  let removeZone: (() => void) | null = null
  let hood: Phaser.GameObjects.Graphics | null = null
  let leftMs = 0
  let pulseMs = 0
  let puffMs = 0
  let puff = 0

  // Drawn once at the origin and moved to each new spot. Two offset outlines read as hand drawn.
  const hoodGraphics = () => {
    if (hood) return hood
    const g = scene.add.graphics().setDepth(DEPTH.fx - 1)
    g.fillStyle(PALETTE.teal, 0.12).fillRect(0, 0, HOOD_W, HOOD_H)
    g.lineStyle(1.5, PALETTE.teal, 0.8).strokeRect(0, 0, HOOD_W, HOOD_H)
    g.lineStyle(1, PALETTE.teal, 0.45).strokeRect(1.5, -1, HOOD_W - 2, HOOD_H + 1.5)
    // The sash across the top.
    g.fillStyle(PALETTE.teal, 0.5).fillRect(0, 0, HOOD_W, 5)
    hood = g
    core.own(() => g.destroy())
    return g
  }

  const close = () => {
    leftMs = 0
    removeZone?.()
    removeZone = null
    hood?.setVisible(false)
  }
  core.own(() => removeZone?.())

  return {
    handler: {
      cooldownMs: HOOD_COOLDOWN_MS,
      activate() {
        const feet = player.position()
        const face = player.facing()
        zone.x = face === 1 ? feet.x - HOOD_OVERLAP : feet.x + HOOD_OVERLAP - HOOD_W
        zone.y = feet.y - HOOD_H
        removeZone ??= combat.addSlowZone(zone)
        hoodGraphics().setPosition(zone.x, zone.y).setVisible(true)
        leftMs = HOOD_MS
        pulseMs = 0
        puffMs = 0
      },
    },
    sync() {
      if (!core.flags.fumeHood) close()
    },
    update(dtMs) {
      if (leftMs <= 0) return
      leftMs -= dtMs
      if (leftMs <= 0) {
        close()
        return
      }
      pulseMs -= dtMs
      if (pulseMs <= 0) {
        pulseMs += HOOD_PULSE_MS
        for (const enemy of core.deps.enemies()) {
          if (!touchable(enemy)) continue
          middleOf(enemy, middle)
          if (middle.x < zone.x || middle.x > zone.x + zone.w || middle.y < zone.y || middle.y > zone.y + zone.h) continue
          enemy.applyStatus?.(HOOD_SLOW)
        }
      }
      puffMs -= dtMs
      if (puffMs <= 0) {
        puffMs += HOOD_PUFF_MS
        const spot = HOOD_PUFFS[puff]
        puff = (puff + 1) % HOOD_PUFFS.length
        core.fx.burst(zone.x + spot.x * zone.w, zone.y + spot.y * zone.h, 'dust', 1.3, PALETTE.teal)
      }
    },
  }
}

const FREEZE: StatusEffect = { kind: 'freeze', ms: 1500 }
const FREEZE_RANGE = 6 * TILE
const FREEZE_HALF_ANGLE = 0.6
const FREEZE_COOLDOWN_MS = 14000

// A short cone of frost in front of the mage. Mobs, minions, turrets and boss minions inside freeze
// for 1.5 s. A boss only runs at half speed for that long (combat/status.ts).
export function createSampleFreeze(core: Core): AbilityFeature {
  const { player } = core.deps
  const origin = { x: 0, y: 0 }
  const middle = { x: 0, y: 0 }

  return {
    handler: {
      cooldownMs: FREEZE_COOLDOWN_MS,
      activate() {
        const feet = player.position()
        const face = player.facing()
        origin.x = feet.x
        origin.y = feet.y - MIDDLE
        for (const enemy of core.deps.enemies()) {
          if (!touchable(enemy)) continue
          if (inCone(origin, face, middleOf(enemy, middle), FREEZE_RANGE, FREEZE_HALF_ANGLE, reachOf(enemy))) enemy.applyStatus?.(FREEZE)
        }
        // Frost puffs that widen along the cone.
        for (let i = 1; i <= 4; i++) {
          const ahead = (FREEZE_RANGE * i) / 4
          const spread = ahead * Math.tan(FREEZE_HALF_ANGLE) * 0.5
          core.fx.burst(origin.x + face * ahead, origin.y + (i % 2 === 0 ? spread : -spread), 'hit', 0.8 + 0.3 * i, FROST)
        }
      },
    },
    sync() {},
    update() {},
  }
}

const MARK_MS = 6000
const MARK_SHARE = 0.3
const MARK_RANGE = 13 * TILE
const MARK_COOLDOWN_MS = 10000

// Marks the nearest enemy ahead for 6 s. Every hit of the mage's own attacks and shots on it adds a
// bonus hit of 30% of its damage. The bonus belongs to the stand-in, so it never counts as a hit of
// its own. A press with no enemy in reach does nothing and starts no cooldown.
export function createCitationNeeded(core: Core): AbilityFeature {
  const { scene, combat, player } = core.deps
  const mark = createMark<Combatant>(MARK_SHARE)
  const middle = { x: 0, y: 0 }
  let label: Phaser.GameObjects.Text | null = null

  const showLabel = () => {
    if (label) return label
    label = scene.add
      .text(0, 0, '[citation needed]', { fontFamily: 'sans-serif', fontStyle: 'bold', fontSize: '7px', color: cssColor(PALETTE.blue), stroke: cssColor(PALETTE.outline), strokeThickness: 2 })
      .setResolution(Math.max(2, Math.ceil(scene.cameras.main.zoom)))
      .setOrigin(0.5, 1)
      .setDepth(DEPTH.fx)
    const text = label
    core.own(() => text.destroy())
    return text
  }

  core.own(
    combat.on('hit', (event) => {
      if (!core.flags.citationNeeded || event.attacker !== player || event.target.isDead()) return
      const bonus = mark.bonus(event.target, event.damage)
      if (bonus <= 0) return
      middleOf(event.target, middle)
      core.extra.box({ cx: middle.x, cy: middle.y, w: 10, h: 10, face: player.facing(), damage: bonus, tags: ['extra', 'citation'], activeMs: 50 })
    }),
  )

  return {
    handler: {
      cooldownMs: MARK_COOLDOWN_MS,
      activate() {
        const feet = player.position()
        const target = nearestAhead(feet, player.facing(), core.deps.enemies(), MARK_RANGE)
        if (!target || target.isInvulnerable()) return false
        mark.set(target, MARK_MS)
        showLabel().setVisible(true)
        middleOf(target, middle)
        core.fx.line(feet.x, feet.y - MIDDLE, middle.x, middle.y, 260)
        core.fx.burst(middle.x, middle.y, 'levelUp', 0.8)
        return true
      },
    },
    sync() {
      if (core.flags.citationNeeded) return
      mark.clear()
      label?.setVisible(false)
    },
    update(dtMs) {
      mark.tick(dtMs)
      if (mark.target()?.isDead()) mark.clear()
    },
    render() {
      if (!label) return
      const target = mark.target()
      label.setVisible(target !== null)
      if (!target) return
      const box = target.hurtbox()
      label.setPosition(box.x + box.width / 2, box.y - 3)
    },
  }
}

const AUTOCLAVE_RADIUS = 3 * TILE
const AUTOCLAVE_DAMAGE = 8
const AUTOCLAVE_BLOCK_MS = 400
const AUTOCLAVE_COOLDOWN_MS = 16000

// A burst of steam. Hits miss the mage for 0.4 s, and every enemy within 3 tiles takes a heavy
// knock away from the mage. The burst adds nothing to a boss stagger bar.
export function createAutoclave(core: Core): AbilityFeature {
  const { player } = core.deps
  const middle = { x: 0, y: 0 }

  return {
    handler: {
      cooldownMs: AUTOCLAVE_COOLDOWN_MS,
      activate() {
        player.blockHits(AUTOCLAVE_BLOCK_MS)
        const feet = player.position()
        const cx = feet.x
        const cy = feet.y - MIDDLE
        const damage = AUTOCLAVE_DAMAGE * core.damage.multiplier
        for (const enemy of core.deps.enemies()) {
          if (!touchable(enemy)) continue
          middleOf(enemy, middle)
          const dx = middle.x - cx
          if (Math.hypot(dx, middle.y - cy) - reachOf(enemy) > AUTOCLAVE_RADIUS) continue
          const { width, height } = enemy.hurtbox()
          core.extra.box({
            cx: middle.x,
            cy: middle.y,
            w: width + 8,
            h: height + 8,
            face: dx >= 0 ? 1 : -1,
            damage,
            knockback: { x: 320, y: -200 },
            tags: ['extra', 'heavy', 'autoclave'],
            stagger: 0,
          })
        }
        core.fx.burst(cx, cy, 'crit', 2.4, PALETTE.cream)
        for (let i = 0; i < 4; i++) core.fx.burst(cx + (i - 1.5) * 18, feet.y - 6 - (i % 2) * 10, 'dust', 1.2)
      },
    },
    sync() {},
    update() {},
  }
}

const SECOND_WIND_SHARE = 0.5

export type SecondWindFeature = AbilityFeature & { charged(): boolean }

// Heals half of max hp once. The charge comes from the run director and recharges when a boss
// falls and before the final boss. At full hp the press does nothing and keeps the charge.
export function createSecondWind(core: Core): SecondWindFeature {
  const { player } = core.deps
  const ownCharge = core.deps.secondWind === undefined
  const charge = core.deps.secondWind ?? createBossCharge()

  return {
    handler: {
      cooldownMs: 0,
      activate() {
        const maxHp = core.build.stats.maxHp
        if (!core.flags.secondWind || player.isDead() || player.hp() >= maxHp || !charge.spend()) return false
        player.heal(Math.round(maxHp * SECOND_WIND_SHARE))
        const feet = player.position()
        core.fx.burst(feet.x, feet.y - MIDDLE, 'levelUp', 1.4)
        return true
      },
    },
    charged: () => core.flags.secondWind && charge.ready(),
    sync() {},
    update() {},
    // A sandbox without a run recharges at every boss fight instead.
    resetFight() {
      if (ownCharge) charge.recharge()
    },
  }
}

const PRESSURE_DAMAGE = 40
const PRESSURE_STAGGER = 0.5
const PRESSURE_COOLDOWN_MS = 40000

// Every enemy on screen takes a heavy hit away from the mage, and the enemy shots on screen vanish.
export function createPeerPressure(core: Core): AbilityFeature {
  const { scene, combat, player } = core.deps
  const middle = { x: 0, y: 0 }
  const area = { x: 0, y: 0, w: 0, h: 0 }

  return {
    handler: {
      cooldownMs: PRESSURE_COOLDOWN_MS,
      activate() {
        const view = scene.cameras.main.worldView
        const feet = player.position()
        const damage = PRESSURE_DAMAGE * core.damage.multiplier
        for (const enemy of core.deps.enemies()) {
          if (!touchable(enemy)) continue
          middleOf(enemy, middle)
          if (!view.contains(middle.x, middle.y)) continue
          const { width, height } = enemy.hurtbox()
          core.extra.box({
            cx: middle.x,
            cy: middle.y,
            w: width + 8,
            h: height + 8,
            face: middle.x >= feet.x ? 1 : -1,
            damage,
            knockback: { x: 260, y: -220 },
            tags: ['extra', 'heavy', 'pressure'],
            stagger: PRESSURE_STAGGER,
          })
          core.fx.burst(middle.x, middle.y, 'crit', 1.4)
        }
        area.x = view.x
        area.y = view.y
        area.w = view.width
        area.h = view.height
        combat.cancelShots(opposingTeam(player.team), area)
        core.fx.burst(feet.x, feet.y - MIDDLE, 'levelUp', 3)
        scene.cameras.main.shake(140, 0.004)
      },
    },
    sync() {},
    update() {},
  }
}

const COAT_MS = 280
// About 10 tiles over the dash.
const COAT_SPEED = 860
const COAT_BLOCK_MS = 450
const COAT_DAMAGE = 30
const COAT_PUFF_MS = 60
const COAT_COOLDOWN_MS = 30000

// A super-dash the way the mage holds (or faces). Hits miss the mage for 0.45 s, and a hitbox on
// the mage hits every enemy on the way. It is the mage's own heavy hit, so damage bonuses, crits,
// lifesteal and the Ontology apply.
export function createLabCoat(core: Core): AbilityFeature {
  const { combat, player } = core.deps
  const start = { x: 0, y: 0 }
  let leftMs = 0
  let puffMs = 0
  let dir: 1 | -1 = 1

  return {
    handler: {
      cooldownMs: COAT_COOLDOWN_MS,
      activate(ctx) {
        const left = ctx.held.has('left')
        const right = ctx.held.has('right')
        dir = left !== right ? (right ? 1 : -1) : player.facing()
        leftMs = COAT_MS
        puffMs = 0
        const feet = player.position()
        start.x = feet.x
        start.y = feet.y
        player.blockHits(COAT_BLOCK_MS)
        player.setVelocity(dir * COAT_SPEED, 0)
        combat.spawnHitbox({
          owner: player,
          shape: { kind: 'rect', x: -18, y: -46, w: 36, h: 48 },
          follow: true,
          activeMs: COAT_MS,
          damage: COAT_DAMAGE,
          knockback: { x: 240, y: -200 },
          hitStopMs: 30,
          maxTargets: Infinity,
          tags: ['heavy', 'labCoat'],
        })
      },
    },
    sync() {
      if (!core.flags.labCoat) leftMs = 0
    },
    // The loadout steps before the player, so the dash speed holds against the motor's friction
    // and gravity until the dash ends.
    update(dtMs) {
      if (leftMs <= 0) return
      leftMs -= dtMs
      const feet = player.position()
      if (leftMs <= 0) {
        player.setVelocity(dir * COAT_SPEED * 0.25, 0)
        core.fx.line(start.x, start.y - MIDDLE, feet.x, feet.y - MIDDLE, 300)
        return
      }
      player.setVelocity(dir * COAT_SPEED, 0)
      puffMs -= dtMs
      if (puffMs > 0) return
      puffMs += COAT_PUFF_MS
      core.fx.burst(feet.x, feet.y - 8, 'dust', 1)
    },
  }
}
