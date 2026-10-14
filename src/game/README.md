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

The node after each segment is a boss (`model/content/boss.ts`). The final boss has one phase per
segment in path order, and each phase uses its segment's telegraph timing. Every final phase has
one heavy and two light attacks from its archetype plus the shared Crate Collapse, so a light attack
always breaks up the heavy ones. The player is healed to full before the final boss. The same annotation always
has the same look and kind, because the monster is derived from a hash of the annotation. Its
stats scale with the segment depth, `1 + 0.12 * segmentIndex`.

On the death screen a boss (or final boss phase) whose step has 8 or more annotations (quality 1)
gets no annotate hint, because its attacks already have the longest warnings.

The level-up screen plays a short intro with all input locked, so clicks and keys from the fight cannot pick a card. After it a card is chosen by a left click that starts and ends on the card, or by the keys 1 to 4. Hovering a card for about 600 ms (or pressing ? over it) opens its details, built by `cardDetails` in `model/progression/details.ts`. The mouse button is the `CHOOSE_BUTTON` constant in `LevelUpScene.ts`.

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
    scenes/        Boot, Stretch, Boss, FinalBoss, Hud, LevelUp, Death and Victory, the run flow
                   (RunDirector, RunContext) and the level generator
    dev/           Storybook sandboxes
    config.ts      the Phaser game config that the game and the sandboxes share
    color.ts       cssColor, a number to "#rrggbb" for Phaser text styles
    createGame.ts  builds the Phaser game and returns the GameHandle the dashlet talks to
  assets/          ARCMage.png
```

`RunDirector` holds the run state (build, rng, clock, stage) free of Phaser. Scenes come and go per
stage and read it through `RunContext`.

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
the Triple Combo finisher. Only one press waits at a time and later presses merge into it, so a
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
The Serial Dilution card lifts the one-per-airtime rule for air heavies that hit: after a bounce
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
full no ability card is offered. The handlers live in `phaser/player/weapons/` (Parry and Familiar
in `mechanics.ts`, Git Revert in `legendaries.ts`, the rest in `abilities.ts`). A handler that
returns false from `activate` did nothing (Citation Needed without a target, Second Wind at full hp
or spent) and starts no cooldown.

| Card | Rarity | Cooldown | Effect |
|---|---|---|---|
| Centrifuge Spin | uncommon | 8 s | 0.6 s whirl, 4 hits of 5 damage that pull enemies within 4 tiles in |
| Fume Hood | uncommon | 12 s | a 5 x 4 tile hood ahead for 4 s: enemy shots at 30% speed, enemies at 70% (bosses 85%) |
| Sample Freeze | rare | 14 s | freezes enemies in a 6-tile cone for 1.5 s, bosses run at half speed instead |
| Citation Needed | uncommon | 10 s | marks the nearest enemy ahead for 6 s, the mage's own hits on it deal 30% extra |
| Autoclave | rare | 16 s | blocks hits for 0.4 s and knocks enemies within 3 tiles away for 8 damage |
| Second Wind | uncommon | once per boss | heals 50% of max hp, then waits for the next boss to fall |
| Peer Pressure | legendary | 40 s | 40 damage to every enemy on screen, pushed away, enemy shots on screen vanish |
| Lab Coat | legendary | 30 s | a 0.28 s super-dash of about 10 tiles that hits for 30, hits miss the mage for 0.45 s |

Pulls and pushes are knockback on hits of the loadout's stand-in attacker, so bosses, turrets and
boss minions, which ignore knockback, never move. Only the Lab Coat dash is a hit of the mage
itself, with damage bonuses and crits. The stand-in hits do not count as the mage's own
(no lifesteal, Echo, Ontology tags, Peer Review or Citation bonus), and their `stagger` field keeps
them from filling a boss stagger bar much (0.5 for the spin and Peer Pressure, 0 for Autoclave).
Freezes and slows go through `Combatant.applyStatus` with the rules in `phaser/combat/status.ts`:
a boss is never frozen, a freeze slows it to half speed, and it takes half of any slow. A slowed
boss runs its whole clock slower (movement, windups, cooldowns), and its stagger bar and the heavy
attack lock work as always. Mobs, minions, turrets and boss minions freeze in place and stop
attacking, and a frozen phantom shows at its hit alpha. The fume hood is a slow zone of the combat
world (`addSlowZone`), which slows reflectable enemy shots only, so bombs, falling debris and ground
waves keep their timing.

Second Wind's charge is a `BossCharge` owned by `RunDirector`, so it stays spent from one scene to
the next. `defeatBoss` recharges it, and so does entering the final boss. The HUD greys a spent slot
and writes "after boss" over it. Every slot shows its key, its name and, while it cools down, the
seconds left.

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
- `Game/Dev/BossSandbox` is one arena with a boss. Keys 1 to 4 pick the archetype and Q and W
  change the annotation quality. F starts the final boss.
- `Game/Dev/LoadoutSandbox` has a panel that toggles any weapon, mechanic or legendary card.
- `Game/Dev/CombatSandbox` runs the combat core with dummies and no player, debug outlines on.
- `Game/Dev/ArtGallery` shows the generated art.

Click the canvas to give it keyboard focus.

## Tuning constants

| What | Where |
|---|---|
| Run, jump, dash, coyote time, jump buffer, wall jump | `model/input/motor.ts` (`MOTOR`) |
| Air heavy bounce and Serial Dilution chain heights | `model/input/motor.ts` (`PLUNGE_BOUNCE_FACTOR`, `CHAIN_BOUNCE_HEIGHTS`) |
| Mob hp, damage, speed and XP per mob (10, or 15 with an ontology accession) | `model/content/monster.ts` |
| Mob behaviour timing (windups, knockback, aggro range, blink and bomb timers) | `phaser/mobs/tuning.ts` |
| Node boss hp (`400 * (1 + 0.35 * segment index)`) and XP | `model/content/boss.ts` |
| Final boss hp (`600 * segments`) | `model/content/boss.ts` |
| Boss attack damage and cooldowns | `model/content/bossAttacks.ts` |
| Quality and telegraph formulas | `model/run/segment.ts` |
| XP per level (`20 + 10 * (level - 1)`), hp per level, stat caps, card effects | `model/progression/build.ts` |
| Card texts and rarities | `model/progression/catalog.ts` |
| Rarity odds | `model/progression/offer.ts` |
| Staff timing and damage | `phaser/player/staffMoveset.ts` |
| Other weapons | `phaser/player/weapons/light.ts`, `phaser/player/weapons/heavy.ts` |
| Weapon numbers on the level-up screen (follow the movesets, a test compares them) | `model/progression/weaponStats.ts` |
| Attack buffer and combo grace | `phaser/player/attacks.ts` |
| Ability cooldowns, reach and damage | `phaser/player/weapons/abilities.ts` |
| Boss freeze and slow rules | `phaser/combat/status.ts` |
| Player i-frames and flinch | `phaser/player/Player.ts` |
| Pit damage, banner time, mob wake distance, monster prewarm rate | `phaser/scenes/StretchScene.ts` |
| Level layout | `phaser/scenes/levelGen.ts` |

Change a pure constant together with its test under `tests/game/`.

Attack timing. A mash plays one move per startup, active and `cancelAfterMs`, so that sum sets the
attack rate. Light moves of the string take about 320 to 490 ms (about 2.5 to 3 hits per second,
shots no faster than melee jabs, string enders slower), and `tests/game/player/combo.test.ts` keeps
a frantic mash at or below 3 per second. Ground and up heavies take about 0.8 to 1 s from startup
to the end of recovery. Air and dash heavies are gated by the airtime and the dash cooldown, so they
stay quicker. Quick Hands (`attackSpeed`) divides every phase.

## Performance rules

The target is a steady 60 fps on an integrated GPU.

- Textures are drawn at `TEXTURE_SCALE = 2` canvas pixels per world unit (`phaser/art/layout.ts`)
  and cached by spec id. `ScribbleArt.pixelsPerUnit` is 2, so raw texture keys need a scale of 1/2.
  The stretch scene draws all effect and projectile textures on the first banner frame and the
  monster textures a few per frame behind the intro banner.
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
