import type { AnnotationCategory } from '../../../arc/provenance/types'
import type { MonsterSpec, PassiveKind } from '../../contracts/content'
import type { Segment } from '../../contracts/run'

// Appended to the label of a monster that a summoner called.
export const SUMMONED_SUFFIX = ' (summoned)'

const CATEGORY_TEXT: Record<AnnotationCategory, string> = {
  parameter: 'a setting of the protocol step',
  characteristic: 'a property of the input',
  factor: 'an experimental variable of the output',
  component: 'an instrument or material used',
  protocol: 'the protocol that was followed',
  performer: 'the person who carried out the step',
  date: 'when the step was performed',
  comment: 'a free-text note',
}

const PASSIVE_TEXT: Record<PassiveKind, { name: string; effect: string }> = {
  armored: { name: 'Armored', effect: 'takes half damage from the front, so hit it from behind or from above' },
  stanceShift: { name: 'Stance shift', effect: 'swaps between an aggressive and a defensive stance on a timer' },
  tuned: { name: 'Tuned', effect: 'one stat is boosted by 30 percent (speed, damage, range or attack rate)' },
  shieldDrop: { name: 'Shield drop', effect: 'drops a shield fragment that absorbs one hit when it dies' },
  patrol: { name: 'Patrol', effect: 'walks a fixed route and hits 20 percent harder' },
  summoner: { name: 'Summoner', effect: 'calls two weak minions once when it notices you' },
  blink: { name: 'Blink', effect: 'teleports a short way after a brief flash' },
  chatter: { name: 'Chatter', effect: 'speaks the annotation value in speech bubbles and has low health' },
}

const ONTOLOGY_XP_BONUS = 5
// Matches the depth factor of monsterFromAnnotation.
const DEPTH_STEP = 0.12

const HUE_NAMES = ['red', 'orange', 'yellow', 'green', 'teal', 'blue', 'purple', 'pink']
// The hue wheel in 45 degree slices, shifted so that 0 degrees sits in the middle of red.
const hueName = (hue: number) => HUE_NAMES[Math.floor(((((hue + 22.5) % 360) + 360) % 360) / 45)]

const titleCase = (text: string) => `${text.charAt(0).toUpperCase()}${text.slice(1)}`

// The colour group a row belongs to. The panel maps each name to a palette colour, so the part of
// the annotation and the trait it caused share a colour.
export type DescribeColor = 'blue' | 'teal' | 'yellow' | 'cream'

export interface DescribeRow {
  // The part of the annotation, for example "Key".
  part: string
  // What that part holds, for example "temperature day".
  value: string
  // What it did to the monster, for example "body: Beetle, blue hue".
  arrowTo: string
  color: DescribeColor
}

export interface MonsterDescription {
  title: string
  // One row per annotation part and the monster trait it produced.
  rows: DescribeRow[]
  // Further explanation, shown below the rows.
  lines: string[]
}

// Explains which annotation made a monster and how its fields shaped it.
export function describeMonster(spec: MonsterSpec, segment: Segment): MonsterDescription {
  const { category, name, value, unit, accession } = spec.source
  const dataset = segment.datasetId.replace(/\/+$/, '')
  const count = segment.annotations.length
  const lines: string[] = [`Type: ${titleCase(category)}, ${CATEGORY_TEXT[category]}`]
  lines.push(`Step ${segment.index + 1}: ${dataset} · ${segment.processName}, ${count} ${count === 1 ? 'annotation' : 'annotations'}, one monster each`)

  if (spec.label.endsWith(SUMMONED_SUFFIX)) {
    lines.push('A weak slime called by the monster of this annotation. It only touches and gives no XP')
    return { title: spec.label, rows: [], lines }
  }

  const scale = spec.weapon.scale
  const size = scale === 1 ? 'normal size (the value is text or empty)' : `size ${scale.toFixed(2)}x`
  const weapon = `weapon: ${titleCase(spec.weapon.kind)}, ${size}${spec.weapon.calibrated ? ', aims precisely (has a unit)' : ''}`
  const passive = PASSIVE_TEXT[spec.passive.kind]
  const shown = value ? `"${value}"${unit ? ` + unit "${unit}"` : ''}` : 'none'
  const depth = (1 + DEPTH_STEP * spec.segmentIndex).toFixed(2)

  const rows: DescribeRow[] = [
    { part: 'Key', value: `"${name}"`, arrowTo: `body: ${titleCase(spec.body)}, ${hueName(spec.hue)} hue, ${spec.size}`, color: 'blue' },
    { part: 'Value', value: shown, arrowTo: weapon, color: 'teal' },
    { part: 'Type', value: titleCase(category), arrowTo: `passive: ${passive.name}, ${passive.effect}`, color: 'yellow' },
    {
      part: 'Ontology term',
      value: accession ?? 'no ontology term',
      arrowTo: accession ? `+${ONTOLOGY_XP_BONUS} XP` : 'base XP',
      color: 'cream',
    },
    { part: 'Step', value: `${dataset} (${count} ${count === 1 ? 'annotation' : 'annotations'})`, arrowTo: `stronger with depth (stats x${depth} at this step)`, color: 'cream' },
  ]
  lines.push(accession ? `XP: ${spec.xp} (base ${spec.xp - ONTOLOGY_XP_BONUS}, +${ONTOLOGY_XP_BONUS} for the ontology term)` : `XP: ${spec.xp}`)
  return { title: spec.label, rows, lines }
}
