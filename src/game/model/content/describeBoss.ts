import type { Annotation, AnnotationCategory } from '../../../arc/provenance/types'
import type { BossArchetype, BossAttackSlot, BossGenome, BossMechanicKind, BossSpec, BossThemeKind, FinalBossSpec } from '../../contracts/content'
import { KIND_TEXT } from './bossAttacks'
import { BOSS_SLOT_COUNT, FINAL_PHASE_MECHANICS } from './bossGenome'
import type { DescribeRow, MonsterDescription } from './describe'

const MAX_VALUE = 30
// Matches the segment quality, quality = annotations / 8.
const FULL_QUALITY_ANNOTATIONS = 8
// Matches staggerBarSize in phaser/bosses/stagger.ts: at quality 0 the bar is 10 times larger.
const LOW_QUALITY_BAR = 10

const ARCHETYPE_NAME: Record<BossArchetype, string> = {
  rootTreant: 'Root treant',
  specimenJar: 'Specimen jar',
  reagentGolem: 'Reagent golem',
  glitchDaemon: 'Glitch daemon',
}

export const MECHANIC_TEXT: Record<BossMechanicKind, { name: string; effect: string }> = {
  armoredFront: { name: 'Armored front', effect: 'hits from the front deal 40% less, hit it from behind or above' },
  enrage: { name: 'Overclocked', effect: 'below 40% hp its attacks recharge 30% faster' },
  phaseShift: { name: 'Phase shift', effect: 'at half hp it swaps its light attacks for others' },
  summoner: { name: 'Summoner', effect: 'calls a minion every few seconds' },
  hazard: { name: 'Spill', effect: 'marks a spill under you that burns a moment later' },
  teleport: { name: 'Teleport', effect: 'blinks to the other side of you' },
  shieldPulse: { name: 'Shield pulse', effect: 'after a light attack it may raise a shield that blocks hits for 1.4 s' },
  reflect: { name: 'Mirror', effect: 'sends your shots back while it winds up a heavy attack' },
}

export const THEME_TEXT: Record<BossThemeKind, { name: string; effect: string }> = {
  tempo: { name: 'Tempo', effect: 'attacks recharge 15% faster' },
  heat: { name: 'Heat', effect: 'flame shots, light attacks hit 15% harder' },
  reach: { name: 'Reach', effect: 'sweeps, charges and beams reach 25% further' },
  dense: { name: 'Dense', effect: '15% more hp' },
  precise: { name: 'Precise', effect: 'fans fire 2 more shots, drops aim at you more often' },
}

const ORDINAL = ['first', 'second', 'third']

const titleCase = (text: string) => `${text.charAt(0).toUpperCase()}${text.slice(1)}`
const cut = (text: string) => (text.length > MAX_VALUE ? `${text.slice(0, MAX_VALUE - 1)}…` : text)
// An ontology term as its short id, "http://purl.obolibrary.org/obo/PATO_0000146" as "PATO:0000146".
export function termId(accession: string): string {
  const last = accession.trim().split(/[/#]/).filter(Boolean).pop() ?? accession
  return last.replace(/^([A-Za-z]+)_(\d+)$/, '$1:$2')
}

const typeCount = (category: AnnotationCategory, sources: readonly Annotation[]) => `${titleCase(category)} ×${sources.length}`

// The stagger bar compared to the bar of a fully annotated boss.
export function staggerBarFactor(quality: number): number {
  const q = Math.min(1, Math.max(0, quality))
  return 1 / (1 / LOW_QUALITY_BAR + (1 - 1 / LOW_QUALITY_BAR) * q)
}

function attackRow(slot: BossAttackSlot, index: number, heavy: boolean, filled: number): DescribeRow {
  const part = `${heavy ? 'Heavy' : 'Light'} ${index + 1}`
  const { source, attack } = slot
  const what = heavy ? 'ontology term' : 'value with a unit'
  if (source && attack) {
    const value = heavy ? `${source.name} (${termId(source.accession ?? '')})` : `${source.name} = ${source.value} ${source.unit}`
    return { part, value: cut(value), arrowTo: `${attack.name}: ${KIND_TEXT[attack.kind]}, ${attack.damage} damage`, color: 'teal' }
  }
  const missing = filled === 0 ? `no ${what} on this step` : `only ${filled} ${what} on this step`
  if (attack) return { part, value: 'empty', arrowTo: `${missing}, plain ${attack.name} (${attack.damage} damage)`, color: 'teal' }
  return { part, value: 'empty', arrowTo: `${missing}, slot stays empty`, color: 'teal' }
}

// A final boss phase leaves the second heavy slot and the third mechanic out, `limits` says so.
function genomeRows(genome: BossGenome, quality: number, telegraphMs: number, limits: { heavy: number; mechanics: number }, bodyText: string): DescribeRow[] {
  const { body, theme } = genome
  const rows: DescribeRow[] = [
    { part: 'Key', value: body.key ? cut(`"${body.key}"${body.sources.length > 1 ? ` ×${body.sources.length}` : ''}`) : 'no annotations', arrowTo: bodyText, color: 'blue' },
  ]
  const heavyFilled = genome.heavy.filter((slot) => slot.source).length
  genome.heavy.forEach((slot, i) => {
    const row = attackRow(slot, i, true, heavyFilled)
    if (slot.attack && i >= limits.heavy) row.arrowTo += ' (not used in this phase)'
    rows.push(row)
  })
  const lightFilled = genome.light.filter((slot) => slot.source).length
  genome.light.forEach((slot, i) => rows.push(attackRow(slot, i, false, lightFilled)))
  const types = genome.mechanics.filter((slot) => slot.category).length
  genome.mechanics.forEach((slot, i) => {
    const part = `Mechanic ${i + 1}`
    if (!slot.category || !slot.mechanic) {
      rows.push({ part, value: 'empty', arrowTo: `needs a ${ORDINAL[i]} annotation type, this step has ${types}`, color: 'yellow' })
      return
    }
    const text = MECHANIC_TEXT[slot.mechanic]
    const unused = i >= limits.mechanics ? ' (not used in this phase)' : ''
    rows.push({ part, value: typeCount(slot.category, slot.sources), arrowTo: `${text.name}: ${text.effect}${unused}`, color: 'yellow' })
  })
  if (theme.kind) {
    const units = [...new Set(theme.sources.map((a) => a.unit ?? ''))].join(', ')
    rows.push({ part: 'Theme', value: cut(`units: ${units}`), arrowTo: `${THEME_TEXT[theme.kind].name}: ${THEME_TEXT[theme.kind].effect}`, color: 'cream' })
  } else {
    rows.push({ part: 'Theme', value: 'no units', arrowTo: 'no value with a unit, no theme modifier', color: 'cream' })
  }
  const count = genome.annotationCount
  const bar = staggerBarFactor(quality)
  const hits = genome.damageScale > 1 ? `hits ×${genome.damageScale.toFixed(2)}` : 'normal damage'
  rows.push({
    part: 'Quality',
    value: `${Math.min(count, FULL_QUALITY_ANNOTATIONS)} of ${FULL_QUALITY_ANNOTATIONS} annotations on ${genome.processName}`,
    arrowTo: `telegraph ${telegraphMs} ms, stagger bar ${bar <= 1 ? 'smallest' : `×${bar.toFixed(1)}`}, ${hits}`,
    color: 'cream',
  })
  return rows
}

function slotLine(genome: BossGenome): string {
  return `Slots filled: ${genome.filledSlots} of ${BOSS_SLOT_COUNT}. Ontology terms fill heavy slots, values with units light slots and the theme, each annotation type a mechanic.`
}

// Explains a node boss: which annotation of its step filled which slot, and what the quality of
// the step does to the fight.
export function describeBoss(spec: BossSpec): MonsterDescription {
  const { genome } = spec
  const bodyText = genome.body.key
    ? `body: ${ARCHETYPE_NAME[genome.body.archetype]} from the most common key, ${genome.body.size} (${genome.annotationCount} annotations)`
    : `body: ${ARCHETYPE_NAME[genome.body.archetype]} from the node kind (${spec.nodeKind}), ${genome.body.size}`
  const lines = [slotLine(genome)]
  if (spec.quality <= 0) lines.push('No annotations: the hp bar and attack names stay hidden and attacks barely warn.')
  return { title: `${spec.label} · Step ${genome.segmentIndex + 1}: ${genome.processName}`, rows: genomeRows(genome, spec.quality, spec.telegraphMs, { heavy: Infinity, mechanics: Infinity }, bodyText), lines }
}

// The final boss shows the phase it is in. Each phase is built from one step of the path.
export function describeFinalBoss(spec: FinalBossSpec, phaseIndex: number): MonsterDescription {
  const phase = spec.phases[Math.min(Math.max(0, phaseIndex), spec.phases.length - 1)]
  if (!phase) return { title: spec.title, rows: [], lines: [] }
  const { genome } = phase
  const bodyText = `the RO-Crate itself, moves like a ${ARCHETYPE_NAME[phase.archetype]}`
  return {
    title: `${spec.title} · Phase ${phaseIndex + 1} of ${spec.phases.length}: ${genome.processName}`,
    rows: genomeRows(genome, phase.quality, phase.telegraphMs, { heavy: 1, mechanics: FINAL_PHASE_MECHANICS }, bodyText),
    lines: [slotLine(genome), `Each phase is built from its own step, keeps the first heavy attack and ${FINAL_PHASE_MECHANICS} mechanics, and adds Crate Collapse.`],
  }
}
