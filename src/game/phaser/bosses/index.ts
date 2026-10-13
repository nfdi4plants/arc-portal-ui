import type Phaser from 'phaser'
import type { ScribbleArt } from '../../contracts/art'
import type { Combatant, CombatWorld } from '../../contracts/combat'
import type { BossSpec, FinalBossSpec } from '../../contracts/content'
import type { PlayerHandle } from '../../contracts/player'
import type { Rng } from '../../contracts/rng'
import type { RunPlan, Segment } from '../../contracts/run'
import { createActor } from './actor'
import type { PhaseConfig } from './actor'

export interface Arena {
  left: number
  right: number
  floorY: number
}

export interface BossDeps {
  combat: CombatWorld
  art: ScribbleArt
  player: PlayerHandle
  rng: Rng
}

export interface BossHandle extends Combatant {
  // Once per fixed step. The scene skips it during hit-stop.
  update(dtMs: number): void
  hpFraction(): number
  showHpBar(): boolean
  // Null unless attack names are shown and an attack is winding up or active.
  currentAttackName(): string | null
  // True once hp is 0 and the defeat animation has finished.
  isDefeated(): boolean
  destroy(): void
}

export interface Boss extends BossHandle {
  readonly spec: BossSpec
}

export interface FinalBoss extends BossHandle {
  readonly spec: FinalBossSpec
  phaseIndex(): number
  onPhaseChange(listener: (phase: number) => void): () => void
}

// The node boss after a segment. The rewards of annotation quality come ready-made in the spec.
export function spawnBoss(scene: Phaser.Scene, spec: BossSpec, segment: Segment, deps: BossDeps, arena: Arena): Boss {
  const killer = { kind: 'boss', spec, segment } as const
  const actor = createActor(scene, {
    id: `boss:${spec.nodeId}`,
    art: deps.art.boss(scene, spec),
    hp: spec.hp,
    phases: [
      {
        archetype: spec.archetype,
        attacks: spec.attacks,
        quality: spec.quality,
        showHpBar: spec.showHpBar,
        showAttackNames: spec.showAttackNames,
        safeZones: spec.safeZones,
        weakPoints: spec.weakPoints,
        staggerWindowMs: spec.staggerWindowMs,
        tells: spec.tells,
      },
    ],
    killerFor: () => killer,
    deps,
    arena,
  })
  return Object.assign(actor, { spec })
}

// The final spec carries a quality per phase and no reward fields, so the rewards follow the same
// formulas as a node boss (see bossFromNode) and the tells are the annotations of the node that
// the phase's segment leads to.
function finalPhases(spec: FinalBossSpec, plan: RunPlan): PhaseConfig[] {
  return spec.phases.map((phase) => ({
    archetype: phase.archetype,
    attacks: phase.attacks,
    quality: phase.quality,
    showHpBar: phase.quality > 0,
    showAttackNames: phase.quality > 0,
    safeZones: Math.round(3 * phase.quality),
    weakPoints: Math.round(3 * phase.quality),
    staggerWindowMs: Math.round(400 + 1200 * phase.quality),
    tells: plan.nodes[phase.segmentIndex + 1]?.annotations ?? [],
  }))
}

// The ARC itself. One phase per segment, the hp split evenly, and a 1.2 s invulnerable pause
// between phases.
export function spawnFinalBoss(scene: Phaser.Scene, spec: FinalBossSpec, plan: RunPlan, deps: BossDeps, arena: Arena): FinalBoss {
  const actor = createActor(scene, {
    id: `finalBoss:${spec.title}`,
    art: deps.art.finalBoss(scene, spec),
    hp: spec.hp,
    phases: finalPhases(spec, plan),
    killerFor: (phase) => ({ kind: 'finalBoss', title: spec.title, phase }),
    mirror: false,
    deps,
    arena,
  })
  return Object.assign(actor, { spec })
}
