import type { CorruptedId, PlayerBuild } from '../../contracts/progression'

// Corrupted augments: what the Datenkrake gives back for the augment it took. Each has one strong,
// often absurd boon and one harsh curse, and most of them only shine or only hurt on some builds,
// so taking one is a gamble. The numbers live in CORRUPTION, the stat parts apply here and the rest
// runs in the loadout (phaser/player/weapons/corrupted.ts), the player, the motor and the run.

export const CORRUPTION = {
  bigData: { damage: 2, taken: 1.75 },
  deprecatedJump: { maxHp: 2.5 },
  shadowIt: { dashDamage: 22, dashCooldown: 2 },
  dataLake: { healPerSecond: 0.05, moveSpeed: 0.7 },
  blockchain: { targets: 2, share: 0.5, rangeTiles: 5, hpPerAttack: 1 },
  overfitting: { same: 2.5, other: 0.5 },
  rogueAdmin: { abilityCooldown: 3 },
  dataLeak: { gain: 3, leakPerHit: 3 },
  termsOfService: { stunMs: 2000 },
  mirrorSite: { thorns: 4, mirrorMs: 2000 },
  inSilico: { ranged: 1.6, melee: 0.5 },
  inVitro: { melee: 1.6, meleeRange: 1.4, ranged: 0.4 },
  heavyMetadata: { heavy: 2.5, light: 0.5 },
  reviewer2: { every: 10, boost: 10 },
  acceptAllCookies: { maxHpPerKill: 2, everyMs: 25000, stunMs: 1000 },
  infiniteScroll: { dashCooldown: 0.25, attackSpeed: 0.6 },
} as const

export interface CorruptedAugment {
  id: CorruptedId
  name: string
  boon: string
  curse: string
  flavor: string
}

export const CORRUPTED: readonly CorruptedAugment[] = [
  {
    id: 'bigData',
    name: 'Big Data',
    boon: '+100% damage.',
    curse: 'You take 75% more damage.',
    flavor: 'Bigger is better. Also a bigger target.',
  },
  {
    id: 'deprecatedJump',
    name: 'Deprecated jump()',
    boon: 'Max HP x2.5, healed to full.',
    curse: 'You cannot jump at all. A kraken intern builds bridges and hoists you up steps.',
    flavor: 'jump() was removed in v2.0. Please use bridge() instead.',
  },
  {
    id: 'shadowIt',
    name: 'Shadow IT',
    boon: 'Your dash hits every enemy it passes for 22 damage.',
    curse: 'Dash cooldown x2.',
    flavor: 'Nobody approved this dash. It works anyway.',
  },
  {
    id: 'dataLake',
    name: 'Data Lake',
    boon: 'Standing still on the ground heals 5% of max HP per second.',
    curse: 'Move speed -30%.',
    flavor: 'Everything flows in, nothing flows out. Including you.',
  },
  {
    id: 'blockchain',
    name: 'Blockchain',
    boon: 'Each of your hits chains to the 2 nearest other enemies for 50% of its damage.',
    curse: 'Every attack you start costs 1 HP (proof of work). Never below 1 HP.',
    flavor: 'Decentralised damage, centralised suffering.',
  },
  {
    id: 'overfitting',
    name: 'Overfitting',
    boon: '+150% damage against the enemy you hit last.',
    curse: '-50% damage against every other enemy.',
    flavor: 'Perfect on the training set. Which is one enemy.',
  },
  {
    id: 'rogueAdmin',
    name: 'Rogue Admin',
    boon: 'Every hit of yours crits.',
    curse: 'Ability cooldowns x3.',
    flavor: 'sudo crit. Abilities still need a ticket.',
  },
  {
    id: 'dataLeak',
    name: 'Data Leak',
    boon: 'Ontology Fragments you collect count x3.',
    curse: 'Every hit you take leaks 3 fragments.',
    flavor: 'Easy come, easy go. Mostly go.',
  },
  {
    id: 'termsOfService',
    name: 'Terms of Service',
    boon: 'Every level-up heals you to full.',
    curse: 'After each level-up card you read the EULA for 2 s: no moving, no attacking.',
    flavor: 'By continuing to breathe you agree to page 4,012.',
  },
  {
    id: 'mirrorSite',
    name: 'Mirror Site',
    boon: 'Whoever hits you takes 4 times the damage back.',
    curse: 'Left and right swap for 2 s after every hit you take.',
    flavor: 'Same content, flipped hosting.',
  },
  {
    id: 'inSilico',
    name: 'In Silico',
    boon: 'Your shots pierce every enemy and deal +60% damage.',
    curse: 'Your melee hits deal -50% damage.',
    flavor: 'Why touch a sample when you can simulate it?',
  },
  {
    id: 'inVitro',
    name: 'In Vitro',
    boon: 'Melee hits deal +60% damage and reach 40% further.',
    curse: 'Your shots deal -60% damage.',
    flavor: 'Real science happens at arm’s length.',
  },
  {
    id: 'heavyMetadata',
    name: 'Heavy Metadata',
    boon: 'Heavy attacks deal +150% damage.',
    curse: 'Light attacks deal -50% damage.',
    flavor: 'Forty-two mandatory fields per swing.',
  },
  {
    id: 'reviewer2',
    name: 'Reviewer 2',
    boon: 'Every 10th hit of yours deals 10x damage.',
    curse: 'Your first hit on every enemy is rejected and deals nothing.',
    flavor: 'Major revisions. Then, suddenly, accept.',
  },
  {
    id: 'acceptAllCookies',
    name: 'Accept All Cookies',
    boon: 'Every kill gives +2 max HP for the rest of the run.',
    curse: 'Every 25 s a cookie banner stops you for 1 s while you click Accept.',
    flavor: 'Delicious. Tracked. Delicious.',
  },
  {
    id: 'infiniteScroll',
    name: 'Infinite Scroll',
    boon: 'Dash cooldown x0.25 and unlimited dashes in mid-air.',
    curse: 'Attack speed -40%.',
    flavor: 'Just one more dash. And one more. And one more.',
  },
]

// Two augments that cancel each other out are never given together.
const CONFLICTS: readonly (readonly [CorruptedId, CorruptedId])[] = [['inSilico', 'inVitro']]

export function corruptedAugment(id: string): CorruptedAugment | undefined {
  return CORRUPTED.find((augment) => augment.id === id || `corrupted.${augment.id}` === id)
}

// The catalog id of a corrupted augment, for the level history.
export const corruptedCardId = (id: CorruptedId): string => `corrupted.${id}`

// Corrupted augments the Datenkrake may still hand to this build: none twice and no conflicting pair.
export function corruptedChoices(build: PlayerBuild): CorruptedId[] {
  const owned = new Set(build.corrupted)
  return CORRUPTED.map((augment) => augment.id).filter(
    (id) => !owned.has(id) && !CONFLICTS.some(([a, b]) => (a === id && owned.has(b)) || (b === id && owned.has(a))),
  )
}

// Adds the augment and its stat parts. The stats go past the card limits on purpose: this is the
// place for too much.
export function applyCorrupted(build: PlayerBuild, id: CorruptedId): PlayerBuild {
  if (build.corrupted.includes(id)) return build
  const stats = { ...build.stats }
  let hp = build.hp
  if (id === 'bigData') stats.damage *= CORRUPTION.bigData.damage
  if (id === 'deprecatedJump') {
    stats.maxHp = Math.round(stats.maxHp * CORRUPTION.deprecatedJump.maxHp)
    hp = stats.maxHp
  }
  if (id === 'shadowIt') stats.dashCooldownMs *= CORRUPTION.shadowIt.dashCooldown
  if (id === 'dataLake') stats.moveSpeed *= CORRUPTION.dataLake.moveSpeed
  if (id === 'inVitro') stats.meleeRange *= CORRUPTION.inVitro.meleeRange
  if (id === 'infiniteScroll') {
    stats.dashCooldownMs *= CORRUPTION.infiniteScroll.dashCooldown
    stats.attackSpeed *= CORRUPTION.infiniteScroll.attackSpeed
  }
  return { ...build, hp, stats, corrupted: [...build.corrupted, id] }
}

export type CorruptionFlags = Record<CorruptedId, boolean>

export function corruptionFlags(build: PlayerBuild): CorruptionFlags {
  const flags = {} as CorruptionFlags
  for (const augment of CORRUPTED) flags[augment.id] = build.corrupted.includes(augment.id)
  return flags
}

// What Overfitting and Reviewer 2 remember of the mage's own hits. One per loadout.
export interface HitMemory {
  last: object | null
  seen: WeakSet<object>
  hits: number
}

export function createHitMemory(): HitMemory {
  return { last: null, seen: new WeakSet(), hits: 0 }
}

// The damage factor of a hit of the mage's own on `target`, from the tags of the hit. Shots carry
// 'projectile', everything else of the mage's own counts as melee. Updates `memory`.
export function outgoingFactor(flags: CorruptionFlags, tags: readonly string[], target: object, memory: HitMemory): number {
  const ranged = tags.includes('projectile')
  let factor = 1
  if (flags.inSilico) factor *= ranged ? CORRUPTION.inSilico.ranged : CORRUPTION.inSilico.melee
  if (flags.inVitro) factor *= ranged ? CORRUPTION.inVitro.ranged : CORRUPTION.inVitro.melee
  if (flags.heavyMetadata) {
    if (tags.includes('heavy')) factor *= CORRUPTION.heavyMetadata.heavy
    else if (tags.includes('light')) factor *= CORRUPTION.heavyMetadata.light
  }
  if (flags.overfitting) {
    factor *= memory.last === target ? CORRUPTION.overfitting.same : CORRUPTION.overfitting.other
    memory.last = target
  }
  if (flags.reviewer2) {
    memory.hits++
    const first = !memory.seen.has(target)
    memory.seen.add(target)
    // The tenth hit overrules the rejection.
    if (memory.hits % CORRUPTION.reviewer2.every === 0) factor *= CORRUPTION.reviewer2.boost
    else if (first) factor = 0
  }
  return factor
}

// The damage factor of a hit the mage takes.
export function incomingFactor(flags: CorruptionFlags): number {
  return flags.bigData ? CORRUPTION.bigData.taken : 1
}
