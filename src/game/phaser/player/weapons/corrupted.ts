import type Phaser from 'phaser'
import { TILE } from '../../../contracts/constants'
import type { Combatant } from '../../../contracts/combat'
import { MOTOR } from '../../../model/input/motor'
import {
  CORRUPTION,
  DATENKRAKE_LINES,
  corruptionFlags,
  createHitMemory,
  createLinePicker,
  incomingFactor,
  outgoingFactor,
  type CorruptionFlags,
} from '../../../model/progression'
import { acquireBubble, releaseBubble } from '../../mobs/bubbles'
import type { Core, Feature } from './core'
import type { DamageCorruption } from './helpers'

// The runtime parts of the corrupted augments the Datenkrake hands out. The stat parts are in the
// build already (applyCorrupted), the jump and air dash rules in the motor, the mirrored controls
// in the player and the fragments in the run director. Here: the damage factors, the Shadow IT
// dash, the Data Lake heal, the Blockchain chain and its HP cost, the Mirror Site thorns and the
// cookie banner, plus a speech bubble over the mage for the stuns.

const CHAIN_RANGE = CORRUPTION.blockchain.rangeTiles * TILE
const BUBBLE_MS = 1800
const BUBBLE_WRAP = 140

export type CorruptionFeature = Feature & {
  readonly damage: DamageCorruption
  // Terms of Service: the mage reads the EULA after a level-up card.
  readEula(): void
}

export function createCorruption(core: Core): CorruptionFeature {
  const { deps } = core
  const { player, combat, scene } = deps
  let flags: CorruptionFlags = corruptionFlags(core.build)
  const memory = createHitMemory()
  const lines = deps.rng.fork('corrupted-lines')
  const eulaLine = createLinePicker(DATENKRAKE_LINES.eula, lines.fork('eula'))
  const cookieLine = createLinePicker(DATENKRAKE_LINES.cookie, lines.fork('cookie'))
  let cookieMs = 0
  let lastX = Number.NaN
  let bubble: Phaser.GameObjects.Text | null = null
  let bubbleMs = 0

  const say = (line: string) => {
    bubble ??= acquireBubble(scene).setWordWrapWidth(BUBBLE_WRAP, true).setAlign('center')
    bubble.setText(line).setVisible(true)
    bubbleMs = BUBBLE_MS
  }

  const damage: DamageCorruption = {
    outgoing: (tags, target) => outgoingFactor(flags, tags, target, memory),
    incoming: () => incomingFactor(flags),
  }

  // The two nearest living enemies other than `source`, without a list.
  const chain = (source: Combatant, amount: number) => {
    const from = source.hurtbox()
    const fx = from.centerX
    const fy = from.centerY
    let first: Combatant | null = null
    let second: Combatant | null = null
    let firstSq = CHAIN_RANGE * CHAIN_RANGE
    let secondSq = firstSq
    for (const enemy of deps.enemies()) {
      if (enemy === source || enemy.isDead()) continue
      const box = enemy.hurtbox()
      const dx = box.centerX - fx
      const dy = box.centerY - fy
      const sq = dx * dx + dy * dy
      if (sq < firstSq) {
        second = first
        secondSq = firstSq
        first = enemy
        firstSq = sq
      } else if (sq < secondSq) {
        second = enemy
        secondSq = sq
      }
    }
    if (first) link(first, amount)
    if (second) link(second, amount)
  }
  const link = (target: Combatant, amount: number) => {
    const box = target.hurtbox()
    core.extra.box({ cx: box.centerX, cy: box.centerY, w: box.width, h: box.height, face: player.facing(), damage: amount, tags: ['extra', 'chain'] })
    core.fx.burst(box.centerX, box.centerY, 'hit')
  }

  core.own(
    combat.on('hit', (event) => {
      if (!flags.blockchain || event.attacker !== player || event.damage <= 0) return
      chain(event.target, event.damage * CORRUPTION.blockchain.share)
    }),
  )
  // Proof of work: an attack costs HP, but never the last one.
  core.own(
    player.on('attackStarted', () => {
      if (!flags.blockchain) return
      const cost = Math.min(CORRUPTION.blockchain.hpPerAttack, player.hp() - 1)
      if (cost > 0) player.heal(-cost)
    }),
  )
  core.own(
    player.on('dashed', () => {
      if (!flags.shadowIt) return
      combat.spawnHitbox({
        owner: player,
        shape: { kind: 'rect', x: -22, y: -48, w: 44, h: 50 },
        follow: true,
        activeMs: MOTOR.dashMs,
        damage: CORRUPTION.shadowIt.dashDamage,
        knockback: { x: 120, y: -80 },
        hitStopMs: 0,
        maxTargets: Infinity,
        tags: ['dash', 'shadowIt'],
      })
    }),
  )
  core.own(
    player.on('damaged', ({ hit }) => {
      const attacker = hit.attacker
      if (!flags.mirrorSite || attacker.team === player.team || attacker.isDead() || hit.damage <= 0) return
      const box = attacker.hurtbox()
      const damageBack = hit.damage * CORRUPTION.mirrorSite.thorns
      core.extra.box({ cx: box.centerX, cy: box.centerY, w: box.width, h: box.height, face: player.facing(), damage: damageBack, tags: ['extra', 'thorns'] })
      core.fx.burst(box.centerX, box.centerY, 'hit')
    }),
  )
  core.own(() => {
    if (bubble) releaseBubble(scene, bubble)
    bubble = null
  })

  return {
    damage,
    readEula() {
      if (!flags.termsOfService) return
      player.stun(CORRUPTION.termsOfService.stunMs)
      say(eulaLine())
    },
    sync(build) {
      flags = corruptionFlags(build)
    },
    update(dtMs) {
      if (bubbleMs > 0) {
        bubbleMs -= dtMs
        if (bubbleMs <= 0) bubble?.setVisible(false)
      }
      const box = player.hurtbox()
      // Data Lake: standing still on the ground refills.
      if (flags.dataLake && player.isGrounded() && Math.abs(box.x - lastX) < 0.05 && player.hp() > 0) {
        player.heal((core.build.stats.maxHp * CORRUPTION.dataLake.healPerSecond * dtMs) / 1000)
      }
      lastX = box.x
      if (flags.acceptAllCookies) {
        cookieMs += dtMs
        if (cookieMs >= CORRUPTION.acceptAllCookies.everyMs) {
          cookieMs = 0
          player.stun(CORRUPTION.acceptAllCookies.stunMs)
          say(cookieLine())
        }
      }
    },
    render() {
      if (!bubble || bubbleMs <= 0) return
      const box = player.hurtbox()
      bubble.setPosition(box.centerX, box.y - 6)
    },
  }
}
