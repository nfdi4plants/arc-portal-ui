// Throwaway stub for Part J. The real mobs module (Part H) replaces this file at merge.
import Phaser from 'phaser'
import type { ScribbleArt } from '../../contracts/art'
import type { Combatant, CombatWorld, HitEvent } from '../../contracts/combat'
import { DEPTH } from '../../contracts/constants'
import type { MonsterSpec } from '../../contracts/content'
import type { PlayerHandle } from '../../contracts/player'
import type { Rng } from '../../contracts/rng'
import { applySpriteRef } from '../art'

export interface MobDeps {
  combat: CombatWorld
  art: ScribbleArt
  player: PlayerHandle
  colliders: Phaser.Types.Physics.Arcade.ArcadeColliderType[]
  rng: Rng
}

export interface Mob extends Combatant {
  readonly spec: MonsterSpec
  update(dtMs: number): void
  setAsleep(asleep: boolean): void
  isGone(): boolean
  destroy(): void
}

const xpByMob = new WeakMap<Combatant, number>()

export function spawnMob(scene: Phaser.Scene, spec: MonsterSpec, deps: MobDeps, x: number, y: number): Mob {
  const ref = deps.art.monster(scene, spec)
  const image = scene.add.sprite(x, y, ref.textureKey).setDepth(DEPTH.enemies)
  applySpriteRef(image, ref)
  const box = new Phaser.Geom.Rectangle(x - ref.width / 2, y - ref.height, ref.width, ref.height)
  let hp = spec.stats.hp
  let asleep = false
  let gone = false
  const mob: Mob = {
    id: `mob:${spec.id}:${x}`,
    team: 'enemy',
    killer: { kind: 'mob', annotation: spec.source, label: spec.label },
    spec,
    hurtbox: () => box,
    facing: () => -1,
    position: () => ({ x, y }),
    isInvulnerable: () => false,
    isDead: () => hp <= 0,
    receiveHit(hit: HitEvent) {
      hp -= hit.damage
      if (hp <= 0) image.setVisible(false)
    },
    update() {
      if (hp <= 0) gone = true
    },
    setAsleep(next) {
      if (next === asleep || hp <= 0) return
      asleep = next
      if (asleep) deps.combat.unregister(mob)
      else deps.combat.register(mob)
    },
    isGone: () => gone,
    destroy() {
      deps.combat.unregister(mob)
      image.destroy()
    },
  }
  xpByMob.set(mob, spec.xp)
  deps.combat.register(mob)
  return mob
}

export function mobXp(target: Combatant): number {
  return xpByMob.get(target) ?? 0
}

export function updatePickups(_scene: Phaser.Scene, _player: PlayerHandle): void {}
