# ARCade

ARCade is a 2D side-scrolling action platformer that runs inside the ARC dashboard
(`ArcGameDashlet` in `src/components/ArcDashboard/Game/`). The mage walks one input to output path
through an ARC's provenance. Every ISA annotation on the way is a mob and every node after a step is
a boss. The final boss is the ARC itself. A well-annotated path gives more XP and bosses whose
attacks are easier to read.

The game runs on Phaser 4.2.1 with Arcade physics. Everything except the mage sprite
(`assets/ARCMage.png`) is drawn at runtime with roughjs. Phaser and roughjs load in a lazy chunk
when the player presses Start run.

## How a run is built

The game reads the `ProvenanceIndex` from `src/arc/provenance`. It never parses the crate a second
time. `model/run/` turns the index into a `RunPlan`:

1. Path selection. The inputs are the nodes that no row produces from another node (a row that
   outputs its own input does not count). They are ranked by the longest path to
   an output, and the run seed picks one from the top 20 % (at least one). The run then follows a
   longest path, and the seed breaks ties.
2. Segments. Each step `fromNode -> toNode` is one segment. Its annotations are the process
   signature annotations of every row linking exactly that pair, from every ISA column, deduplicated.
   Each annotation becomes one mob, with no cap.
3. Quality. `quality = min(1, annotations / 8)`.
4. Telegraph. Heavy boss attacks warn `telegraphMs = 80 + 820 * quality` ms ahead. At quality 0 the
   boss also hides its hp bar and attack names. More quality brings safe zones, weak points,
   visible tells (the node's own annotations), a longer stagger and a smaller stagger bar
   (`bosses/stagger.ts`): a boss at quality 0 is nearly unstaggerable.

The node after each segment is a boss, see [Bosses](#bosses). A beaten node boss leaves a portal to
a waystation, see [The waystation](#the-waystation), and the exit portal of the waystation leads to
the next step, or to the final boss after the last node. The player is healed to full before the
final boss. The same annotation always has the same look and kind, because the monster is
derived from a hash of the annotation. Its stats scale with the segment depth,
`1 + 0.12 * segmentIndex`.

On the death screen a boss (or final boss phase) whose step has 8 or more annotations (quality 1)
gets no annotate hint, because its attacks already have the longest warnings.

The death and victory screens show a "Your run" recap (`RunRecapPanel` in `phaser/scenes/`):
every augment of the run in the order it was taken (`runRecap` in `levelHistory.ts`), with "Lv 4"
or "Bought", a rarity mark, the card name, the slot of a weapon and its tier 2 name when it was
picked twice, and the price of a purchase. Skipped levels show faintly. Hovering an entry shows its
card text under the list, and the wheel or a drag scrolls a long list a row at a time. The final
build sits beside it (`BuildPanel`). Views at least 600 units wide put the recap beside the end
text, narrower ones open it with the "Your run (B)" button as an overlay with larger text.

## Portals

Every door and portal that leads to another scene, the door at the end of a stretch, the portal a
beaten node boss leaves and the exit portal of the waystation, is entered with the interact key,
the `up` action (W by default), never by walking in. Standing in one shows a prompt over its sign
with the key of the current binding, `[W] Enter`, the same prompt the FAIR trader shows for
`[W] Trade` (`showPrompt` in `GameplayScene`). The rules are pure, in
`phaser/scenes/interaction.ts`:

- Only a fresh press of up counts. Up held from before, while running into the door, does nothing.
- An up press with light or heavy pressed in the same step is an up attack, not an interaction, so
  an up attack next to a door plays and the mage stays. A plain up press starts no attack, so the
  press that enters never swings.
- A portal that is still forming shows no prompt and takes nobody, and a portal held shut says why
  instead (`portalOffer` returns `'blocked'`).

## Bosses

A boss is built like a monster, from slots that annotations fill (`bossGenome` in
`model/content/bossGenome.ts`). A node boss reads only the annotations of its own step, the segment
that leads into it, so nothing carries over from earlier bosses, and the same step always gives the
same boss. The slots follow good annotation practice:

| Slot | Filled by | Effect |
|---|---|---|
| Key (1) | the annotation key most annotations of the step share, ties broken by hash | the silhouette, one of the four archetypes, like a monster's key picks its body. The size follows the number of annotations: small (up to 2, drawn at 0.9), medium (up to 7) or large (8 or more, 1.12). A step without annotations takes the silhouette of its node kind |
| Heavy 1 and 2 | annotations with an ontology term | the accession picks a telegraphed heavy attack: slam, rain, charge, beam, shockwave, pillars or sweep |
| Light 1 and 2 | annotations with a value and a unit | value and unit pick a light attack: sweep, projectile fan, charge, rain or summon |
| Mechanic 1 to 3 | one per annotation type on the step, the most common first | characteristic: armored front (40% less from the front), parameter: overclocked (below 40% hp the attacks recharge 30% faster), factor: phase shift (at half hp the light attacks change), component: summoner (a minion every 11 s), protocol: spill (a marked floor patch that burns), performer: teleport, date: shield pulse (blocks hits for 1.4 s), comment: mirror (sends the mage's shots back while a heavy attack winds up) |
| Theme | the units of the values with a unit, the most common family | time: tempo (15% faster recharge), temperature: heat (flame shots, light attacks 15% harder), length: reach (sweeps, charges and beams 25% longer), mass, amount or volume: dense (15% more hp), other units: precise (two more shots per fan, drops aim at the mage more often) |

So 9 slots in all. An empty first heavy or light slot falls back to a plain attack of the
archetype and counts as empty, so every boss keeps one heavy and one light attack, and a light and
a heavy attack never share a kind. The rhythm stays as before: the scheduler never plays two heavy
attacks in a row while the boss has a light one, and a heavy attack locks the stagger bar. The
timed mechanics (summoner, spill, teleport, shield) start only while the boss stands idle, one at a
time and at least 2.5 s apart, the boss starts no attack while a spill is marked or burns, and the
shield never rises in the punish window right after a heavy attack (`phaser/bosses/mechanics.ts`).

A boss arena has a row of one-way platforms, 60 units over the floor and 3 tiles wide
(`arenaPlatforms` in `phaser/bosses/zones.ts`). A platform is a dodge, not a hiding place
(`phaser/bosses/reach.ts`). The floor attacks miss a mage up there: the shockwave and the flood, the
quake, the floor charge, the low and high sweeps (the high swing stays under the platforms) and the
pillars, which stop at the underside of a platform. Once the mage has stood on the platforms for 2 s
(`CAMP_MS`, jumps on a platform count, time on the floor takes twice as much off), the boss camps
them out:

- It picks only attacks that reach the platforms, weighted by `CAMP_WEIGHT`: the leap or root arm,
  the platform rain and the high or aimed beam most, then the fan and the pillars, then the sweep,
  the charge and the summon. It never picks the shockwave then, and while only that one is ready
  it waits. Every light kind reaches, so every boss has an attack that does. The light and heavy
  rhythm and the stagger lock stay as they are.
- Those attacks play their platform versions: the slam never quakes, the heavy rain falls on the
  platforms, the beam aims or runs high, the sweep swings at platform height (from the middle of the
  boss, so standing right above it does not dodge it), the charge leaps to platform height and
  dashes through the air, and a pillar under a platform bursts through it. Each spares the floor or
  leaves gaps on the platform and keeps its telegraph, so dropping down or stepping aside dodges it.
- The treant walks up to the mage, the daemon blinks closer (70 to 120 units instead of 150 to
  250), and the teleport mechanic lands 60 to 110 units from a mage on a platform.

The spill lands on the platform the mage stands on and covers most of it, with its usual 0.9 s
warning. The minions walk at 54 units per second, a quarter of the mage's run, and chase a mage on a
platform: they walk to a spot just beside it, crouch for 0.38 s and hop up in 0.56 s. A minion on a
platform the mage has left walks off the edge and drops. The shots of the fan and the mirror aim at
the middle of the mage, height included, and end at the walls, the floor or the ceiling.

The quality of the step (`annotations / 8`) alone still drives the telegraph time, the hp bar and
attack names, the safe zones, the weak points, the stagger window and the stagger bar size. It also
sets a damage multiplier, `1 + 0.55 * (1 - quality)`: 1 at quality 1 up to 1.55 at quality 0, on
every boss attack, the minions, the spill and the mirrored shots. No single boss hit deals more
than `MAX_BOSS_HIT` (35), and the mage starts with 100 hp. A well-annotated boss can be followed by
a poorly annotated one with short warnings, a large stagger bar and harder hits.

The final boss is the ARC itself, with one phase per segment in path order. Each phase is built
from the genome of its own step, so the fight replays the path: the first heavy slot, the light
slots, the first two mechanics and the theme, plus the shared Crate Collapse. A phase moves like the
archetype of its genome and uses its step's telegraph timing.

When a node boss falls, its fragments drop where it fell, and a portal forms in the middle of the
arena on the floor, wherever the boss died (`phaser/scenes/bossPortal.ts`, timeline in
`portalSpawn.ts`). Forming takes 3 s (`PORTAL_SPAWN_MS`): a swirl grows from a point, sparks spiral
in and the arch draws in from the floor up, dim and flickering under an "Opening…" sign. Then a
flash, a pulse of the swirl and the sign "To the waystation" with the next step show that it is
open. Only from then on does the `[W] Enter` prompt show over it, and the interact key takes a mage
standing in it through (see [Portals](#portals)), so nobody goes through by chance. The portal clock runs with the world, so
the level-up screen for the boss XP, the pause menu and hit-stop hold it. A platform over the middle
of the arena may cross the arch. The arch is drawn behind it, and the enter box is the lower two
tiles of the arch, so a mage standing on that platform gets no prompt. The textures (arch, swirl, spark,
glow) are drawn when the fight starts, and the sparks are created once per portal.

In the fight, badges over the boss show its mechanics and its theme (`art/bossMarkers.ts`, drawn
once and cached), and the body is the cached archetype texture drawn at the genome size. In the
pause menu the boss can be hovered and clicked like a mob. The panel lists every slot: the
annotation that filled it and the trait it gave, or what was missing ("no ontology term on this
step, slot stays empty", "no value with a unit, no theme modifier"), and a quality row such as
"6 of 8 annotations on illumina → telegraph 695 ms, stagger bar ×1.3, hits ×1.14"
(`model/content/describeBoss.ts`). The final boss shows the phase it is in.

The level-up screen opens with a summary (`levelUpSummary` in `model/progression/levelUpSummary.ts`):
"Level up!" pops in with sparkles, then "Level 3 → 4", max HP and HP counting up from their old
values with the gain and the heal, the legendary chance per card while no legendary is owned and it
still grows, and the XP towards the next level. `RunDirector` keeps the build from just before the
first pending level, so several levels gained at once show as one summary with the totals ("Level
1 → 3", "2 cards to choose, one per level"), followed by one card choice per level ("1 of 2").
The "Choose a card" button and the keys Enter, Space and 1 lead on, but only after 600 ms
(`SUMMARY_GUARD_MS`), so a click or key still going from the fight does not skip it. The cards fly
in after that and can be chosen at once: by a left click that starts and ends on the card, or by
the keys 1 to 4. Hovering a card for about 600 ms (or pressing ? over it) opens its details, built
by `cardDetails` in `model/progression/details.ts`. The mouse button is the `CHOOSE_BUTTON` constant
in `LevelUpScene.ts`. Store purchases gain no level and show no summary.

The hit area of a card on the level-up screen and in the store is the box around every pose the card
takes, tilted at rest or lifted and grown under the pointer (`cardHitRect` in
`phaser/scenes/cardHit.ts`), so a click anywhere on the drawn card counts. The card zones are
switched on and off with `setInteractive` and `disableInteractive` and resized with `setSize`,
never removed and added again: Phaser clears the input of an object that is removed and added in
the same frame, which left the store cards dead after a purchase.

## Folder layout

```
src/game/
  contracts/       shared types, constants and the seeded rng. Every part codes against these.
  model/           pure TypeScript, no Phaser, unit-tested
    run/           path selection, segments, quality, telegraph
    content/       monsters, bosses and boss attacks from annotations and nodes
    progression/   build, XP and levels, card catalog, offers
    input/         key bindings and the player motor (run, jump, dash)
  phaser/          the runtime
    art/           roughjs scribble art, cached textures with 3 boiling variants
    combat/        hitboxes, projectiles, damage, hit-stop and feedback
    input/         DOM keyboard and mouse listeners on the canvas
    player/        the mage, its attack machine and the staff
    player/weapons/ the other weapons, mechanics, legendaries and abilities (the loadout)
    mobs/          mob AI, passives, pickups and speech bubbles
    bosses/        node bosses, the final boss, telegraphs and safe zones
    scenes/        Boot, Stretch, Boss, Waystation, FinalBoss, Hud, LevelUp, Store, Death and Victory,
                   the run flow (RunDirector, RunContext), the waystation encounters and the level
                   generator
    dev/           Storybook sandboxes
    config.ts      the Phaser game config that the game and the sandboxes share
    color.ts       cssColor, a number to "#rrggbb" for Phaser text styles
    createGame.ts  builds the Phaser game and returns the GameHandle the dashlet talks to
  assets/          ARCMage.png
```

`RunDirector` holds the run state (build, rng, clock, stage) free of Phaser. Scenes come and go per
stage and read it through `RunContext`. The stages run stretch, boss, waystation for every step,
then the final boss and the victory: `completeStretch`, `defeatBoss`, `leaveWaystation` and
`defeatFinalBoss` move the run on.

## The waystation

After every node boss, never the final boss, the mage walks through the boss's portal into a
waystation (`phaser/scenes/WaystationScene.ts`): one room about 1.15 view widths wide, without
platforms, with the tiles and background of the boss's step. The mage enters on the left, where the
portal it came through closes, and leaves through the exit portal on the right, whose sign names the
next step (`portalLabel`). There is no enemy, no XP and no pit. The HUD, the pause menu and the
level history work as everywhere, and the path on the HUD marks the beaten node.

What stands in the room comes from `rollEncounters(runSeed, afterSegmentIndex)` in
`model/run/encounters.ts`: always the FAIR trader, and in 40% of the waystations the Datenkrake
(see [The Datenkrake](#the-datenkrake)). The kinds fill the slots in the order of `ENCOUNTER_SLOTS`
(centre, right, left), spread over the floor between the entrance and the exit, so a second
encounter stands between the trader and the exit. In the scene, `ENCOUNTER_SPAWNERS` in `phaser/scenes/encounters.ts` maps each kind to
a spawner that puts it at the x of its slot and returns an `Encounter`: an interaction zone, the
prompt word, and hooks for the arrival, the approach, the interaction and the closed overlay. The
scene shows the prompt with the key of `up` and calls `interact` when it is pressed in the zone, or
at once when the player walks into the zone of an `auto` encounter. A new chance encounter is a new
`EncounterKind`, an entry with its chance in `CHANCE_ENCOUNTERS` and a spawner.

## The Datenkrake

The Datenkrake (the old German meme, a data octopus) is a chance encounter of the waystation, rolled
from the run seed with a 40% chance per waystation (`CHANCE_ENCOUNTERS`). It sits in front of a
server rack between the trader and the exit, its tentacles sway and it calls out to the mage
(`spawnDatenkrake` in `phaser/scenes/encounters.ts`, art in `phaser/art/datenkrake.ts`). When the
mage walks into its reach, a tentacle grabs the mage and lifts it a little while the world is held,
then `DatenkrakeScene` opens over the world with a line of the kraken and two choices:

- Fight back (1): the kraken lets go with an indignant line and the mage walks on with every augment.
- Submit (2): the kraken takes a random augment and gives a random corrupted augment back. The
  overlay shows the card taken and the corrupted card with its boon in green and its curse in red
  until Walk on (Enter, after 600 ms).

There is no other way out of the grip, neither the pause key nor walking away. The kraken grabs once
per waystation (`RunDirector.datenkrakeOutcome`). It takes one stack of a stat card (the level
history counts the stacks, `statStacks` in `levelHistory.ts`), a mechanic or an ability card (whose
slot becomes free again), never a weapon, a legendary or a corrupted augment
(`model/progression/datenkrake.ts`). A build with nothing it may take is only mocked and keeps
walking. Both choices go into the level history and the run recap: "Fought off the Datenkrake",
"Taken by the Datenkrake: X" and "Corrupted: Y", marked purple. The build panel lists the corrupted
augments as dark purple chips. The lines (`DATENKRAKE_LINES`) mix the meme with research data
management and never repeat right away.

A corrupted augment (`model/progression/corrupted.ts`) has one strong boon and one harsh curse, and
most of them only shine or only hurt on some builds. None is given twice, and In Silico and In Vitro
never together. Their stat parts go past the card limits on purpose.

| Augment | Boon | Curse | Loves it | Hates it |
|---|---|---|---|---|
| Big Data | +100% damage | 75% more damage taken | dodgers, ranged | face-tanking melee |
| Deprecated jump() | max HP x2.5, healed | no jump of any kind, a kraken intern helps | grounded melee | double jump, wall jump, glide |
| Shadow IT | the dash hits for 22 | dash cooldown x2 | Rapid Release, Cloud Upload | builds that dodge with the dash |
| Data Lake | standing still heals 5% max HP/s | move speed -30% | turrets: wand, pipette, disc | melee chasers |
| Blockchain | hits chain to 2 more enemies for 50% | every attack costs 1 HP (never the last) | Data Reuse, crowds | low HP, fast mashing |
| Overfitting | +150% on the enemy hit last | -50% on any other | boss fights, single target | crowds, spread hits |
| Rogue Admin | every hit crits | ability cooldowns x3 | builds without abilities | ability builds |
| Data Leak | fragments picked up count x3 | a hit taken leaks 3 fragments | careful shoppers | tanks |
| Terms of Service | level-ups heal to full | a 2 s EULA stun after each level-up card | slow, careful play | level-ups mid-fight |
| Mirror Site | attackers take 4x the damage back | left and right swap for 2 s after a hit | tanky melee | platforming near pits |
| In Silico | shots pierce all and +60% | melee -50% | wand, pipette, disc | staff, scalpel, hammer |
| In Vitro | melee +60% and +40% reach | shots -60% | scalpel, whip, hammer | wand, pipette, disc |
| Heavy Metadata | heavy attacks +150% | light attacks -50% | Beaker Hammer, DOI Excalibur | light strings, Reproducibility |
| Reviewer 2 | every 10th hit deals 10x | the first hit on each enemy deals 0 | fast hits (pipette, dual scalpels) | slow single hits |
| Accept All Cookies | +2 max HP per kill for good | a 1 s cookie banner stun every 25 s | long runs, crowds | boss fights |
| Infinite Scroll | dash cooldown x0.25, endless air dashes | attack speed -40% | mobility | damage per second |

The stat parts apply with the augment (`applyCorrupted`). The damage factors run through the
combat world's damage modifier, which now also gets the hit's tags and target
(`outgoingFactor`, `incomingFactor`), and the rest lives in the loadout feature
`phaser/player/weapons/corrupted.ts` (dash hits, the Data Lake heal, the chain and its cost, thorns,
the cookie banner, the EULA), in the player (mirrored controls, stuns), the motor (`noJump`,
`infiniteAirDash`) and the run director (fragments, cookies). Cards an augment makes useless are not
offered (`canApply`): no extra jumps or glide without a jump, no Quality Control under Rogue Admin.

No curse traps the mage. The slowest the augments make the mage is 0.7 times the run speed, which
still clears the widest gap with the plain jump (a test checks it). Deprecated jump() takes every
jump, so a kraken intern in a hard hat follows the mage through the stretches
(`phaser/scenes/intern.ts`). It only helps where the walk to the door needs it
(`phaser/scenes/internPlan.ts`): over every hole between grounds (gaps and pits) it builds a plank
bridge in 0.9 s, with a barrier at both ends until it stands, so a slow mage waits instead of
falling, and at a wall where the ground goes up it reaches out a tentacle and hoists the mage over.
Platforms are never needed to reach the door, and boss arenas and waystations are flat, so they get
nothing: a mage without a jump cannot use them and has to take the hits it cannot dodge there. That
is what the 2.5 times the HP pays for. `walkWithoutJumping` walks hundreds of generated stretches
with bridges and lifts only.

| What | Where |
|---|---|
| Datenkrake chance | `model/run/encounters.ts` (`CHANCE_ENCOUNTERS`) |
| Grab reach and animation timing | `phaser/scenes/encounters.ts` |
| Corrupted augment numbers | `model/progression/corrupted.ts` (`CORRUPTION`) |
| Kraken lines | `model/progression/datenkrake.ts` (`DATENKRAKE_LINES`) |
| Intern build distance and times | `phaser/scenes/intern.ts` |

## Phantoms

An annotation whose value is null, empty or only spaces (`isMissingValue` in `model/content/label.ts`)
makes a phantom, `MonsterSpec.phantom`. Its stats and its id are unchanged, and its weapon comes
from the empty value. In play the body sprite sits at about 8 percent opacity and a few pooled
scribbles rise through its hurtbox like heat haze (`phaser/mobs/phantom.ts`), with a faint dust puff
on footsteps and landings. It shows fully while it attacks, at 60 percent for 150 ms when hit and at
50 percent during the pause inspection. If a phantom kills the mage, the death screen reads "Slain
by a phantom" and tells the player to fill in the missing value. Key P in the MobSandbox spawns one.

## Attack variants

Light presses walk the light string. A light press during a move of the string waits for the
move's cancel window, and a press up to 250 ms after the move ended (`COMBO_GRACE_MS` in
`phaser/player/attacks.ts`) still plays the next move, so a steady mash chains the whole string and
the Triplicate finisher. Only one press waits at a time and later presses merge into it, so a
mash stops at most one move after the last press. A longer pause, a heavy, a dash, a jump or a hit
starts the string over.
A move's lunge pushes the mage forward only while left or right is held. Without a direction the
attack stays in place on the ground and keeps the air speed in the air.

Heavy pressed in the air plays the weapon's air heavy, mostly a plunge with a landing hit and a
short landing lock. The first hit of an air heavy (the fall or the landing ring) ends the plunge and
bounces the mage up at 55% of the jump speed (about 30% of the jump height), free to steer and cancel at once.
Only one air heavy fits in one airtime: until the mage lands, wall jumps or is teleported, another
heavy press in the air does nothing (up and dash heavies still play). The bounce continues that
airtime, so it gives back no jump or air dash, not even when the landing ring bounced the mage off
the floor (`startPlunge`, `plungeBounced` and `airHeavyRefused` in `model/input/motor.ts`).
The Diminishing Returns card (`serialDilution`) lifts the one-per-airtime rule for air heavies that hit: after a bounce
another air heavy may start, up to 5 per airtime (`PLUNGE_CHAIN_MAX`). The first bounce is a full
jump high and each next one lower, 75%, 50%, 30% and 15% of it (`CHAIN_BOUNCE_HEIGHTS`,
`bounceFactor`). The count (`plungeChain`) starts over on the same landing, wall jump or teleport,
and the bounces still give back no jump, air dash or coyote time.
Attacks during a dash, or up to 80 ms after it, play the dash light (no lock) or the
dash heavy. Attacks with up held play an overhead version, and ranged weapons keep aiming at the cursor.
Each weapon only defines the variants of its card slot (light weapons: light, dash light, up light.
Heavy weapons: heavy, air heavy, dash heavy, up heavy) and the staff has all of them.
The mage holds the light weapon. A heavy move puts the heavy weapon in the hand from its startup to
the end of its recovery, and a cancel hands the light weapon back. Each weapon has a hold in
`phaser/player/weaponPose.ts`: the staff and the beaker swing, the Bunsen staff points ahead, the
petri shield is held up in front (over the head for the up heavy) and the disc leaves the hand once
it is thrown.
Each moveset defines its variants (`airHeavy`, `dashLight`, `dashHeavy`, `upLight`, `upHeavy`), the
fallbacks live in `phaser/player/weapons/variants.ts`, and the attack machine in
`phaser/player/attacks.ts` picks the variant, runs plunges until landing and applies locks.

## Ability slots

The mage has four ability slots on ability1 to ability4 (Q, E, R, F by default). An ability card
takes the first free slot (`ABILITY_IDS` in `model/progression/catalog.ts`), and once all four are
full no ability card is offered. The handlers live in `phaser/player/weapons/` (Rebuttal and
Research Assistant in `mechanics.ts`, Git Revert in `legendaries.ts`, the rest in `abilities.ts`). A
handler that returns false from `activate` did nothing (Citation Needed without a target, Backup
Restore at full hp or spent) and starts no cooldown.

| Card | Rarity | Cooldown | Effect |
|---|---|---|---|
| Data Aggregation | uncommon | 8 s | 0.6 s whirl, 4 hits of 5 damage that pull enemies within 4 tiles in |
| Rate Limit | uncommon | 12 s | a 5 x 4 tile zone ahead for 4 s: enemy shots at 30% speed, enemies at 70% (bosses 85%) |
| Data Freeze | rare | 14 s | freezes enemies in a 6-tile cone for 1.5 s, bosses run at half speed instead |
| Citation Needed | uncommon | 10 s | marks the nearest enemy ahead for 6 s, the mage's own hits on it deal 30% extra |
| Firewall | rare | 16 s | blocks hits for 0.4 s and knocks enemies within 3 tiles away for 8 damage |
| Backup Restore | uncommon | once per boss | heals 50% of max hp, then waits for the next boss to fall |
| Peer Pressure | legendary | 40 s | 40 damage to every enemy on screen, pushed away, enemy shots on screen vanish |
| Preprint | legendary | 30 s | a 0.28 s super-dash of about 10 tiles that hits for 30, hits miss the mage for 0.45 s |

Pulls and pushes are knockback on hits of the loadout's stand-in attacker, so bosses, turrets and
boss minions, which ignore knockback, never move. Only the Preprint dash is a hit of the mage
itself, with damage bonuses and crits. The stand-in hits do not count as the mage's own (no Data
Reuse heal, Reproducibility echo, Ontology tags, Peer Review or Citation bonus), and their `stagger`
field keeps them from filling a boss stagger bar much (0.5 for the spin and Peer Pressure, 0 for
Firewall). Freezes and slows go through `Combatant.applyStatus` with the rules in
`phaser/combat/status.ts`: a boss is never frozen, a freeze slows it to half speed, and it takes
half of any slow. A slowed boss runs its whole clock slower (movement, windups, cooldowns), and its
stagger bar and the heavy attack lock work as always. Mobs, minions, turrets and boss minions freeze
in place and stop attacking, and a frozen phantom shows at its hit alpha. The Rate Limit zone is a
slow zone of the combat world (`addSlowZone`), which slows reflectable enemy shots only, so bombs,
falling debris and ground waves keep their timing.

The charge of Backup Restore (`secondWind`) is a `BossCharge` owned by `RunDirector`, so it
stays spent from one scene to the next. `defeatBoss` recharges it, and so does entering the final
boss. The HUD greys a spent slot and writes "after boss" over it. Every slot shows its key, its name
and, while it cools down, the seconds left.

## Legendary weapons

Four weapon cards are legendary: two for the light slot and two for the heavy slot. Each one comes
from a tool or an idea of the ARC world and plays differently from every other weapon. They take the
normal card rules: they roll only when a card rolls legendary (the level-up chance with its
first-legendary pity, the 3% of the store), and holding one ends the pity like a legendary augment
does (`ownsLegendary` in `model/progression/offer.ts`). The Datenkrake never takes a weapon.

A legendary weapon has one form, at full power. A pick puts it in its slot at tier 2, there is no
upgrade, and the card is not offered again while it is held (`legendaryWeapon` in `build.ts`). A
common weapon picked later replaces it at tier 1. The cards show the legendary look, the build panel
reads "(legendary)" and the run recap "light, legendary".

| Weapon | Slot | Based on | How it plays |
|---|---|---|---|
| ARCitect | light, build tool | ARCitect, the desktop editor that builds the Investigation, Study and Assay structure of an ARC | Each light press drops an ISA block a little ahead: an Assay, a Study, then an Investigation, each bigger. The drop hits what is under it for 18, 22 and 30 and launches it. A block stands for 4 s, at most 3 at a time (the oldest makes way), as a one-way platform for the wielder, and enemy shots that can be reflected stop at it. A block dropped on a block stacks. No up light |
| ARC Commander | light, shots at the cursor | the ARC Commander command line (`arc sync`) | `arc add` and `arc commit` fly as terminal chips for 20. `arc sync` first pulls in every enemy shot within 5 tiles, then fires one blast of 28 plus 10 per shot pulled, up to 70, through two enemies |
| Git LFS | heavy, throw | git LFS, which keeps large files outside the repository | One enormous file, thrown after a long wind-up, hits for 30 and rolls on at 150 units/s for 2.4 s. Everything inside it takes 12 every 0.2 s. The rolling ticks carry no `heavy` tag and a stagger of 0.3, so mobs are not staggered five times a second |
| Publication Press | heavy, melee stamp | a DOI that makes an ARC snapshot citable and immutable | The slam (48) publishes every enemy within 7 tiles: frozen as a statue for 1.8 s, with a gold DOI seal over it. A boss turns the freeze into a slow, like every freeze. The wielder's next hit on a statue shatters it for 60% of that hit plus 25 |

The moves live in `phaser/player/weapons/legendaryMoves.ts`, and the parts that need the loadout
(the ISA blocks, the shatter and the seals over the statues, all from fixed pools) in
`legendaryFeature.ts`, which finds the hits by their tags. The air, dash and up versions are the
fallbacks of `variants.ts` (ARC Commander aims at the cursor and has no up light, ARCitect drops its
blocks ahead and has none either). The shots look for
the wielder's opposing team (`opposingTeam`), so the FAIR trader can wield them against the mage. A
statue of the mage, published by the trader, is a stun of at most 0.6 s.

## Ontology Fragments and the FAIR trade store

The currency of the run is the Ontology Fragment, a gold shard of a term graph. The ontologies broke
into pieces, and the mobs are made from them, so mobs drop the fragments, and the FAIR trader
collects them to put every ontology back together and make the world a FAIRer place.

Mobs sometimes drop fragments (`mobFragmentDrop` in `model/progression/fragments.ts`). A mob whose
annotation has an ontology accession drops one 45% of the time, a free-text one 25%. About four in
five annotations of the Talinum ARC have an accession, so a path pays about what a flat 40% would.
A large mob drops one more, and from the second step on there is a growing chance of one more, up
to 3. A phantom drops a single fragment 20% of the time and a summoned minion none. The count is
rolled from a fork of the mob's rng when it spawns, so it does not depend on the fight. A node boss
always drops `6 + 2 * segment index` plus 0 to 2. Fragments pop out of the body, bob like shield
fragments and fly to the mage within 3 tiles (`phaser/mobs/pickups.ts`, pooled, one cached
texture, `fragmentArt` in `phaser/art/props.ts`). `RunDirector.fragments` keeps the count for the
whole run, a pit costs none, and the HUD shows it with the same shard under the right end of the
hp bar.

The FAIR trader keeps a stall in the middle of every waystation (`traderArt` in
`phaser/art/props.ts`) and calls out a greeting when the mage arrives. Near the stall the prompt
shows the key of the `up` action (W by default). Pressing it holds the world and opens `StoreScene`.
The pause key, a move key or the Leave button close it again, and the trader says goodbye.

The stock is 4 cards drawn like a level-up offer (`rollStock` in `model/progression/store.ts`, with
the same canApply rules and at least one card that is not a weapon), but with a fixed 3% legendary
chance per card that does not touch the level-up pity. It is rolled on the first visit and stays
the same when the player leaves and comes back. A purchase applies the card and nothing else: no
level, no XP, no max hp and no heal. Prices show the shard and the number. A card the fragments do not cover shows its price in red, and a card
an earlier purchase made useless (the last free ability slot, say) reads "no use now". Purchases
appear in the level-up provenance as "Bought · card (rarity) · price fragments".

| Rarity | Price |
|---|---|
| common | 5 |
| uncommon | 10 |
| rare | 20 |
| legendary | 45 |

A first stretch of about 8 mobs and its boss pay about 11 to 13 fragments, so a trader visit buys one
or two commons or one uncommon, and a rare takes saving over two visits.

The trader greets the player in the store's speech bubble, reacts to a purchase, a missing
fragment or a useless card, and says goodbye in a bubble over the stall (`TRADER_LINES` in
`model/progression/trader.ts`). Every line names a FAIR principle (Findable, Accessible,
Interoperable, Reusable), most of them with a nod to ARCs: RO-Crate, git versioning, validation, the
DataHUB, ontology terms. About a third of the lines of each mood (`TRADER_LORE`) tell his story:
each fragment is a term someone forgot to link, and he puts the ontologies back together one shard
at a time. So the story comes up now and then, not every time. `createLinePicker` never says the
same line twice in a row.

## Running the sandboxes

Start Storybook with `npm run storybook` (port 6006) and open these stories:

- `Game/ArcGameDashlet` is the dashlet as the dashboard shows it, from the start screen to the
  running game.
- `Game/Dev/FullRun` plays a whole run on the bundled Talinum ARC. Set the `seed` arg to replay a
  path.
- `Game/Dev/TestRoom` is the movement and combat room. F3 shows the motor state, and keys 1 to 4
  toggle double jump, air dash, wall jump and hat glide.
- `Game/Dev/MobSandbox` puts every monster of a planned Talinum run on one long floor. N spawns a
  random monster next to the player and P a phantom.
- `Game/Dev/BossSandbox` is one arena with a boss generated from a step of a planned Talinum run.
  Keys 1 to 9 pick the step, S switches to another run seed and so another path, Q and W change the
  quality of the step (the slots stay) and F starts the final boss. An overlay lists the slots as
  the pause inspection shows them.
- `Game/Dev/LoadoutSandbox` has a panel that toggles any weapon, mechanic or legendary card.
- `Game/Dev/CombatSandbox` runs the combat core with dummies and no player, debug outlines on.
- `Game/Dev/ArtGallery` shows the generated art.

Click the canvas to give it keyboard focus.

## Tuning constants

| What | Where |
|---|---|
| Run, jump, dash, coyote time, jump buffer, wall jump | `model/input/motor.ts` (`MOTOR`) |
| Air heavy bounce and Diminishing Returns chain heights | `model/input/motor.ts` (`PLUNGE_BOUNCE_FACTOR`, `CHAIN_BOUNCE_HEIGHTS`) |
| Mob hp, damage, speed and XP per mob (10, or 15 with an ontology accession) | `model/content/monster.ts` |
| Mob behaviour timing (windups, knockback, aggro range, blink and bomb timers) | `phaser/mobs/tuning.ts` |
| Node boss hp (`400 * (1 + 0.35 * segment index)`, 15% more with a dense theme) and XP | `model/content/boss.ts` |
| Final boss hp (`600 * segments`) | `model/content/boss.ts` |
| Boss slots, damage multiplier and hit cap | `model/content/bossGenome.ts` |
| Boss attack kinds, names, damage and cooldowns | `model/content/bossAttacks.ts` |
| Boss mechanic timers, armour, shield and spill | `phaser/bosses/mechanics.ts` |
| Platform camping time, attack weights while camping, minion speed and hop | `phaser/bosses/reach.ts` |
| Quality and telegraph formulas | `model/run/segment.ts` |
| XP per level (`20 + 10 * (level - 1)`), hp per level, stat caps, card effects | `model/progression/build.ts` |
| Card names, texts and rarities (the ids keep the first names, `stat.thickRobe` is Redundant Storage) | `model/progression/catalog.ts`, flavour lines in `flavor.ts` |
| Rarity odds | `model/progression/offer.ts` |
| Ontology Fragment drops of mobs and bosses | `model/progression/fragments.ts` (`FRAGMENT_DROP`) |
| Store prices, stock size and legendary chance | `model/progression/store.ts` (`PRICES`, `STOCK_SIZE`, `STORE_LEGENDARY_CHANCE`) |
| Trader lines and story lines | `model/progression/trader.ts` (`TRADE_LINES`, `TRADER_LORE`) |
| Fragment pop, bob and magnet | `phaser/mobs/pickups.ts` |
| Trade reach, greeting and goodbye time | `phaser/scenes/encounters.ts` |
| Waystation width and encounter slot positions | `phaser/scenes/WaystationScene.ts` (`ROOM_VIEWS`, `SLOT_AT`) |
| Staff timing and damage | `phaser/player/staffMoveset.ts` |
| Other weapons | `phaser/player/weapons/light.ts`, `phaser/player/weapons/heavy.ts` |
| Legendary weapons (ISA blocks, sync blast, LFS roll, publish reach and shatter) | `phaser/player/weapons/legendaryMoves.ts`, `legendaryFeature.ts` |
| Weapon numbers on the level-up screen (follow the movesets, a test compares them) | `model/progression/weaponStats.ts` |
| Attack buffer and combo grace | `phaser/player/attacks.ts` |
| Ability cooldowns, reach and damage | `phaser/player/weapons/abilities.ts` |
| Boss freeze and slow rules | `phaser/combat/status.ts` |
| Boss portal timeline (forming time, flash, sparks) | `phaser/scenes/portalSpawn.ts` |
| Player i-frames and flinch | `phaser/player/Player.ts` |
| Pit damage, banner time, mob wake distance, monster prewarm rate | `phaser/scenes/StretchScene.ts` |
| Level layout | `phaser/scenes/levelGen.ts` |

Change a pure constant together with its test under `tests/game/`.

Attack timing. A mash plays one move per startup, active and `cancelAfterMs`, so that sum sets the
attack rate. Light moves of the string take about 320 to 490 ms (about 2.5 to 3 hits per second,
shots no faster than melee jabs, string enders slower), and `tests/game/player/combo.test.ts` keeps
a frantic mash at or below 3 per second. Ground and up heavies take about 0.8 to 1 s from startup
to the end of recovery. Air and dash heavies are gated by the airtime and the dash cooldown, so they
stay quicker. High Throughput (`attackSpeed`) divides every phase.

## Performance rules

The target is a steady 60 fps on an integrated GPU.

- Textures are drawn at `TEXTURE_SCALE = 2` canvas pixels per world unit (`phaser/art/layout.ts`)
  and cached by spec id. `ScribbleArt.pixelsPerUnit` is 2, so raw texture keys need a scale of 1/2.
  The stretch scene draws all effect and projectile textures on the first banner frame and the
  monster textures a few per frame behind the intro banner.
- Generated art is drawn on canvases opened with `artContext` (`phaser/art/canvas.ts`), which asks
  for `willReadFrequently` and so keeps the canvas in main memory. Phaser uploads every texture
  from its canvas again when the WebGL context comes back after a GPU reset (a driver hang or
  update, or waking the PC from sleep while the game sat minimized). A GPU-backed canvas
  is cleared in the same reset, so every mob, tile and effect came back invisible, including the
  mobs that spawn later. Uploading a canvas from main memory costs about 1 ms more per texture
  (2 per monster), almost all of it behind the banners. `tests/game/art/canvas.test.ts` fails on a new
  `getContext('2d')` without it. To check by hand, run the game in Chrome and open
  `chrome://gpucrash` in another tab: the scene goes blank for a moment and then returns whole. A
  lost and restored WebGL context alone (`WEBGL_lose_context` in the console) keeps the canvases and
  must also come back whole.
- Textures have a limited lifetime. Each stretch frees the monster textures of earlier segments
  (`releaseMonsters`). Danger zone sizes snap to powers of two, and the boss scenes draw the common
  zones up front and free them on shutdown (`prewarmTelegraphs`, `releaseTelegraphs`).
- Projectiles, damage numbers, speech bubbles, dash ghosts and weapon effects come from pools. Do
  not create game objects per hit or per shot.
- The Phaser config has no `fps.limit`. In Phaser 4.2.1 the limited step passes the accumulated
  delta and then keeps the remainder, so time is counted twice and the game runs too fast.
  `fps.min` is 30, so below 30 fps the game slows down. Many catch-up steps per frame would make a
  slow PC slower still.
- Arcade physics runs at a fixed 120 Hz with `useTree: false`. The dynamic body tree would be rebuilt
  every step and only helps when many dynamic bodies collide with each other, which the game never
  does.
- The HUD redraws an element only when its value changes.
- A paused game (canvas blurred or dashlet scrolled out of view) stops the render loop
  (`createLoopPause` in `phaser/gameHandle.ts`).

## Tests

Vitest unit-tests the pure modules under `tests/game/`. The dashlet test is
`tests/components/ArcGameDashlet.test.tsx`, with `createGame` mocked.

```
npx vitest run tests/game tests/components
```

The Phaser runtime has no unit tests. Check it in the Storybook sandboxes.
