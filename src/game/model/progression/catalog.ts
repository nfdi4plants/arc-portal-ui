import type { LegendaryId, MechanicId, PlayerWeaponId, PowerUpCard } from '../../contracts/progression'

export const CARDS: readonly PowerUpCard[] = [
  {
    id: 'stat.swiftFeet',
    name: 'Fast Track',
    description: '+12% move speed.',
    rarity: 'common',
    kind: 'stat',
  },
  {
    id: 'stat.quickHands',
    name: 'High Throughput',
    description: '+12% attack speed.',
    rarity: 'common',
    kind: 'stat',
  },
  {
    id: 'stat.sharpened',
    name: 'Impact Factor',
    description: '+15% damage.',
    rarity: 'common',
    kind: 'stat',
  },
  {
    id: 'stat.keenEye',
    name: 'Quality Control',
    description: '+5 points of crit chance.',
    rarity: 'common',
    kind: 'stat',
  },
  {
    id: 'stat.freshBattery',
    name: 'Rapid Release',
    description: 'Dash cooldown 0.5 s shorter, down to 1 s.',
    rarity: 'common',
    kind: 'stat',
  },
  {
    id: 'stat.thickRobe',
    name: 'Redundant Storage',
    description: '+15% max HP. Heals the amount gained.',
    rarity: 'common',
    kind: 'stat',
  },
  {
    id: 'stat.longReach',
    name: 'Extended Scope',
    description: 'Melee weapons: +15% melee range. Shots are not affected.',
    rarity: 'common',
    kind: 'stat',
  },
  {
    id: 'weapon.wand',
    name: 'Wand',
    description: 'Light attack that fires bolts. Picking it again gives Overclocked Wand.',
    rarity: 'uncommon',
    kind: 'weapon',
    slot: 'light',
  },
  {
    id: 'weapon.pipettePistol',
    name: 'Pipette Pistol',
    description: 'Light attack that fires rapid droplets. Picking it again gives Overclocked Pipette Pistol.',
    rarity: 'uncommon',
    kind: 'weapon',
    slot: 'light',
  },
  {
    id: 'weapon.scalpel',
    name: 'Scalpel',
    description: 'Light attack with fast melee strikes. Picking it again gives Dual Scalpels.',
    rarity: 'uncommon',
    kind: 'weapon',
    slot: 'light',
  },
  {
    id: 'weapon.sequenceWhip',
    name: 'Sequence Whip',
    description: 'Light attack with long reach. Picking it again gives Overclocked Sequence Whip.',
    rarity: 'uncommon',
    kind: 'weapon',
    slot: 'light',
  },
  {
    id: 'weapon.centrifugeDisc',
    name: 'Centrifuge Disc',
    description: 'Heavy attack that throws a boomerang disc. Picking it again gives Overclocked Centrifuge Disc.',
    rarity: 'uncommon',
    kind: 'weapon',
    slot: 'heavy',
  },
  {
    id: 'weapon.beakerHammer',
    name: 'Beaker Hammer',
    description: 'Heavy attack with a shockwave. Picking it again gives Overclocked Beaker Hammer.',
    rarity: 'uncommon',
    kind: 'weapon',
    slot: 'heavy',
  },
  {
    id: 'weapon.bunsenStaff',
    name: 'Bunsen Staff',
    description: 'Heavy attack with a flame cone. Picking it again gives Overclocked Bunsen Staff.',
    rarity: 'uncommon',
    kind: 'weapon',
    slot: 'heavy',
  },
  {
    id: 'weapon.petriShield',
    name: 'Petri Shield',
    description: 'Heavy attack that reflects projectiles, then bashes. It does not block melee. Picking it again gives Overclocked Petri Shield.',
    rarity: 'uncommon',
    kind: 'weapon',
    slot: 'heavy',
  },
  // Legendary weapons come at full power. There is no tier 2 to reach, so a second copy is never
  // offered.
  {
    id: 'weapon.arcitect',
    name: 'ARCitect',
    description:
      'Legendary light build tool. Each light press drops an ISA block a little ahead: an Assay, a Study, then an Investigation, each one bigger. The drop hits what is under it for 18, 22 and 30 and launches it. A block stands for 4 s, 3 at most: you can stand on it, and enemy shots stop at it.',
    rarity: 'legendary',
    kind: 'weapon',
    slot: 'light',
  },
  {
    id: 'weapon.arcCommander',
    name: 'ARC Commander',
    description:
      'Legendary light terminal. Types arc add and arc commit at the cursor. The third command, arc sync, pulls in every enemy shot within 5 tiles and fires them back as one blast: 28 damage plus 10 per shot, up to 70.',
    rarity: 'legendary',
    kind: 'weapon',
    slot: 'light',
  },
  {
    id: 'weapon.gitLfs',
    name: 'Git LFS',
    description:
      'Legendary heavy throw. Hurls one enormous file that hits for 30, then rolls slowly on for 2.4 s and hits everything in it for 12 every 0.2 s.',
    rarity: 'legendary',
    kind: 'weapon',
    slot: 'heavy',
  },
  {
    id: 'weapon.publicationPress',
    name: 'Publication Press',
    description:
      'Legendary heavy stamp. The slam publishes every enemy within 7 tiles: immutable statues for 1.8 s (bosses only slow down). Your next hit on a statue shatters it for 60% more plus 25.',
    rarity: 'legendary',
    kind: 'weapon',
    slot: 'heavy',
  },
  {
    id: 'mechanic.doubleJump',
    name: 'Double Blind',
    description: 'Jump once more in the air.',
    rarity: 'uncommon',
    kind: 'mechanic',
  },
  {
    id: 'mechanic.airDash',
    name: 'Cloud Upload',
    description: 'Dash in mid-air.',
    rarity: 'uncommon',
    kind: 'mechanic',
  },
  {
    id: 'mechanic.serialDilution',
    name: 'Diminishing Returns',
    description:
      'Air heavies that hit can be chained before you land. The first bounce is as high as a jump, each next one lower (75%, 50%, 30%, 15% of it). Up to 5 air heavies per airtime. Bounces give back no jump or air dash.',
    rarity: 'uncommon',
    kind: 'mechanic',
  },
  {
    id: 'mechanic.wallJump',
    name: 'Paywall Jump',
    description: 'Jump off a wall.',
    rarity: 'rare',
    kind: 'mechanic',
  },
  {
    id: 'mechanic.tripleCombo',
    name: 'Triplicate',
    description: 'Light weapons: adds a spin finisher after the last hit of your light string. It hits in front and behind.',
    rarity: 'rare',
    kind: 'mechanic',
  },
  {
    id: 'mechanic.groundSlam',
    name: 'Data Dump',
    description: 'Heavy attacks in the air: the landing reaches 50% further and sends two shockwaves along the ground.',
    rarity: 'rare',
    kind: 'mechanic',
  },
  {
    id: 'mechanic.parry',
    name: 'Rebuttal',
    description: 'Takes an ability slot. For 200 ms, a hit that lands on you is undone and answered with a counter strike.',
    rarity: 'rare',
    kind: 'mechanic',
  },
  {
    id: 'mechanic.hatGlide',
    name: 'Graceful Degradation',
    description: 'Hold jump while falling to glide slowly.',
    rarity: 'rare',
    kind: 'mechanic',
  },
  {
    id: 'mechanic.lifesteal',
    name: 'Data Reuse',
    description: 'Heal 8% of the damage your attacks, bolts and Preprint dash deal. Reproducibility, DOI, Ontology, Peer Review and other ability hits do not heal.',
    rarity: 'rare',
    kind: 'mechanic',
  },
  {
    id: 'mechanic.reflectDash',
    name: 'Revise and Resubmit',
    description: 'Dashing reflects enemy shots. Bombs, falling debris and ground waves pass through.',
    rarity: 'rare',
    kind: 'mechanic',
  },
  {
    id: 'mechanic.echoStrike',
    name: 'Reproducibility',
    description: 'Light weapons: each hit strikes again 150 ms later for half its damage.',
    rarity: 'rare',
    kind: 'mechanic',
  },
  {
    id: 'mechanic.shockwaveHeavy',
    name: 'Downstream Effects',
    description: 'Heavy weapons: every heavy attack sends ground waves out to both sides.',
    rarity: 'rare',
    kind: 'mechanic',
  },
  {
    id: 'mechanic.familiar',
    name: 'Research Assistant',
    description: 'Takes an ability slot. A spark assistant orbits you and shoots the nearest enemy. The ability fires a burst of five bolts.',
    rarity: 'rare',
    kind: 'mechanic',
  },
  {
    id: 'mechanic.centrifugeSpin',
    name: 'Data Aggregation',
    description:
      'Takes an ability slot. You whirl for 0.6 s and hit every enemy within 4 tiles 4 times for 5 damage each (more with damage bonuses), pulling it towards you. Bosses, turrets and boss minions are not pulled. Cooldown 8 s.',
    rarity: 'uncommon',
    kind: 'mechanic',
  },
  {
    id: 'mechanic.fumeHood',
    name: 'Rate Limit',
    description:
      'Takes an ability slot. Sets up a rate-limited zone 5 tiles wide in front of you for 4 s. Enemy shots inside it fly at 30% speed, and enemies inside move and attack 30% slower (bosses 15%). Bombs, falling debris and ground waves pass at full speed. Cooldown 12 s.',
    rarity: 'uncommon',
    kind: 'mechanic',
  },
  {
    id: 'mechanic.sampleFreeze',
    name: 'Data Freeze',
    description:
      'Takes an ability slot. Freezes enemies in a 6-tile cone in front of you for 1.5 s: they stop moving and attacking. Bosses are never frozen, they run at half speed for 1.5 s instead. Cooldown 14 s.',
    rarity: 'rare',
    kind: 'mechanic',
  },
  {
    id: 'mechanic.citationNeeded',
    name: 'Citation Needed',
    description:
      'Takes an ability slot. Marks the nearest enemy or boss in front of you within 13 tiles for 6 s. Your attacks, shots and Preprint dash deal 30% extra damage to it. Other bonus hits (Reproducibility, Ontology, Peer Review, other abilities) get no extra. Without an enemy in reach nothing happens and no cooldown starts. Cooldown 10 s.',
    rarity: 'uncommon',
    kind: 'mechanic',
  },
  {
    id: 'mechanic.autoclave',
    name: 'Firewall',
    description:
      'Takes an ability slot. A firewall burst blocks every hit on you for 0.4 s and knocks enemies within 3 tiles away for 8 damage. Bosses, turrets and boss minions are not moved, and the burst does not fill a boss stagger bar. Cooldown 16 s.',
    rarity: 'rare',
    kind: 'mechanic',
  },
  {
    id: 'mechanic.secondWind',
    name: 'Backup Restore',
    description:
      'Takes an ability slot. Heals 50% of max HP once. Then it is spent until you defeat the next boss, and it also recharges before the final boss. At full HP it does nothing and stays charged.',
    rarity: 'uncommon',
    kind: 'mechanic',
  },
  {
    id: 'mechanic.extraChoice',
    name: 'Open Access',
    description: 'Level-up offers four cards instead of three.',
    rarity: 'rare',
    kind: 'mechanic',
  },
  {
    id: 'legendary.theOntology',
    name: 'The Ontology',
    description: 'Your hits tag enemies. Hitting a tagged enemy deals 50% extra, and 30% of that boosted hit (45% of the original) passes to the nearest other tagged enemy.',
    rarity: 'legendary',
    kind: 'legendary',
  },
  {
    id: 'legendary.gitRevert',
    name: 'Git Revert',
    description: 'Takes an ability slot. Once per fight, a lethal hit rewinds you 5 seconds instead. Press the ability to rewind on purpose.',
    rarity: 'legendary',
    kind: 'legendary',
  },
  {
    id: 'legendary.doiExcalibur',
    name: 'DOI Excalibur',
    description: 'Every heavy attack also hits each enemy on screen for 60% of its damage.',
    rarity: 'legendary',
    kind: 'legendary',
  },
  {
    id: 'legendary.fairPrinciples',
    name: 'FAIR Principles',
    description: 'Four letters orbit you. F adds 20% damage, A shoots the nearest enemy every 2 seconds, I grants a shield every 8 seconds when you have none and R regenerates 1 HP per second.',
    rarity: 'legendary',
    kind: 'legendary',
  },
  {
    id: 'legendary.peerReview',
    name: 'Peer Review',
    description: 'Every third hit summons a reviewer that replays your last three hits or shots.',
    rarity: 'legendary',
    kind: 'legendary',
  },
  {
    id: 'legendary.peerPressure',
    name: 'Peer Pressure',
    description:
      'Takes an ability slot. Every enemy on screen takes 40 damage (more with damage bonuses) and is pushed away from you, and enemy shots on screen vanish. Bosses are not pushed. Bombs, falling debris and ground waves stay. Cooldown 40 s.',
    rarity: 'legendary',
    kind: 'legendary',
  },
  {
    id: 'legendary.labCoat',
    name: 'Preprint',
    description:
      'Takes an ability slot. A super-dash of about 10 tiles over 0.28 s, the way you hold or face, that hits every enemy it passes for 30 damage (more with damage bonuses and crits). Hits miss you for 0.45 s from its start. Cooldown 30 s.',
    rarity: 'legendary',
    kind: 'legendary',
  },
]

// Cards with these ids take the first free slot in abilitySlots when picked.
export const ABILITY_IDS: readonly (MechanicId | LegendaryId)[] = [
  'parry',
  'familiar',
  'gitRevert',
  'centrifugeSpin',
  'fumeHood',
  'sampleFreeze',
  'citationNeeded',
  'autoclave',
  'secondWind',
  'peerPressure',
  'labCoat',
]

// The legendary weapons, which come at full power (tier 2) and have no upgrade.
export const LEGENDARY_WEAPON_IDS: readonly PlayerWeaponId[] = ['arcitect', 'arcCommander', 'gitLfs', 'publicationPress']

export function isLegendaryWeapon(id: PlayerWeaponId): boolean {
  return LEGENDARY_WEAPON_IDS.includes(id)
}
