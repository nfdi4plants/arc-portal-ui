import type { Rng } from './rng'

export type Rarity = 'common' | 'uncommon' | 'rare' | 'legendary'
export type PowerUpKind = 'stat' | 'weapon' | 'mechanic' | 'legendary'
export type WeaponSlot = 'light' | 'heavy'

export type PlayerWeaponId =
  | 'staff' // the starting weapon, in both slots
  | 'wand'
  | 'pipettePistol'
  | 'centrifugeDisc'
  | 'scalpel'
  | 'sequenceWhip'
  | 'beakerHammer'
  | 'bunsenStaff'
  | 'petriShield'

export type MechanicId =
  | 'doubleJump'
  | 'airDash'
  | 'wallJump'
  | 'tripleCombo'
  | 'groundSlam'
  | 'parry'
  | 'hatGlide'
  | 'lifesteal'
  | 'reflectDash'
  | 'echoStrike'
  | 'shockwaveHeavy'
  | 'familiar'
  | 'extraChoice'
  | 'serialDilution'
  | 'centrifugeSpin'
  | 'fumeHood'
  | 'sampleFreeze'
  | 'citationNeeded'
  | 'autoclave'
  | 'secondWind'

export type LegendaryId = 'theOntology' | 'gitRevert' | 'doiExcalibur' | 'fairPrinciples' | 'peerReview' | 'peerPressure' | 'labCoat'

// Corrupted augments come only from the Datenkrake in a waystation: one strong boon and one harsh
// curse each (model/progression/corrupted.ts).
export type CorruptedId =
  | 'bigData'
  | 'deprecatedJump'
  | 'shadowIt'
  | 'dataLake'
  | 'blockchain'
  | 'overfitting'
  | 'rogueAdmin'
  | 'dataLeak'
  | 'termsOfService'
  | 'mirrorSite'
  | 'inSilico'
  | 'inVitro'
  | 'heavyMetadata'
  | 'reviewer2'
  | 'acceptAllCookies'
  | 'infiniteScroll'

export interface PlayerStats {
  maxHp: number
  // Multipliers, 1 is the base value.
  moveSpeed: number
  attackSpeed: number
  damage: number
  meleeRange: number
  // 0 to 1.
  critChance: number
  critMultiplier: number
  dashCooldownMs: number
  // Share of damage dealt that heals, 0 to 1.
  lifesteal: number
}

export interface PlayerBuild {
  level: number
  // XP collected towards the next level.
  xp: number
  hp: number
  stats: PlayerStats
  // Tier 2 is the upgraded ("dual") version, reached by picking the same weapon again.
  weapons: Record<WeaponSlot, { id: PlayerWeaponId; tier: 1 | 2 }>
  mechanics: MechanicId[]
  legendaries: LegendaryId[]
  // Four slots, bound to the ability1 to ability4 actions (Q, E, R, F by default).
  abilitySlots: (MechanicId | LegendaryId | null)[]
  // Cards per level-up: 3, or 4 with extraChoice.
  offerSize: number
  // Given by the Datenkrake, in the order received.
  corrupted: CorruptedId[]
}

export interface PowerUpCard {
  // Catalog id such as 'stat.swiftFeet', 'weapon.wand' or 'mechanic.doubleJump'.
  id: string
  name: string
  description: string
  rarity: Rarity
  kind: PowerUpKind
  // Weapons only.
  slot?: WeaponSlot
}

export type CreateBuild = () => PlayerBuild
export type XpForNextLevel = (level: number) => number
export type AddXp = (build: PlayerBuild, xp: number) => { build: PlayerBuild; levelsGained: number }
export type RollOffer = (build: PlayerBuild, rng: Rng) => PowerUpCard[]
export type ApplyCard = (build: PlayerBuild, cardId: string) => PlayerBuild
