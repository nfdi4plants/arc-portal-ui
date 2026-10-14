import type { AnnotationCategory } from '../../../arc/provenance/types'
import type { BodyKind, EnemyWeaponKind, MonsterFromAnnotation, MonsterSpec, PassiveKind } from '../../contracts/content'
import { hashString } from '../../contracts/rng'
import { annotationLabel, isMissingValue } from './label'

const BODIES: BodyKind[] = ['slime', 'wisp', 'beetle', 'golem', 'imp', 'turret', 'bat', 'crawler']
const WEAPONS: EnemyWeaponKind[] = ['claw', 'spear', 'bow', 'wand', 'bomb', 'shield', 'whip', 'flask']

const PASSIVES: Record<AnnotationCategory, PassiveKind> = {
  characteristic: 'armored',
  factor: 'stanceShift',
  parameter: 'tuned',
  component: 'shieldDrop',
  protocol: 'patrol',
  performer: 'summoner',
  date: 'blink',
  comment: 'chatter',
}

// Speed is in world units per second. The turret is stationary, so its 30 is only the table minimum.
const BODY_STATS: Record<BodyKind, MonsterSpec['stats']> = {
  slime: { hp: 30, contactDamage: 8, speed: 50, aggroRange: 180 },
  wisp: { hp: 20, contactDamage: 6, speed: 70, aggroRange: 280 },
  beetle: { hp: 40, contactDamage: 10, speed: 90, aggroRange: 220 },
  golem: { hp: 60, contactDamage: 14, speed: 30, aggroRange: 200 },
  imp: { hp: 28, contactDamage: 8, speed: 100, aggroRange: 300 },
  turret: { hp: 36, contactDamage: 6, speed: 30, aggroRange: 320 },
  bat: { hp: 22, contactDamage: 7, speed: 120, aggroRange: 300 },
  crawler: { hp: 34, contactDamage: 9, speed: 60, aggroRange: 160 },
}

// Melee weapons reach 24 to 48 world units, ranged ones 160 to 260.
const WEAPON_STATS: Record<EnemyWeaponKind, { damage: number; cooldownMs: number; range: number }> = {
  claw: { damage: 8, cooldownMs: 1000, range: 28 },
  spear: { damage: 10, cooldownMs: 1400, range: 48 },
  bow: { damage: 8, cooldownMs: 1600, range: 260 },
  wand: { damage: 9, cooldownMs: 1500, range: 220 },
  bomb: { damage: 14, cooldownMs: 2200, range: 160 },
  shield: { damage: 6, cooldownMs: 1200, range: 24 },
  whip: { damage: 7, cooldownMs: 900, range: 44 },
  flask: { damage: 11, cooldownMs: 1900, range: 180 },
}

const SIZE_FACTOR: Record<MonsterSpec['size'], number> = { small: 0.75, medium: 1, large: 1.4 }
const SIZES: MonsterSpec['size'][] = ['small', 'medium', 'large']

const TUNED_BOOST = 0.3

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

// Text values and empty values give 1. A number scales the weapon on a log curve.
function weaponScale(value: string | null): number {
  const parsed = isMissingValue(value) ? Number.NaN : Number(value)
  if (!Number.isFinite(parsed)) return 1
  return clamp(0.75 + 0.2 * Math.log10(Math.abs(parsed) + 1), 0.75, 1.6)
}

function sizeOf(body: BodyKind, passive: PassiveKind, sizeHash: number): MonsterSpec['size'] {
  if (passive === 'chatter') return 'small'
  const size = SIZES[sizeHash % SIZES.length]
  return body === 'golem' && size === 'small' ? 'medium' : size
}

export const monsterFromAnnotation: MonsterFromAnnotation = (annotation, segmentIndex) => {
  const { name, value, unit, accession, category } = annotation
  const hash = hashString(JSON.stringify([name, value, unit, accession, category]))
  const nameHash = hashString(name)

  const body = BODIES[nameHash % BODIES.length]
  const weaponKind = WEAPONS[hashString(value ?? '') % WEAPONS.length]
  const passive = { kind: PASSIVES[category], variant: hash % 4 }
  const size = sizeOf(body, passive.kind, hashString(name + (value ?? '')))
  const scale = weaponScale(value)
  const depth = 1 + 0.12 * segmentIndex

  const base = BODY_STATS[body]
  const weaponBase = WEAPON_STATS[weaponKind]
  let hp = base.hp * SIZE_FACTOR[size] * depth
  let contactDamage = base.contactDamage * SIZE_FACTOR[size] * depth
  let speed = base.speed
  let weaponDamage = weaponBase.damage * scale * depth
  let cooldownMs = weaponBase.cooldownMs
  let range = weaponBase.range

  const boostDamage = (factor: number) => {
    contactDamage *= factor
    weaponDamage *= factor
  }
  if (passive.kind === 'tuned') {
    // The variant picks which single stat gets the boost.
    if (passive.variant === 0) speed *= 1 + TUNED_BOOST
    else if (passive.variant === 1) boostDamage(1 + TUNED_BOOST)
    else if (passive.variant === 2) range *= 1 + TUNED_BOOST
    else cooldownMs *= 1 - TUNED_BOOST
  } else if (passive.kind === 'patrol') {
    boostDamage(1.2)
  } else if (passive.kind === 'chatter') {
    hp *= 0.5
  }

  return {
    id: hash.toString(36),
    source: annotation,
    label: annotationLabel(annotation),
    body,
    hue: (nameHash >>> 3) % 360,
    size,
    weapon: {
      kind: weaponKind,
      scale,
      calibrated: Boolean(unit),
      damage: Math.round(weaponDamage),
      cooldownMs: Math.round(cooldownMs),
      range: Math.round(range),
    },
    passive,
    stats: {
      hp: Math.round(hp),
      contactDamage: Math.round(contactDamage),
      speed: Math.round(speed),
      aggroRange: base.aggroRange,
    },
    xp: accession ? 15 : 10,
    segmentIndex,
    phantom: isMissingValue(value),
  }
}
