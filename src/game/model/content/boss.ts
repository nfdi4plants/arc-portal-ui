import type { IoKind } from '../../../arc/provenance/types'
import type {
  BossArchetype,
  BossAttackSpec,
  BossFromNode,
  FinalBossFromPlan,
  FinalBossPhase,
} from '../../contracts/content'
import type { Rng } from '../../contracts/rng'
import type { AttackTemplate } from './bossAttacks'
import { BOSS_ATTACKS, SHARED_HEAVY_ATTACK } from './bossAttacks'

const ARCHETYPES: Record<IoKind, BossArchetype> = {
  source: 'rootTreant',
  sample: 'specimenJar',
  material: 'reagentGolem',
  data: 'glitchDaemon',
}

const LIGHT_TELEGRAPH_MS = 250
const MIN_TELEGRAPH_MS = 80
const MAX_LABEL_LENGTH = 24

export function bossArchetypeFor(kind: IoKind): BossArchetype {
  return ARCHETYPES[kind]
}

// The last path segment of the node id, cut to the label width.
function shortLabel(nodeId: string): string {
  const name = nodeId.split('/').filter(Boolean).pop() ?? nodeId
  return name.length > MAX_LABEL_LENGTH ? `${name.slice(0, MAX_LABEL_LENGTH - 1)}…` : name
}

function takeRandom(rng: Rng, pool: number[]): number {
  return pool.splice(rng.int(0, pool.length - 1), 1)[0]
}

// Draws `count` attacks without repeats, `minHeavy` of them heavy, in table order. The id carries
// the table position, so the same attack has the same id whatever else was drawn. With
// `lightRest` the attacks after the first `minHeavy` are all light, so the draw has exactly
// `minHeavy` heavy ones.
function drawAttacks(
  rng: Rng,
  archetype: BossArchetype,
  count: number,
  minHeavy: number,
  heavyTelegraphMs: number,
  lightRest = false,
): BossAttackSpec[] {
  const table = BOSS_ATTACKS[archetype]
  const heavyPool = table.flatMap((attack, i) => (attack.heavy ? [i] : []))
  const chosen: number[] = []
  for (let i = 0; i < minHeavy; i++) chosen.push(takeRandom(rng, heavyPool))
  const rest = table.flatMap((attack, i) => (chosen.includes(i) || (lightRest && attack.heavy) ? [] : [i]))
  while (chosen.length < count) chosen.push(takeRandom(rng, rest))
  return chosen
    .sort((a, b) => a - b)
    .map((n) => toSpec(table[n], `${archetype}.${table[n].kind}.${n}`, heavyTelegraphMs))
}

function toSpec(template: AttackTemplate, id: string, heavyTelegraphMs: number): BossAttackSpec {
  return {
    id,
    name: template.name,
    kind: template.kind,
    heavy: template.heavy,
    telegraphMs: template.heavy ? heavyTelegraphMs : LIGHT_TELEGRAPH_MS,
    damage: template.damage,
    cooldownMs: template.cooldownMs,
  }
}

export const bossFromNode: BossFromNode = (node, segment, rng) => {
  const archetype = bossArchetypeFor(node.kind)
  const quality = segment.quality
  const revealed = quality > 0
  const count = rng.int(4, 6)
  return {
    nodeId: node.id,
    nodeKind: node.kind,
    archetype,
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
    hp: Math.round(400 * (1 + 0.35 * segment.index)),
    attacks: drawAttacks(rng, archetype, count, 2, segment.telegraphMs),
    xp: 15,
  }
}

export const finalBossFromPlan: FinalBossFromPlan = (plan, rng) => {
  const phases: FinalBossPhase[] = plan.segments.map((segment, i) => {
    const archetype = bossArchetypeFor(plan.nodes[i + 1].kind)
    const telegraphMs = Math.max(MIN_TELEGRAPH_MS, segment.telegraphMs)
    return {
      segmentIndex: segment.index,
      datasetKind: segment.datasetKind,
      archetype,
      quality: segment.quality,
      telegraphMs,
      attacks: [
        ...drawAttacks(rng, archetype, 3, 1, telegraphMs, true),
        toSpec(SHARED_HEAVY_ATTACK, `crate.${SHARED_HEAVY_ATTACK.kind}.0`, telegraphMs),
      ],
    }
  })
  return { title: plan.arcTitle || 'ARC', hp: 600 * plan.segments.length, phases }
}
