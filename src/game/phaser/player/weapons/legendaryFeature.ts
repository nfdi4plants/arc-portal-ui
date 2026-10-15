import type Phaser from 'phaser'
import type { Combatant } from '../../../contracts/combat'
import { DEPTH } from '../../../contracts/constants'
import type { PlayerBuild } from '../../../contracts/progression'
import { applySpriteRef, ISA_BLOCKS, isaBlockArt, type IsaKind } from '../../art'
import { markOneWay } from '../oneWay'
import type { Core, Feature } from './core'
import { centerOf, opposingTeam } from './helpers'
import { bindBuilder } from './kit'
import { PUBLISH, PUBLISH_TAG, publishedBy, unpublish } from './legendaryMoves'

// The loadout side of the legendary weapons (legendaryMoves.ts): the ISA blocks ARCitect drops,
// the shattering of a statue the Publication Press published, and the seals over the statues. The
// blocks, their sprites and the seals come from small fixed pools.

const BLOCK_LIMIT = 3
const BLOCK_MS = 4000
const BLOCK_FADE_MS = 500
// How far above the feet a block may still find its floor (a step up), and how far below.
const FLOOR_ABOVE = 30
const FLOOR_BELOW = 260
const SEALS = 8

interface Block {
  body: Phaser.Physics.Arcade.StaticBody | null
  removeCollider: (() => void) | null
  sprite: Phaser.GameObjects.Sprite | null
  leftMs: number
  // The block in world units, for the shots it stops.
  area: { x: number; y: number; w: number; h: number }
}

export function createLegendaryWeapons(core: Core): Feature {
  const { combat, player, art, scene } = core.deps
  const blocks: Block[] = Array.from({ length: BLOCK_LIMIT }, () => ({ body: null, removeCollider: null, sprite: null, leftMs: 0, area: { x: 0, y: 0, w: 0, h: 0 } }))
  let nextBlock = 0
  const seals: Phaser.GameObjects.Sprite[] = []
  let sealsShown = 0
  // The statues this wielder published. Pruned once they thaw or shatter.
  const statues: Combatant[] = []
  let builder = false
  let press = false

  const clearBlock = (block: Block) => {
    block.leftMs = 0
    block.removeCollider?.()
    block.removeCollider = null
    block.body?.destroy()
    block.body = null
    block.sprite?.setVisible(false)
  }

  // The top of the nearest floor at x, from a little above the feet down. Blocks count, so a block
  // dropped on a block stacks. Called once per drop, never per step.
  const floorAt = (x: number, fromY: number): number | null => {
    let best: number | null = null
    for (const body of scene.physics.overlapRect(x - 1, fromY - FLOOR_ABOVE, 2, FLOOR_ABOVE + FLOOR_BELOW, false, true)) {
      if (body.top >= fromY - FLOOR_ABOVE && (best === null || body.top < best)) best = body.top
    }
    return best
  }

  // The oldest block makes way for a fourth.
  const build = (kind: IsaKind, x: number, fromY: number): number | null => {
    const floor = floorAt(x, fromY)
    if (floor === null) return null
    const { w, h } = ISA_BLOCKS[kind]
    const block = blocks[nextBlock]
    nextBlock = (nextBlock + 1) % BLOCK_LIMIT
    clearBlock(block)
    const body = scene.physics.add.staticBody(x - w / 2, floor - h, w, h)
    markOneWay(body)
    block.body = body
    block.removeCollider = player.collideWith(body)
    const ref = isaBlockArt(scene, kind)
    block.sprite ??= scene.add.sprite(0, 0, ref.textureKey).setDepth(DEPTH.tiles + 2)
    applySpriteRef(block.sprite, ref)
    block.sprite.setPosition(x, floor).setAlpha(1).setVisible(true)
    block.leftMs = BLOCK_MS
    block.area.x = x - w / 2
    block.area.y = floor - h
    block.area.w = w
    block.area.h = h
    return floor
  }

  core.own(bindBuilder(player, (kind, x, fromY) => (builder ? build(kind, x, fromY) : null)))
  core.own(() => {
    for (const block of blocks) {
      clearBlock(block)
      block.sprite?.destroy()
    }
    for (const seal of seals) seal.destroy()
  })

  core.own(
    combat.on('hit', (event) => {
      if (!press || event.attacker !== player) return
      const target = event.target
      // The slam that publishes does not shatter its own statues.
      if (event.tags.includes(PUBLISH_TAG) || publishedBy(target) !== player) return
      unpublish(target)
      const middle = centerOf(target)
      const box = target.hurtbox()
      const damage = event.damage * PUBLISH.shatterShare + PUBLISH.shatterFlat
      core.extra.box({ cx: middle.x, cy: middle.y, w: box.width + 6, h: box.height + 6, face: player.facing(), damage, tags: ['extra', 'shatter'], stagger: 0.5, hitStopMs: 60 })
      core.fx.burst(middle.x, middle.y, 'crit', 1.6)
    }),
  )

  const findStatues = () => {
    let kept = 0
    for (const target of statues) if (!target.isDead() && publishedBy(target) === player) statues[kept++] = target
    statues.length = kept
    for (const enemy of core.deps.enemies()) {
      if (statues.length >= SEALS) return
      if (publishedBy(enemy) === player && !statues.includes(enemy)) statues.push(enemy)
    }
  }

  return {
    sync(build: PlayerBuild) {
      builder = build.weapons.light.id === 'arcitect'
      press = build.weapons.heavy.id === 'publicationPress'
      // The art is drawn now, so the first swing does not stall the frame.
      if (builder) for (const kind of Object.keys(ISA_BLOCKS) as IsaKind[]) isaBlockArt(scene, kind)
      if (press) art.projectile(scene, 'seal')
      if (build.weapons.light.id === 'arcCommander') art.projectile(scene, 'command')
      if (build.weapons.heavy.id === 'gitLfs') art.projectile(scene, 'file')
      if (!builder) for (const block of blocks) clearBlock(block)
    },
    update(dtMs) {
      const enemyTeam = opposingTeam(player.team)
      for (const block of blocks) {
        if (block.leftMs <= 0) continue
        block.leftMs -= dtMs
        if (block.leftMs <= 0) {
          clearBlock(block)
          continue
        }
        // Enemy shots stop at a standing block.
        combat.cancelShots(enemyTeam, block.area)
        if (block.leftMs < BLOCK_FADE_MS) block.sprite?.setAlpha(0.3 + (0.7 * block.leftMs) / BLOCK_FADE_MS)
      }
      if (press) findStatues()
      else statues.length = 0
    },
    render() {
      for (let i = 0; i < statues.length; i++) {
        if (i >= seals.length) {
          const ref = art.projectile(scene, 'seal')
          const seal = scene.add.sprite(0, 0, ref.textureKey).setDepth(DEPTH.fx - 1)
          applySpriteRef(seal, ref)
          seals.push(seal)
        }
        const box = statues[i].hurtbox()
        seals[i].setPosition(box.x + box.width / 2, box.y - 3).setVisible(true)
      }
      for (let i = statues.length; i < sealsShown; i++) seals[i].setVisible(false)
      sealsShown = statues.length
    },
  }
}
