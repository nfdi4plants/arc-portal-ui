import type { Combatant } from '../../../contracts/combat'
import type { AttackContext, WeaponMoveset } from '../../../contracts/player'
import { aimedVelocity, opposingTeam } from './helpers'
import type { MeleeHit, Shot, Timing } from './kit'
import { activeMs, burst, fireShot, later, memoMoves, move, muzzle, placeBlock, spawnMelee } from './kit'
import { UNGROUPED } from './scheduler'
import { NO_UP_LIGHT } from './variants'

// The legendary weapons. Each one plays differently from the others and from the common weapons,
// and each comes from a tool or idea of the ARC world. They have one form: the moves ignore the
// tier, and a pick puts them at tier 2 straight away. The air, dash and up variants are the
// fallbacks of variants.ts. The parts that need the loadout (the ISA blocks, the shattering of a
// published statue and the marks over the enemies) live in legendaryFeature.ts and find the hits
// by their tags.

const lightTiming = (startupMs: number, activeMs: number, recoveryMs: number, cancelAfterMs: number, lunge = 0): Timing => ({
  startupMs,
  activeMs,
  recoveryMs,
  cancelAfterMs,
  lunge,
  allowedInAir: true,
})

const heavyTiming = (startupMs: number, activeMs: number, recoveryMs: number, cancelAfterMs: number, lunge = 0): Timing => ({
  startupMs,
  activeMs,
  recoveryMs,
  cancelAfterMs,
  lunge,
  allowedInAir: false,
})

// ARCitect (the desktop editor that builds the Investigation, Study and Assay structure of an
// ARC). The light string builds: each press drops an ISA block a little ahead, an Assay, a Study,
// then an Investigation, each one bigger. The drop hits what is under it and launches it. The block
// stands for a few seconds as a one-way platform for the wielder, and enemy shots stop at it
// (legendaryFeature.ts keeps the blocks). The drop boxes are tagged 'isa'.
export const ISA_TAG = 'isa'
// Where a block lands, ahead of the feet: its middle, so a bigger block reaches further.
const ISA_DROPS = [
  { kind: 'assay', ahead: 44, w: 24, h: 14, damage: 18 },
  { kind: 'study', ahead: 52, w: 30, h: 22, damage: 22 },
  { kind: 'investigation', ahead: 62, w: 36, h: 30, damage: 30 },
] as const

function dropBlock(ctx: AttackContext, drop: (typeof ISA_DROPS)[number]): void {
  const feet = ctx.player.position()
  const face = ctx.player.facing()
  const x = feet.x + face * drop.ahead
  const floor = placeBlock(ctx, drop.kind, x)
  // The box covers the block and the space it falls through, placed relative to the feet.
  const fall = 18
  ctx.combat.spawnHitbox({
    owner: ctx.player,
    shape: { kind: 'rect', x: drop.ahead - drop.w / 2 - 4, y: floor - feet.y - drop.h - fall, w: drop.w + 8, h: drop.h + fall },
    follow: false,
    activeMs: 90,
    damage: drop.damage,
    knockback: { x: 60, y: -300 },
    hitStopMs: 35,
    maxTargets: Infinity,
    tags: ['light', ISA_TAG],
  })
  burst(ctx, x, floor - 2, 'dust', drop.w / 20)
}

export const arcitectMoveset: WeaponMoveset = {
  id: 'arcitect',
  ...NO_UP_LIGHT,
  moves: memoMoves((slot) => {
    if (slot === 'heavy') return []
    return [
      move('Place Assay', lightTiming(120, 50, 220, 200), (ctx) => dropBlock(ctx, ISA_DROPS[0])),
      move('Place Study', lightTiming(130, 50, 240, 200), (ctx) => dropBlock(ctx, ISA_DROPS[1])),
      move('Place Investigation', lightTiming(150, 60, 300, 250), (ctx) => dropBlock(ctx, ISA_DROPS[2])),
    ]
  }),
}

// ARC Commander (the command line tool: arc init, arc sync). It types commands that fly at the
// cursor. The third, arc sync, first pulls in every enemy shot near the mage and fires them back
// as one blast that grows with each.
export const SYNC_REACH = 120
const SYNC_BASE = 28
const SYNC_PER_SHOT = 10
const SYNC_MAX = 70

const COMMAND = (damage: number): Omit<Shot, 'velocity'> => ({
  art: 'command',
  damage,
  radius: 6,
  lifetimeMs: 950,
  knockback: { x: 80, y: -20 },
  hitStopMs: 20,
  tags: ['light', 'projectile', 'command'],
})

// The blast of arc sync after pulling in `shots` enemy shots.
export function syncDamage(shots: number): number {
  return Math.min(SYNC_MAX, SYNC_BASE + SYNC_PER_SHOT * shots)
}

function typeCommand(ctx: AttackContext, shot: Omit<Shot, 'velocity'>, speed: number): void {
  const from = muzzle(ctx)
  fireShot(ctx, from, { ...shot, velocity: aimedVelocity(from, ctx.aim, speed, ctx.player.facing()) })
}

const area = { x: 0, y: 0, w: 0, h: 0 }

function arcSync(ctx: AttackContext): void {
  const feet = ctx.player.position()
  area.x = feet.x - SYNC_REACH
  area.y = feet.y - 24 - SYNC_REACH
  area.w = SYNC_REACH * 2
  area.h = SYNC_REACH * 2
  const pulled = ctx.combat.cancelShots(opposingTeam(ctx.player.team), area)
  if (pulled > 0) burst(ctx, feet.x, feet.y - 24, 'levelUp', 1 + pulled * 0.2)
  typeCommand(ctx, { ...COMMAND(syncDamage(pulled)), radius: 9, pierce: 2, knockback: { x: 220, y: -120 }, hitStopMs: 50, tags: ['light', 'projectile', 'command', 'sync'] }, 480)
}

export const commanderMoveset: WeaponMoveset = {
  id: 'arcCommander',
  ...NO_UP_LIGHT,
  moves: memoMoves((slot) => {
    if (slot === 'heavy') return []
    return [
      move('arc add', lightTiming(110, 40, 240, 220), (ctx) => typeCommand(ctx, COMMAND(20), 420)),
      move('arc commit', lightTiming(110, 40, 240, 220), (ctx) => typeCommand(ctx, COMMAND(20), 420)),
      move('arc sync', lightTiming(150, 40, 320, 280), arcSync),
    ]
  }),
}

// Git LFS (large files that git keeps outside the repository). The mage hurls one enormous file. It
// hits what it meets for 30 and rolls on slowly, and everything inside it takes 12 every 0.2 s.
// The ticks carry no 'heavy' tag, so a mob is not staggered five times a second.
export const LFS = { speed: 150, rollMs: 2400, tickMs: 200, hit: 30, tick: 12, size: 34 }
const LFS_TICKS = Math.round(LFS.rollMs / LFS.tickMs)

function throwFile(ctx: AttackContext): void {
  const feet = ctx.player.position()
  const dir = ctx.player.facing()
  const half = LFS.size / 2
  const origin = { x: feet.x + dir * (half + 8), y: feet.y - half }
  fireShot(ctx, origin, {
    art: 'file',
    velocity: { x: dir * LFS.speed, y: 0 },
    damage: LFS.hit,
    radius: half,
    rect: { w: LFS.size, h: LFS.size },
    lifetimeMs: LFS.rollMs,
    pierce: 99,
    knockback: { x: 160, y: -140 },
    hitStopMs: 60,
    tags: ['heavy', 'projectile', 'lfs'],
  })
  // Each tick is a box where the file is then, placed relative to the mage of that moment. The
  // ticks are ungrouped: once thrown, the file rolls on whatever happens to the mage.
  for (let i = 1; i <= LFS_TICKS; i++) {
    const x = origin.x + (dir * LFS.speed * i * LFS.tickMs) / 1000
    later(
      ctx,
      i * LFS.tickMs,
      () => {
        const now = ctx.player.position()
        const face = ctx.player.facing()
        ctx.combat.spawnHitbox({
          owner: ctx.player,
          shape: { kind: 'rect', x: (x - now.x) * face - half, y: origin.y - now.y - half, w: LFS.size, h: LFS.size },
          follow: false,
          activeMs: LFS.tickMs / 2,
          damage: LFS.tick,
          knockback: { x: 0, y: -40 },
          hitStopMs: 0,
          maxTargets: Infinity,
          tags: ['lfs'],
          stagger: 0.3,
        })
      },
      UNGROUPED,
    )
  }
}

export const lfsMoveset: WeaponMoveset = {
  id: 'gitLfs',
  moves: memoMoves((slot) => {
    if (slot === 'light') return []
    return [move('git lfs push', heavyTiming(340, 80, 440, 340), (ctx) => throwFile(ctx), { damage: LFS.hit })]
  }),
}

// Publication Press (a DOI makes a snapshot of an ARC citable and immutable). The slam publishes
// every enemy within 7 tiles: frozen as an immutable statue for 1.8 s (a boss only slows down, see
// combat/status.ts). The wielder's next hit on a statue shatters it (legendaryFeature.ts).
export const PUBLISH = { reach: 168, ms: 1800, shatterShare: 0.6, shatterFlat: 25 }
export const PUBLISH_TAG = 'publish'

interface Publication {
  by: Combatant
  id: number
}

// Who published a statue, kept until the statue thaws or shatters. A newer publication replaces an
// older one, and the older timer leaves it alone.
const published = new WeakMap<Combatant, Publication>()
let publications = 0

export function publishedBy(target: Combatant): Combatant | null {
  return published.get(target)?.by ?? null
}

export function unpublish(target: Combatant): void {
  published.delete(target)
}

// Freezes and marks the living enemies of the wielder within the publish reach of its middle.
function publish(ctx: AttackContext): void {
  const feet = ctx.player.position()
  const cx = feet.x
  const cy = feet.y - 24
  const reachSq = PUBLISH.reach * PUBLISH.reach
  for (const target of ctx.combat.livingCombatants(opposingTeam(ctx.player.team))) {
    const box = target.hurtbox()
    const dx = box.x + box.width / 2 - cx
    const dy = box.y + box.height / 2 - cy
    if (dx * dx + dy * dy > reachSq) continue
    target.applyStatus?.({ kind: 'freeze', ms: PUBLISH.ms })
    const mark = { by: ctx.player as Combatant, id: ++publications }
    published.set(target, mark)
    later(
      ctx,
      PUBLISH.ms,
      () => {
        if (published.get(target) === mark) published.delete(target)
      },
      UNGROUPED,
    )
  }
  burst(ctx, cx, feet.y - 6, 'crit', 3)
}

const PRESS: MeleeHit = { x: -6, y: -64, w: 70, h: 64, damage: 48, knockback: { x: 200, y: -260 }, hitStopMs: 80, tags: ['heavy', PUBLISH_TAG] }

export const pressMoveset: WeaponMoveset = {
  id: 'publicationPress',
  moves: memoMoves((slot) => {
    if (slot === 'light') return []
    return [
      move(
        'Publish',
        heavyTiming(320, 100, 380, 260, 40),
        (ctx, self) => {
          spawnMelee(ctx, activeMs(ctx, self), PRESS)
          publish(ctx)
        },
        { damage: PRESS.damage },
      ),
    ]
  }),
}

export const LEGENDARY_MOVESETS: readonly WeaponMoveset[] = [arcitectMoveset, commanderMoveset, lfsMoveset, pressMoveset]

