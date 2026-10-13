# ARC Mage

ARC Mage is a 2D side-scrolling action platformer that runs inside the ARC dashboard
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
   visible tells (the node's own annotations) and a longer stagger window.

The node after each segment is a boss (`model/content/boss.ts`). The final boss has one phase per
segment in path order, and each phase uses its segment's telegraph timing. Every final phase has
one heavy and two light attacks from its archetype plus the shared Crate Collapse, so a light attack
always breaks up the heavy ones. The player is healed to full before the final boss. The same annotation always
has the same look and kind, because the monster is derived from a hash of the annotation. Its
stats scale with the segment depth, `1 + 0.12 * segmentIndex`.

On the death screen a boss (or final boss phase) whose step has 8 or more annotations (quality 1)
gets no annotate hint, because its attacks already have the longest warnings.

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
    player/weapons/ the other weapons, mechanics and legendaries (the loadout)
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

## Running the sandboxes

Start Storybook with `npm run storybook` (port 6006) and open these stories:

- `Game/ArcGameDashlet` is the dashlet as the dashboard shows it, from the start screen to the
  running game.
- `Game/Dev/FullRun` plays a whole run on the bundled Talinum ARC. Set the `seed` arg to replay a
  path.
- `Game/Dev/TestRoom` is the movement and combat room. F3 shows the motor state, and keys 1 to 4
  toggle double jump, air dash, wall jump and hat glide.
- `Game/Dev/MobSandbox` puts every monster of a planned Talinum run on one long floor. N spawns a
  random monster next to the player.
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
| Player i-frames and flinch | `phaser/player/Player.ts` |
| Pit damage, banner time, mob wake distance, monster prewarm rate | `phaser/scenes/StretchScene.ts` |
| Level layout | `phaser/scenes/levelGen.ts` |

Change a pure constant together with its test under `tests/game/`.

## Performance rules

The target is a steady 60 fps on an integrated GPU.

- Textures are drawn at `TEXTURE_SCALE = 2` canvas pixels per world unit (`phaser/art/layout.ts`)
  and cached by spec id. `ScribbleArt.pixelsPerUnit` is 2, so raw texture keys need a scale of 1/2.
  The stretch scene draws the monster textures, effects and projectiles behind the intro banner, a
  few per frame.
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
