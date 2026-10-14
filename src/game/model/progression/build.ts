import type {
  AddXp,
  ApplyCard,
  CreateBuild,
  LegendaryId,
  MechanicId,
  PlayerBuild,
  PlayerWeaponId,
  WeaponSlot,
  XpForNextLevel,
} from '../../contracts/progression'
import { ABILITY_IDS } from './catalog'
import { weaponStats } from './weaponStats'

// dashCooldownMs is a floor. Fresh battery stops applying once the cooldown reaches it.
export const STAT_CAPS = {
  moveSpeed: 1.8,
  attackSpeed: 2.5,
  damage: 4,
  meleeRange: 1.8,
  critChance: 0.6,
  dashCooldownMs: 1000,
} as const

interface Effect {
  applies: (build: PlayerBuild) => boolean
  apply: (build: PlayerBuild) => PlayerBuild
}

type CappedStat = 'moveSpeed' | 'attackSpeed' | 'damage' | 'meleeRange' | 'critChance'
type WeaponState = PlayerBuild['weapons'][WeaponSlot]

export const createBuild: CreateBuild = () => ({
  level: 1,
  xp: 0,
  hp: 100,
  stats: {
    maxHp: 100,
    moveSpeed: 1,
    attackSpeed: 1,
    damage: 1,
    meleeRange: 1,
    critChance: 0.05,
    critMultiplier: 1.5,
    dashCooldownMs: 2000,
    lifesteal: 0,
  },
  weapons: {
    light: { id: 'staff', tier: 1 },
    heavy: { id: 'staff', tier: 1 },
  },
  mechanics: [],
  legendaries: [],
  abilitySlots: [null, null, null, null],
  offerSize: 3,
})

export const xpForNextLevel: XpForNextLevel = (level) => 20 + 10 * (level - 1)

export const addXp: AddXp = (build, amount) => {
  let { level, hp, xp } = build
  let maxHp = build.stats.maxHp
  let levelsGained = 0
  xp += amount
  while (xp >= xpForNextLevel(level)) {
    xp -= xpForNextLevel(level)
    level += 1
    levelsGained += 1
    maxHp = Math.round(maxHp * 1.1)
    hp = Math.min(maxHp, hp + Math.round(0.3 * maxHp))
  }
  return {
    build: { ...build, level, xp, hp, stats: { ...build.stats, maxHp } },
    levelsGained,
  }
}

function raiseStat(field: CappedStat, update: (value: number) => number, usable: (build: PlayerBuild) => boolean = () => true): Effect {
  return {
    applies: (build) => build.stats[field] < STAT_CAPS[field] && usable(build),
    apply: (build) => ({
      ...build,
      stats: { ...build.stats, [field]: Math.min(STAT_CAPS[field], update(build.stats[field])) },
    }),
  }
}

// Melee range scales melee hitboxes only, so a build with two shooting weapons gains nothing from it.
const hasMeleeWeapon = (build: PlayerBuild): boolean =>
  (['light', 'heavy'] as const).some((slot) => weaponStats(build.weapons[slot].id, slot, build.weapons[slot].tier).reach !== 'ranged')

// Each Fresh Battery card takes this much off the dash cooldown, so two cards reach the floor.
const FRESH_BATTERY_MS = 500

const freshBattery: Effect = {
  applies: (build) => build.stats.dashCooldownMs > STAT_CAPS.dashCooldownMs,
  apply: (build) => ({
    ...build,
    stats: { ...build.stats, dashCooldownMs: Math.max(STAT_CAPS.dashCooldownMs, build.stats.dashCooldownMs - FRESH_BATTERY_MS) },
  }),
}

// The heal equals the max HP gained, so a build at full health stays at full health.
const thickRobe: Effect = {
  applies: () => true,
  apply: (build) => {
    const maxHp = Math.round(build.stats.maxHp * 1.15)
    return { ...build, hp: build.hp + maxHp - build.stats.maxHp, stats: { ...build.stats, maxHp } }
  },
}

function weapon(slot: WeaponSlot, id: PlayerWeaponId): Effect {
  return {
    applies: (build) => !(build.weapons[slot].id === id && build.weapons[slot].tier === 2),
    apply: (build) => {
      const next: WeaponState = build.weapons[slot].id === id ? { id, tier: 2 } : { id, tier: 1 }
      return { ...build, weapons: { ...build.weapons, [slot]: next } }
    },
  }
}

function placeAbility(
  slots: PlayerBuild['abilitySlots'],
  id: MechanicId | LegendaryId,
): PlayerBuild['abilitySlots'] {
  return slots.with(slots.indexOf(null), id)
}

function mechanic(id: MechanicId, change: (build: PlayerBuild) => PlayerBuild = (build) => build): Effect {
  const isAbility = ABILITY_IDS.includes(id)
  return {
    applies: (build) => !build.mechanics.includes(id) && (!isAbility || build.abilitySlots.includes(null)),
    apply: (build) => {
      const changed = change(build)
      return {
        ...changed,
        mechanics: [...changed.mechanics, id],
        abilitySlots: isAbility ? placeAbility(changed.abilitySlots, id) : changed.abilitySlots,
      }
    },
  }
}

function legendary(id: LegendaryId): Effect {
  const isAbility = ABILITY_IDS.includes(id)
  return {
    applies: (build) => !build.legendaries.includes(id) && (!isAbility || build.abilitySlots.includes(null)),
    apply: (build) => ({
      ...build,
      legendaries: [...build.legendaries, id],
      abilitySlots: isAbility ? placeAbility(build.abilitySlots, id) : build.abilitySlots,
    }),
  }
}

const EFFECTS = new Map<string, Effect>([
  ['stat.swiftFeet', raiseStat('moveSpeed', (value) => value * 1.12)],
  ['stat.quickHands', raiseStat('attackSpeed', (value) => value * 1.12)],
  ['stat.sharpened', raiseStat('damage', (value) => value * 1.15)],
  ['stat.keenEye', raiseStat('critChance', (value) => value + 0.05)],
  ['stat.freshBattery', freshBattery],
  ['stat.thickRobe', thickRobe],
  ['stat.longReach', raiseStat('meleeRange', (value) => value * 1.15, hasMeleeWeapon)],
  ['weapon.wand', weapon('light', 'wand')],
  ['weapon.pipettePistol', weapon('light', 'pipettePistol')],
  ['weapon.scalpel', weapon('light', 'scalpel')],
  ['weapon.sequenceWhip', weapon('light', 'sequenceWhip')],
  ['weapon.centrifugeDisc', weapon('heavy', 'centrifugeDisc')],
  ['weapon.beakerHammer', weapon('heavy', 'beakerHammer')],
  ['weapon.bunsenStaff', weapon('heavy', 'bunsenStaff')],
  ['weapon.petriShield', weapon('heavy', 'petriShield')],
  ['mechanic.doubleJump', mechanic('doubleJump')],
  ['mechanic.airDash', mechanic('airDash')],
  ['mechanic.wallJump', mechanic('wallJump')],
  ['mechanic.tripleCombo', mechanic('tripleCombo')],
  ['mechanic.groundSlam', mechanic('groundSlam')],
  ['mechanic.parry', mechanic('parry')],
  ['mechanic.hatGlide', mechanic('hatGlide')],
  ['mechanic.lifesteal', mechanic('lifesteal', (build) => ({ ...build, stats: { ...build.stats, lifesteal: 0.08 } }))],
  ['mechanic.reflectDash', mechanic('reflectDash')],
  ['mechanic.echoStrike', mechanic('echoStrike')],
  ['mechanic.shockwaveHeavy', mechanic('shockwaveHeavy')],
  ['mechanic.familiar', mechanic('familiar')],
  ['mechanic.extraChoice', mechanic('extraChoice', (build) => ({ ...build, offerSize: 4 }))],
  ['mechanic.serialDilution', mechanic('serialDilution')],
  ['mechanic.centrifugeSpin', mechanic('centrifugeSpin')],
  ['mechanic.fumeHood', mechanic('fumeHood')],
  ['mechanic.sampleFreeze', mechanic('sampleFreeze')],
  ['mechanic.citationNeeded', mechanic('citationNeeded')],
  ['mechanic.autoclave', mechanic('autoclave')],
  ['mechanic.secondWind', mechanic('secondWind')],
  ['legendary.theOntology', legendary('theOntology')],
  ['legendary.gitRevert', legendary('gitRevert')],
  ['legendary.doiExcalibur', legendary('doiExcalibur')],
  ['legendary.fairPrinciples', legendary('fairPrinciples')],
  ['legendary.peerReview', legendary('peerReview')],
  ['legendary.peerPressure', legendary('peerPressure')],
  ['legendary.labCoat', legendary('labCoat')],
])

export const canApply = (build: PlayerBuild, cardId: string): boolean => {
  const effect = EFFECTS.get(cardId)
  return effect !== undefined && effect.applies(build)
}

export const applyCard: ApplyCard = (build, cardId) => {
  const effect = EFFECTS.get(cardId)
  if (!effect) throw new Error(`Unknown power-up card: ${cardId}`)
  return effect.applies(build) ? effect.apply(build) : build
}
