import type { PlayerBuild, PlayerWeaponId, WeaponSlot } from '../../contracts/progression'
import { CARDS, isLegendaryWeapon } from './catalog'

// Damage and reach live inside the onActive closures of the movesets, which need Phaser. This
// table repeats them for the level-up screen, and tests/game/weapons/weaponStats.test.ts runs
// the real movesets and fails when a number here drifts.

export interface WeaponMove {
  name: string
  // Damage of one hit.
  damage: number
  // Hits one target takes from the move when everything connects.
  hits: number
  // The damage of each of those hits.
  damages: number[]
  // Forward reach of the melee box in world units, 'ranged' for shots.
  reach: number | 'ranged'
  // Start of the move until the next one may cancel it, at attack speed 1.
  timeMs: number
}

export interface WeaponStats {
  name: string
  slot: WeaponSlot
  tier: 1 | 2
  moves: WeaponMove[]
  // Average damage of one hit over the whole string.
  damagePerHit: number
  attacksPerSecond: number
  // Damage per second when every hit connects, before any stat.
  damagePerSecond: number
  // Forward reach of the longest melee hitbox in world units, 'ranged' for shots.
  reach: number | 'ranged'
  note: string
}

interface Row {
  name: string
  // The damage of every hit one target takes.
  hits: number[]
  timeMs: number
  // Forward extent of the melee box, left out for shots.
  reach?: number
}

interface Entry {
  slot: WeaponSlot
  rows: [Row[], Row[]]
  notes: [string, string]
}

const row = (name: string, hits: number[], timeMs: number, reach?: number): Row => ({ name, hits, timeMs, reach })
const twice = (damage: number) => [damage, damage]
const dual = (damage: number) => [damage * 0.75, damage * 0.75]

const STAFF_LIGHT = [row('Staff jab', [12], 350, 72), row('Staff jab', [12], 350, 72), row('Staff thrust', [20], 440, 76)]
// The staff is the only weapon in both slots, so its heavy half has an entry of its own.
const STAFF_HEAVY: Entry = { slot: 'heavy', rows: [[row('Staff slam', [36], 760, 70)], [row('Staff slam', [36], 760, 70)]], notes: ['Slow overhead slam', 'Slow overhead slam'] }

// A legendary weapon has one form, so both tiers read the same rows.
const legendary = (slot: WeaponSlot, rows: Row[], note: string): Entry => ({ slot, rows: [rows, rows], notes: [note, note] })
const LFS_ROLL = Array.from({ length: 12 }, () => 12)

const TABLE: Record<PlayerWeaponId, Entry> = {
  staff: {
    slot: 'light',
    rows: [STAFF_LIGHT, STAFF_LIGHT],
    notes: ['Jab, jab, thrust', 'Jab, jab, thrust'],
  },
  wand: {
    slot: 'light',
    rows: [
      [row('Bolt', [13], 380), row('Bolt', [13], 380), row('Bolt volley', [20], 460)],
      [row('Bolt', twice(13), 380), row('Bolt', twice(13), 380), row('Bolt volley', twice(20), 460)],
    ],
    notes: ['Fires bolts at the cursor', 'Two bolts per shot'],
  },
  pipettePistol: {
    slot: 'light',
    rows: [
      [row('Droplet', [14], 330), row('Droplet', [14], 330), row('Droplet', [14], 330), row('Droplet', [17], 390)],
      [row('Droplet', [14], 330), row('Droplet', [14], 330), row('Droplet', [14], 330), row('Droplet', [17], 390)],
    ],
    notes: ['Rapid droplets at the cursor', 'Droplets pierce one enemy'],
  },
  scalpel: {
    slot: 'light',
    rows: [
      [row('Scalpel cut', [12], 320, 52), row('Scalpel cut', [12], 320, 52), row('Scalpel cut', [12], 320, 52), row('Scalpel slash', [20], 390, 52)],
      [
        row('Scalpel cut', dual(12), 320, 52),
        row('Scalpel cut', dual(12), 320, 52),
        row('Scalpel cut', dual(12), 320, 52),
        row('Scalpel slash', dual(20), 390, 52),
      ],
    ],
    notes: ['Very fast string of four', 'Every cut hits twice'],
  },
  sequenceWhip: {
    slot: 'light',
    rows: [
      [row('Whip lash', [13], 390, 74), row('Whip crack', [17], 470, 74)],
      [row('Whip lash', [13], 390, 74), row('Whip crack', [17], 470, 74)],
    ],
    notes: ['Long reach, pushes enemies away', 'Pulls enemies in'],
  },
  centrifugeDisc: {
    slot: 'heavy',
    rows: [[row('Disc throw', [30, 18], 720)], [row('Disc throw', [30, 18, 30, 18], 720)]],
    notes: ['Boomerang, hits again on return', 'Throws a high and a low disc'],
  },
  beakerHammer: {
    slot: 'heavy',
    rows: [[row('Beaker smash', [28, 9], 700, 58)], [row('Beaker smash', [30, 13], 700, 58)]],
    notes: ['Overhead smash with ground waves', 'Harder smash, bigger waves'],
  },
  bunsenStaff: {
    slot: 'heavy',
    rows: [[row('Flame cone', [7, 7, 7, 7], 720, 76)], [row('Flame cone', [8, 8, 8, 8], 720, 111)]],
    notes: ['Flame cone that burns four times', 'Longer, hotter cone'],
  },
  petriShield: {
    slot: 'heavy',
    rows: [[row('Shield stance', [28], 850, 46)], [row('Shield stance', [40], 1050, 60)]],
    notes: ['Block then bash, reflects shots', 'Longer block, harder bash'],
  },
  arcitect: legendary(
    'light',
    [row('Place Assay', [18], 370), row('Place Study', [22], 380), row('Place Investigation', [30], 460)],
    'Drops ISA blocks to stand on, shots stop at them',
  ),
  arcCommander: legendary(
    'light',
    [row('arc add', [20], 370), row('arc commit', [20], 370), row('arc sync', [28], 470)],
    'arc sync fires the enemy shots back, up to 70',
  ),
  gitLfs: legendary('heavy', [row('git lfs push', [30, ...LFS_ROLL], 760)], 'A huge file that keeps hitting as it rolls'),
  publicationPress: legendary('heavy', [row('Publish', [48], 680, 64)], 'Freezes enemies near you, the next hit shatters'),
}

// The tier 2 name is the one the card description announces ("Picking it again gives X.").
export function weaponName(id: PlayerWeaponId, tier: 1 | 2): string {
  const card = CARDS.find((c) => c.id === `weapon.${id}`)
  if (!card) return 'Staff'
  // A legendary weapon has one form and one name.
  if (tier === 1 || isLegendaryWeapon(id)) return card.name
  return /gives (.+)\.$/.exec(card.description)?.[1] ?? `${card.name} (tier 2)`
}

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0)

export function weaponStats(id: PlayerWeaponId, slot: WeaponSlot, tier: 1 | 2): WeaponStats {
  const staff = id === 'staff'
  const entry = staff && slot === 'heavy' ? STAFF_HEAVY : TABLE[id]
  if (entry.slot !== slot) throw new Error(`${id} has no ${slot} slot`)
  // The staff has no tier 2, so it always reads its tier 1 half.
  const rows = entry.rows[staff ? 0 : tier - 1]
  const moves = rows.map((r) => ({ name: r.name, damage: sum(r.hits) / r.hits.length, hits: r.hits.length, damages: r.hits, reach: r.reach ?? ('ranged' as const), timeMs: r.timeMs }))
  const totalHits = sum(rows.map((r) => r.hits.length))
  const totalDamage = sum(rows.flatMap((r) => r.hits))
  const totalMs = sum(rows.map((r) => r.timeMs))
  const reaches = rows.flatMap((r) => (r.reach === undefined ? [] : [r.reach]))
  return {
    name: weaponName(id, staff ? 1 : tier),
    slot,
    tier: staff ? 1 : tier,
    moves,
    damagePerHit: totalDamage / totalHits,
    attacksPerSecond: (rows.length * 1000) / totalMs,
    damagePerSecond: (totalDamage * 1000) / totalMs,
    reach: reaches.length > 0 ? Math.max(...reaches) : 'ranged',
    note: entry.notes[staff ? 0 : tier - 1],
  }
}

export type WeaponRelation =
  | { kind: 'upgrade'; slot: WeaponSlot; currentName: string }
  | { kind: 'replace'; slot: WeaponSlot; currentName: string }
  | { kind: 'none' }

// What a weapon card does to the build: take the same weapon to tier 2, take the slot from another
// weapon, or nothing (not a weapon card, or the weapon is already at tier 2).
export function weaponRelation(build: PlayerBuild, card: { id: string; slot?: WeaponSlot }): WeaponRelation {
  const slot = card.slot
  if (!slot) return { kind: 'none' }
  const current = build.weapons[slot]
  const currentName = weaponName(current.id, current.tier)
  if (card.id !== `weapon.${current.id}`) return { kind: 'replace', slot, currentName }
  return current.tier === 1 && !isLegendaryWeapon(current.id) ? { kind: 'upgrade', slot, currentName } : { kind: 'none' }
}
