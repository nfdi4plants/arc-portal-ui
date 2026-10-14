import type { BossFromNode, FinalBossFromPlan, FinalBossPhase } from '../../contracts/content'
import { SHARED_HEAVY_ATTACK } from './bossAttacks'
import { bossGenome, FINAL_PHASE_MECHANICS, genomeAttacks, genomeMechanics, MIN_TELEGRAPH_MS, scaledHit } from './bossGenome'

export { bossArchetypeFor } from './bossGenome'

const MAX_LABEL_LENGTH = 24
// A dense theme (units of mass, amount or volume) gives a node boss this much more hp.
const DENSE_HP = 1.15

// The last path segment of the node id, cut to the label width.
function shortLabel(nodeId: string): string {
  const name = nodeId.split('/').filter(Boolean).pop() ?? nodeId
  return name.length > MAX_LABEL_LENGTH ? `${name.slice(0, MAX_LABEL_LENGTH - 1)}…` : name
}

// The boss is built from the genome of its step. The rng is not needed: the same step always
// gives the same boss, like the same annotation always gives the same monster.
export const bossFromNode: BossFromNode = (node, segment) => {
  const genome = bossGenome(segment, node.kind)
  const quality = segment.quality
  const revealed = quality > 0
  const dense = genome.theme.kind === 'dense' ? DENSE_HP : 1
  return {
    nodeId: node.id,
    nodeKind: node.kind,
    archetype: genome.body.archetype,
    label: shortLabel(node.id),
    segmentIndex: segment.index,
    quality,
    telegraphMs: segment.telegraphMs,
    showHpBar: revealed,
    showAttackNames: revealed,
    safeZones: Math.round(3 * quality),
    weakPoints: Math.round(3 * quality),
    staggerWindowMs: Math.round(400 + 1200 * quality),
    tells: node.annotations,
    hp: Math.round(400 * (1 + 0.35 * segment.index) * dense),
    attacks: genomeAttacks(genome),
    mechanics: genomeMechanics(genome),
    theme: genome.theme.kind,
    damageScale: genome.damageScale,
    genome,
    xp: 15,
  }
}

// One phase per segment, each built from its own step's genome, so the fight replays the path.
// A phase keeps the signature heavy attack, the light attacks and two mechanics of its step and
// adds the shared Crate Collapse.
export const finalBossFromPlan: FinalBossFromPlan = (plan) => {
  const phases: FinalBossPhase[] = plan.segments.map((segment, i) => {
    const genome = bossGenome(segment, plan.nodes[i + 1].kind)
    const [signature] = genome.heavy
    const crate = SHARED_HEAVY_ATTACK
    return {
      segmentIndex: segment.index,
      datasetKind: segment.datasetKind,
      archetype: genome.body.archetype,
      quality: segment.quality,
      telegraphMs: Math.max(MIN_TELEGRAPH_MS, segment.telegraphMs),
      attacks: [
        ...(signature.attack ? [signature.attack] : []),
        ...genome.light.flatMap((slot) => (slot.attack ? [slot.attack] : [])),
        {
          id: `crate.${crate.kind}.0`,
          name: crate.name,
          kind: crate.kind,
          heavy: true,
          telegraphMs: Math.max(MIN_TELEGRAPH_MS, segment.telegraphMs),
          damage: scaledHit(crate.damage, genome.damageScale),
          cooldownMs: crate.cooldownMs,
        },
      ],
      mechanics: genomeMechanics(genome, FINAL_PHASE_MECHANICS),
      theme: genome.theme.kind,
      damageScale: genome.damageScale,
      genome,
    }
  })
  return { title: plan.arcTitle || 'ARC', hp: 600 * plan.segments.length, phases }
}
