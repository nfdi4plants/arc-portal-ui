import type Phaser from 'phaser'
import { DEPTH, PALETTE } from '../../../contracts/constants'
import type { AbilityHandler } from '../../../contracts/player'
import type { Core, Feature } from './core'
import { centerOf, nearestLiving } from './helpers'

// Combat effects of the mechanic cards that act through hits and abilities. The motion mechanics
// (double jump, air dash, wall jump, hat glide) live in the player motor.

export type AbilityFeature = Feature & { handler: AbilityHandler }

const ECHO_DELAY_MS = 150
const ECHO_SHARE = 0.5

// Every light hit repeats once, 150 ms later at half the damage, on the area the target stood in.
export function createEcho(core: Core): Feature {
  const { combat } = core.deps
  const { player } = core.deps
  core.own(
    combat.on('hit', (event) => {
      if (!core.flags.echoStrike || event.attacker !== player || !event.tags.includes('light') || event.target.isDead()) return
      const hb = event.target.hurtbox()
      const cx = hb.x + hb.width / 2
      const cy = hb.y + hb.height / 2
      // A little larger than the target, because knockback moves it during the delay.
      const w = hb.width + 16
      const h = hb.height + 8
      const face = player.facing()
      const damage = event.damage * ECHO_SHARE
      const knockback = { x: event.knockback.x * face * ECHO_SHARE, y: event.knockback.y * ECHO_SHARE }
      core.scheduler.at(ECHO_DELAY_MS, () => core.extra.box({ cx, cy, w, h, face, damage, knockback, tags: ['extra', 'echo'] }))
    }),
  )
  return { sync() {}, update() {} }
}

const REFLECT_DASH_MS = 150

// While the dash lasts, a reflect hitbox rides on the player and turns enemy projectiles around.
export function createReflectDash(core: Core): Feature {
  const { combat, player } = core.deps
  core.own(
    player.on('dashed', () => {
      if (!core.flags.reflectDash) return
      combat.spawnHitbox({
        owner: player,
        shape: { kind: 'rect', x: -20, y: -48, w: 40, h: 52 },
        follow: true,
        activeMs: REFLECT_DASH_MS,
        damage: 0,
        knockback: { x: 0, y: 0 },
        hitStopMs: 0,
        maxTargets: 0,
        tags: ['reflect'],
      })
    }),
  )
  return { sync() {}, update() {} }
}

const PARRY_WINDOW_MS = 200
const PARRY_COOLDOWN_MS = 1500

// The ability opens a 200 ms window. A hit that lands inside it deals no damage and answers with
// a counter hitbox around the player.
//
// A shield would be the natural block, but the player has no call to withdraw one, so a shield
// granted for a missed parry would stay. The loadout undoes the hit after it lands. A lethal hit
// goes through the lethal interceptor and is cancelled outright. A smaller hit is refunded in the
// 'damaged' event (heal by the damage, knockback cleared). The player still staggers for the short
// flinch and keeps the invulnerability frames that follow any hit.
export function createParry(core: Core): AbilityFeature {
  const { combat, player } = core.deps
  let windowMs = 0

  const counter = () => {
    windowMs = 0
    const feet = player.position()
    combat.spawnHitbox({
      owner: player,
      shape: { kind: 'circle', x: 0, y: -22, r: 52 * core.build.stats.meleeRange },
      follow: true,
      activeMs: 120,
      damage: 22,
      knockback: { x: 280, y: -220 },
      hitStopMs: 70,
      maxTargets: Infinity,
      tags: ['heavy', 'counter'],
    })
    core.fx.burst(feet.x, feet.y - 24, 44, PALETTE.blue, 260)
  }

  core.own(
    player.on('damaged', ({ hit }) => {
      if (windowMs <= 0) return
      player.heal(hit.damage)
      player.setVelocity(0, 0)
      counter()
    }),
  )
  core.lethal.push(() => {
    if (windowMs <= 0) return false
    counter()
    return true
  })

  return {
    handler: {
      cooldownMs: PARRY_COOLDOWN_MS,
      activate() {
        windowMs = PARRY_WINDOW_MS
        const feet = player.position()
        core.fx.burst(feet.x, feet.y - 24, 26, PALETTE.cream, PARRY_WINDOW_MS)
      },
    },
    sync() {
      if (!core.flags.parry) windowMs = 0
    },
    update(dtMs) {
      if (windowMs > 0) windowMs = Math.max(0, windowMs - dtMs)
    },
  }
}

const FAMILIAR_INTERVAL_MS = 1200
const FAMILIAR_RETRY_MS = 200
const FAMILIAR_RANGE = 420
const FAMILIAR_DAMAGE = 6
const BURST_SHOTS = 5
const BURST_GAP_MS = 90

// A spark circles the mage and fires at the nearest enemy every 1.2 s. The ability sends a burst
// of five bolts. Without an enemy in range the timer waits, then fires as soon as one shows up.
export function createFamiliar(core: Core): AbilityFeature {
  const { scene, art, player } = core.deps
  let sprite: Phaser.GameObjects.Sprite | null = null
  let angle = 0
  let shotMs = FAMILIAR_INTERVAL_MS
  const spot = { x: 0, y: 0 }

  const place = () => {
    const mage = player.gameObject
    spot.x = mage.x + Math.cos(angle) * 26
    spot.y = mage.y - 40 + Math.sin(angle) * 8
  }

  // Returns false when nothing is in range. A burst shoots ahead of the mage in that case.
  const fire = (alwaysShoot: boolean): boolean => {
    const mage = player.gameObject
    const target = nearestLiving({ x: mage.x, y: mage.y }, core.deps.enemies(), FAMILIAR_RANGE)
    if (target) core.autoBolt(spot, centerOf(target), FAMILIAR_DAMAGE)
    else if (alwaysShoot) core.autoBolt(spot, { x: spot.x + player.facing() * 100, y: spot.y }, FAMILIAR_DAMAGE)
    return target !== null
  }

  const show = () => {
    if (sprite) return
    const ref = art.projectile(scene, 'orb')
    sprite = scene.add.sprite(0, 0, ref.textureKey).setDepth(DEPTH.player + 1).setScale(1.3 / art.pixelsPerUnit)
    if (scene.anims.exists(ref.animKey)) sprite.play(ref.animKey)
    core.own(() => sprite?.destroy())
  }

  return {
    handler: {
      cooldownMs: 6000,
      activate() {
        for (let i = 0; i < BURST_SHOTS; i++) core.scheduler.at(i * BURST_GAP_MS, () => fire(true))
      },
    },
    sync() {
      if (core.flags.familiar) show()
      sprite?.setVisible(core.flags.familiar)
    },
    update(dtMs) {
      if (!core.flags.familiar) return
      angle += dtMs * 0.003
      place()
      shotMs -= dtMs
      if (shotMs > 0) return
      shotMs = fire(false) ? FAMILIAR_INTERVAL_MS : FAMILIAR_RETRY_MS
    },
    render() {
      if (!core.flags.familiar || !sprite) return
      place()
      sprite.setPosition(spot.x, spot.y)
    },
  }
}
