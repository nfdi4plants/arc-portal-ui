import type Phaser from 'phaser'
import type { ScribbleArt } from '../../contracts/art'
import type { Combatant, CombatWorld } from '../../contracts/combat'
import type { BossSpec, FinalBossSpec } from '../../contracts/content'
import type { PlayerHandle } from '../../contracts/player'
import type { Rng } from '../../contracts/rng'
import type { RunPlan, Segment } from '../../contracts/run'
import { describeBoss, describeFinalBoss } from '../../model/content'
import { createActor } from './actor'
import type { Actor, PhaseConfig } from './actor'
import { scaleArt } from './sprites'
import type { ArenaPlatform } from './zones'

export { arenaPlatforms, PLATFORM_THICKNESS, type ArenaPlatform } from './zones'

export interface Arena {
  left: number
  right: number
  floorY: number
  // One-way platforms over the floor, see arenaPlatforms.
  platforms: readonly ArenaPlatform[]
}

export type StaggerState = 'filling' | 'locked' | 'staggered'

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
  // The stagger bar, 0 to 1. While staggered it is the share of the stagger still to run.
  staggerFraction(): number
  // 'locked' while a heavy attack winds up or hits, then hits do not fill the bar.
  staggerState(): StaggerState
  // True once hp is 0 and the defeat animation has finished.
  isDefeated(): boolean
  destroy(): void
}

// Both kinds can be inspected in the pause menu like a mob, see mobs/inspect.ts.
export interface Boss extends BossHandle, Pick<Actor, 'describe' | 'setInspectable' | 'setHighlight' | 'setRaised'> {
  readonly spec: BossSpec
}

export interface FinalBoss extends BossHandle, Pick<Actor, 'describe' | 'setInspectable' | 'setHighlight' | 'setRaised'> {
  readonly spec: FinalBossSpec
  phaseIndex(): number
  onPhaseChange(listener: (phase: number) => void): () => void
}

// The node boss after a segment. Its genome and the rewards of annotation quality come ready-made
// in the spec. The body is drawn at the size of the genome.
export function spawnBoss(scene: Phaser.Scene, spec: BossSpec, segment: Segment, deps: BossDeps, arena: Arena): Boss {
  const killer = { kind: 'boss', spec, segment } as const
  const actor = createActor(scene, {
    id: `boss:${spec.nodeId}`,
    art: scaleArt(deps.art.boss(scene, spec), spec.genome.body.scale),
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
        mechanics: spec.mechanics,
        theme: spec.theme,
      },
    ],
    killerFor: () => killer,
    deps,
    arena,
    describe: () => describeBoss(spec),
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
    mechanics: phase.mechanics,
    theme: phase.theme,
  }))
}

// The ARC itself. One phase per segment, the hp split evenly, and a 1.2 s invulnerable pause
// between phases. The inspection shows the phase it is in.
export function spawnFinalBoss(scene: Phaser.Scene, spec: FinalBossSpec, plan: RunPlan, deps: BossDeps, arena: Arena): FinalBoss {
  let phaseOf = () => 0
  const actor = createActor(scene, {
    id: `finalBoss:${spec.title}`,
    art: deps.art.finalBoss(scene, spec),
    hp: spec.hp,
    phases: finalPhases(spec, plan),
    killerFor: (phase) => ({ kind: 'finalBoss', title: spec.title, phase }),
    mirror: false,
    deps,
    arena,
    describe: () => describeFinalBoss(spec, phaseOf()),
  })
  phaseOf = actor.phaseIndex
  return Object.assign(actor, { spec })
}
