import type { Annotation, AnnotationCategory, IoKind } from '../../../arc/provenance/types'
import type {
  BossArchetype,
  BossAttackKind,
  BossAttackSlot,
  BossAttackSpec,
  BossGenome,
  BossMechanicKind,
  BossMechanicSlot,
  BossMechanicSpec,
  BossThemeKind,
} from '../../contracts/content'
import { hashString } from '../../contracts/rng'
import type { Segment } from '../../contracts/run'
import type { AttackTemplate } from './bossAttacks'
import { attackTemplate, HEAVY_KINDS, LIGHT_KINDS, PLAIN_HEAVY, PLAIN_LIGHT } from './bossAttacks'
import { isMissingValue } from './label'

// A boss is built like a monster, from slots that annotations fill. A node boss only reads the
// annotations of its own step, the one that leads into it, so nothing carries over from earlier
// bosses. The rules follow good annotation practice:
//   body      the most common annotation key picks the silhouette (like a monster's body), the
//             number of annotations the size
//   heavy x2  annotations with an ontology term, the accession picks the attack
//   light x2  annotations with a value and a unit, the value picks the attack
//   mechanic  one per annotation type on the step, the three most common
//   theme     the units: time, temperature, length, amount or anything else
// The same annotations always give the same boss.

export const BOSS_SLOT_COUNT = 9
export const HEAVY_SLOTS = 2
export const LIGHT_SLOTS = 2
export const MECHANIC_SLOTS = 3
// A final boss phase uses this many of its step's mechanics, so a long fight does not pile them up.
export const FINAL_PHASE_MECHANICS = 2
// No single boss hit may take more than this. The mage starts with 100 hp.
export const MAX_BOSS_HIT = 35
// Light attacks wind up with a fixed short flash, heavy ones with the step's telegraph time.
export const LIGHT_TELEGRAPH_MS = 250
export const MIN_TELEGRAPH_MS = 80
// The extra damage of a boss at quality 0, falling linearly to none at quality 1.
const MAX_EXTRA_DAMAGE = 0.55
const HEAT_LIGHT_BONUS = 1.15

const ARCHETYPES: BossArchetype[] = ['rootTreant', 'specimenJar', 'reagentGolem', 'glitchDaemon']

const NODE_ARCHETYPE: Record<IoKind, BossArchetype> = {
  source: 'rootTreant',
  sample: 'specimenJar',
  material: 'reagentGolem',
  data: 'glitchDaemon',
}

export const MECHANIC_OF: Record<AnnotationCategory, BossMechanicKind> = {
  characteristic: 'armoredFront',
  parameter: 'enrage',
  factor: 'phaseShift',
  component: 'summoner',
  protocol: 'hazard',
  performer: 'teleport',
  date: 'shieldPulse',
  comment: 'reflect',
}

// Ties between equally common types go to the earlier one here.
const CATEGORY_ORDER: AnnotationCategory[] = ['parameter', 'characteristic', 'factor', 'component', 'protocol', 'performer', 'date', 'comment']
const THEME_ORDER: BossThemeKind[] = ['tempo', 'heat', 'reach', 'dense', 'precise']

const MECHANIC_DAMAGE: Partial<Record<BossMechanicKind, number>> = { hazard: 10, reflect: 6, summoner: 6 }

const SIZES: { upTo: number; size: BossGenome['body']['size']; scale: number }[] = [
  { upTo: 2, size: 'small', scale: 0.9 },
  { upTo: 7, size: 'medium', scale: 1 },
  { upTo: Infinity, size: 'large', scale: 1.12 },
]

export function bossArchetypeFor(kind: IoKind): BossArchetype {
  return NODE_ARCHETYPE[kind]
}

// 1 for a fully annotated step, rising to 1.55 for an empty one.
export function bossDamageScale(quality: number): number {
  const q = Math.min(1, Math.max(0, quality))
  // The small epsilon rounds halves up despite binary fractions (1.275 gives 1.28).
  return Math.round((1 + MAX_EXTRA_DAMAGE * (1 - q)) * 100 + 1e-9) / 100
}

export function scaledHit(damage: number, scale: number): number {
  return Math.min(MAX_BOSS_HIT, Math.round(damage * scale))
}

// The unit's family. Abbreviations are matched case-sensitive (mM is an amount, mm a length).
export function unitTheme(unit: string): BossThemeKind {
  const text = unit.trim()
  const lower = text.toLowerCase()
  if (/celsius|fahrenheit|kelvin|°|degree/.test(lower)) return 'heat'
  if (/^(ms|s|sec|min|h|hr|d|wk)$/.test(lower) || /second|minute|hour|day|week|month|year/.test(lower)) return 'tempo'
  if (/^[nµuμm]?M$/.test(text) || /molar|mol|gram|lit(er|re)|percent|ppm/.test(lower) || /^([nµuμmk]?g|[nµuμm]?mol|[nµuμm]?l|%)$/i.test(text)) return 'dense'
  if (/^[nµuμmck]?m$/.test(text) || /met(er|re)|inch/.test(lower)) return 'reach'
  return 'precise'
}

const keyOf = (a: Annotation) => JSON.stringify([a.name, a.value, a.unit, a.accession, a.category])
const rank = (a: Annotation) => hashString(keyOf(a))
const byRank = (a: Annotation, b: Annotation) => rank(a) - rank(b)
const hasTerm = (a: Annotation) => Boolean(a.accession?.trim())
const hasUnit = (a: Annotation) => !isMissingValue(a.value) && Boolean(a.unit?.trim())

// The kind at `start` in the pool, or the next one not taken yet.
function freeKind(pool: readonly BossAttackKind[], start: number, taken: readonly BossAttackKind[]): BossAttackKind {
  for (let i = 0; i < pool.length; i++) {
    const kind = pool[(start + i) % pool.length]
    if (!taken.includes(kind)) return kind
  }
  return pool[start % pool.length]
}

interface AttackContext {
  archetype: BossArchetype
  telegraphMs: number
  damageScale: number
  theme: BossThemeKind | null
}

function toSpec(template: AttackTemplate, id: string, ctx: AttackContext): BossAttackSpec {
  const heat = ctx.theme === 'heat' && !template.heavy ? HEAT_LIGHT_BONUS : 1
  return {
    id,
    name: template.name,
    kind: template.kind,
    heavy: template.heavy,
    telegraphMs: template.heavy ? ctx.telegraphMs : LIGHT_TELEGRAPH_MS,
    damage: scaledHit(template.damage * heat, ctx.damageScale),
    cooldownMs: template.cooldownMs,
  }
}

// `taken` holds the kinds already in use. A light slot avoids the heavy kinds, so no light attack
// shares its name with a heavy one.
function attackSlots(
  sources: Annotation[],
  heavy: boolean,
  ctx: AttackContext,
  kindHash: (a: Annotation) => number,
  taken: BossAttackKind[],
): BossAttackSlot[] {
  const pool = heavy ? HEAVY_KINDS : LIGHT_KINDS
  const tag = heavy ? 'h' : 'l'
  const slots: BossAttackSlot[] = []
  for (let i = 0; i < (heavy ? HEAVY_SLOTS : LIGHT_SLOTS); i++) {
    const source = sources[i] ?? null
    let kind: BossAttackKind | null = null
    if (source) kind = freeKind(pool, kindHash(source) % pool.length, taken)
    else if (i === 0) kind = heavy ? PLAIN_HEAVY[ctx.archetype] : freeKind(pool, pool.indexOf(PLAIN_LIGHT), taken)
    if (kind) taken.push(kind)
    const attack = kind ? toSpec(attackTemplate(ctx.archetype, kind, heavy), `${ctx.archetype}.${kind}.${tag}${i}`, ctx) : null
    slots.push({ source, attack })
  }
  return slots
}

// The key that the most annotations share, ties to the lowest rank, with its annotations.
function topKey(annotations: readonly Annotation[]): { key: string; sources: Annotation[] } | null {
  const byKey = new Map<string, Annotation[]>()
  for (const annotation of annotations) byKey.set(annotation.name, [...(byKey.get(annotation.name) ?? []), annotation])
  let best: { key: string; sources: Annotation[] } | null = null
  for (const [key, sources] of byKey) {
    const more = !best || sources.length > best.sources.length
    if (more || (best && sources.length === best.sources.length && hashString(key) < hashString(best.key))) best = { key, sources }
  }
  return best
}

// The most common types first, ties in CATEGORY_ORDER.
function categoriesByCount(annotations: readonly Annotation[]): { category: AnnotationCategory; sources: Annotation[] }[] {
  return CATEGORY_ORDER.map((category) => ({ category, sources: annotations.filter((a) => a.category === category) }))
    .filter((entry) => entry.sources.length > 0)
    .sort((a, b) => b.sources.length - a.sources.length || CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category))
}

function themeOf(withUnits: readonly Annotation[]): BossGenome['theme'] {
  const groups = THEME_ORDER.map((kind) => ({ kind, sources: withUnits.filter((a) => unitTheme(a.unit ?? '') === kind) }))
  let best: (typeof groups)[number] | null = null
  for (const group of groups) if (group.sources.length > 0 && (!best || group.sources.length > best.sources.length)) best = group
  return best ? { kind: best.kind, sources: best.sources } : { kind: null, sources: [] }
}

// `fallbackKind` picks the body of a step without annotations.
export function bossGenome(segment: Segment, fallbackKind: IoKind): BossGenome {
  // Sorted by hash, so the order the step lists its annotations in does not matter.
  const annotations = [...segment.annotations].sort(byRank)
  const count = annotations.length
  const types = categoriesByCount(annotations)
  const top = topKey(annotations)
  const archetype = top ? ARCHETYPES[hashString(top.key) % ARCHETYPES.length] : NODE_ARCHETYPE[fallbackKind]
  const size = SIZES.find((entry) => count <= entry.upTo) ?? SIZES[SIZES.length - 1]
  const damageScale = bossDamageScale(segment.quality)
  const withUnits = annotations.filter(hasUnit)
  const theme = themeOf(withUnits)
  const ctx: AttackContext = { archetype, telegraphMs: Math.max(MIN_TELEGRAPH_MS, segment.telegraphMs), damageScale, theme: theme.kind }

  const termed = annotations.filter(hasTerm)
  const taken: BossAttackKind[] = []
  const heavy = attackSlots(termed, true, ctx, (a) => hashString(a.accession?.trim() ?? ''), taken)
  const usedByHeavy = new Set(heavy.map((slot) => slot.source))
  // An annotation that already filled a heavy slot only fills a light one when no other is left.
  const lightSources = [...withUnits.filter((a) => !usedByHeavy.has(a)), ...withUnits.filter((a) => usedByHeavy.has(a))]
  const light = attackSlots(lightSources, false, ctx, (a) => hashString(`${a.value ?? ''}|${a.unit ?? ''}`), taken)

  const mechanics: BossMechanicSlot[] = []
  for (let i = 0; i < MECHANIC_SLOTS; i++) {
    const type = types[i]
    mechanics.push(type ? { category: type.category, sources: type.sources, mechanic: MECHANIC_OF[type.category] } : { category: null, sources: [], mechanic: null })
  }

  const filledSlots =
    (top ? 1 : 0) +
    heavy.filter((slot) => slot.source).length +
    light.filter((slot) => slot.source).length +
    mechanics.filter((slot) => slot.mechanic).length +
    (theme.kind ? 1 : 0)

  return {
    segmentIndex: segment.index,
    processName: segment.processName,
    annotationCount: count,
    body: { archetype, size: size.size, scale: size.scale, key: top?.key ?? null, sources: top?.sources ?? [] },
    heavy,
    light,
    mechanics,
    theme,
    filledSlots,
    damageScale,
  }
}

// The filled attack slots, heavy ones first.
export function genomeAttacks(genome: BossGenome): BossAttackSpec[] {
  const attacks: BossAttackSpec[] = []
  for (const slot of [...genome.heavy, ...genome.light]) if (slot.attack) attacks.push(slot.attack)
  return attacks
}

// The light attacks after a phase shift: each one moves two kinds on in the pool, to a kind the
// boss does not use yet.
function shiftedLights(genome: BossGenome): BossAttackSpec[] {
  const lights = genome.light.flatMap((slot) => (slot.attack ? [slot.attack] : []))
  const taken = genomeAttacks(genome).map((attack) => attack.kind)
  return lights.map((attack, i) => {
    const kind = freeKind(LIGHT_KINDS, LIGHT_KINDS.indexOf(attack.kind) + 2, taken)
    taken.push(kind)
    const ctx: AttackContext = { archetype: genome.body.archetype, telegraphMs: 0, damageScale: genome.damageScale, theme: genome.theme.kind }
    return toSpec(attackTemplate(genome.body.archetype, kind, false), `${genome.body.archetype}.${kind}.shift${i}`, ctx)
  })
}

export function genomeMechanics(genome: BossGenome, limit = MECHANIC_SLOTS): BossMechanicSpec[] {
  const specs: BossMechanicSpec[] = []
  for (const slot of genome.mechanics) {
    if (!slot.mechanic || specs.length >= limit) continue
    const base = MECHANIC_DAMAGE[slot.mechanic] ?? 0
    specs.push({
      kind: slot.mechanic,
      damage: base > 0 ? scaledHit(base, genome.damageScale) : 0,
      shiftAttacks: slot.mechanic === 'phaseShift' ? shiftedLights(genome) : [],
    })
  }
  return specs
}
