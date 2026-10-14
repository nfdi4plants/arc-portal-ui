import type { EnemyWeaponKind } from '../../contracts/content'

// How a mob holds and swings its weapon sprite. Pure, so the curves are unit-tested. Angles are in
// radians for a mob facing right (0 = forward, negative = up), offsets in world units from the hand.
// The mob mirrors the result with its facing.

// rest: held still, windup: the attack's windup, strike: the frames after the windup (the melee
// hitbox is live, or the shot just left), recover: back to rest, brace: held forward during a
// beetle charge or a bat dive.
export type WeaponStage = 'rest' | 'windup' | 'strike' | 'recover' | 'brace'

export interface WeaponPose {
  angle: number
  dx: number
  dy: number
  scale: number
  visible: boolean
}

export interface WeaponPoseInput {
  kind: EnemyWeaponKind
  stage: WeaponStage
  // Progress through the stage, 0 to 1.
  t: number
  length: number
  // Resting angle of the weapon.
  rest: number
  // Direction to the target, for ranged weapons and the brace.
  aim: number
  // How far a melee strike pushes forward, so the tip reaches the far end of the hitbox.
  lunge: number
  // -1 to 1, a slow idle bob.
  sway: number
}

// A ranged weapon kicks back for this long after the shot.
export const WEAPON_KICK_MS = 110
// A melee strike pushes forward at most this many weapon lengths.
export const MAX_LUNGE = 0.65

interface Swing {
  // End of the windup: angle, and offsets in weapon lengths.
  backAngle: number
  backDx: number
  backDy: number
  // End of the strike.
  hitAngle: number
}

const SWINGS: Record<'claw' | 'spear' | 'whip' | 'shield', Swing> = {
  // Rears up over the head and rakes down through the front.
  claw: { backAngle: -1.7, backDx: -0.15, backDy: -0.1, hitAngle: 0.8 },
  // Pulled back level, then thrust straight out.
  spear: { backAngle: -0.12, backDx: -0.35, backDy: 0, hitAngle: 0 },
  // Cocked far behind, then cracked forward.
  whip: { backAngle: -2.5, backDx: -0.1, backDy: -0.15, hitAngle: 0.25 },
  // Raised and drawn in, then shoved forward.
  shield: { backAngle: -0.25, backDx: -0.25, backDy: -0.2, hitAngle: 0 },
}

// The throw cocks back for this share of the windup, then swings to the release point.
const THROW_COCK = 0.7
const THROW_BACK = -2.3
const THROW_RELEASE = -0.6

const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const easeOut = (t: number) => 1 - (1 - t) * (1 - t)
const easeIn = (t: number) => t * t
const smooth = (t: number) => t * t * (3 - 2 * t)
const clamp01 = (t: number) => Math.min(1, Math.max(0, t))

function set(out: WeaponPose, angle: number, dx: number, dy: number, scale = 1, visible = true): WeaponPose {
  out.angle = angle
  out.dx = dx
  out.dy = dy
  out.scale = scale
  out.visible = visible
  return out
}

// Writes the pose into `out` and returns it, so a mob reuses one object for every step.
export function poseWeapon(out: WeaponPose, input: WeaponPoseInput): WeaponPose {
  const { kind, stage, length: L, rest } = input
  const t = clamp01(input.t)
  if (stage === 'rest') return set(out, rest + input.sway * 0.06, 0, input.sway * 0.6)
  if (stage === 'brace') return set(out, input.aim, 0.12 * L, 0)
  switch (kind) {
    case 'claw':
    case 'spear':
    case 'whip':
    case 'shield':
      return poseSwing(out, SWINGS[kind], stage, t, input)
    case 'bow':
      return poseShot(out, stage, t, input, input.aim, -0.12, -0.2)
    case 'wand':
      // The wand is raised high during the windup and snaps to the target on the cast.
      return poseShot(out, stage, t, input, -1.4, 0, 0.2)
    case 'bomb':
    case 'flask':
      return poseThrow(out, stage, t, input)
  }
}

function poseSwing(out: WeaponPose, swing: Swing, stage: WeaponStage, t: number, input: WeaponPoseInput): WeaponPose {
  const { length: L, rest, lunge } = input
  const backDx = swing.backDx * L
  const backDy = swing.backDy * L
  if (stage === 'windup') {
    const e = easeOut(t)
    return set(out, lerp(rest, swing.backAngle, e), lerp(0, backDx, e), lerp(0, backDy, e))
  }
  if (stage === 'strike') {
    // The push lands in the first half of the strike and holds while the hitbox is live.
    const push = easeOut(clamp01(t * 2))
    return set(out, lerp(swing.backAngle, swing.hitAngle, easeOut(t)), lerp(backDx, lunge, push), lerp(backDy, 0, push))
  }
  const e = smooth(t)
  return set(out, lerp(swing.hitAngle, rest, e), lerp(lunge, 0, e), 0)
}

// `windupAngle` is where the weapon ends its windup, `drawDx` and `kick` how far it moves at the end
// of the windup and on the shot, in weapon lengths (negative = back).
function poseShot(out: WeaponPose, stage: WeaponStage, t: number, input: WeaponPoseInput, windupAngle: number, drawDx: number, kick: number): WeaponPose {
  const { length: L, rest, aim } = input
  if (stage === 'windup') {
    const e = easeOut(t)
    // A slight tremble while it charges, settled again when it fires.
    const shake = Math.sin(t * 40) * 0.16 * t * (1 - t)
    return set(out, lerp(rest, windupAngle, e) + shake, lerp(0, drawDx * L, e), 0)
  }
  if (stage === 'strike') {
    // The kick fades out and the muzzle flips up a little with it.
    const k = 1 - easeOut(t)
    return set(out, aim - 0.2 * k, kick * L * k, 0)
  }
  const e = smooth(t)
  return set(out, lerp(aim, rest, e), 0, 0)
}

// Swung back over the head, then forward to the release point. The thrown weapon leaves the hand on
// the shot and a new one grows back in during the recovery.
function poseThrow(out: WeaponPose, stage: WeaponStage, t: number, input: WeaponPoseInput): WeaponPose {
  const { length: L, rest } = input
  if (stage === 'windup') {
    if (t < THROW_COCK) {
      const e = easeOut(t / THROW_COCK)
      return set(out, lerp(rest, THROW_BACK, e), lerp(0, -0.2 * L, e), lerp(0, -0.1 * L, e))
    }
    const e = easeIn((t - THROW_COCK) / (1 - THROW_COCK))
    return set(out, lerp(THROW_BACK, THROW_RELEASE, e), lerp(-0.2 * L, 0.1 * L, e), lerp(-0.1 * L, 0, e))
  }
  if (stage === 'strike') return set(out, THROW_RELEASE, 0.1 * L, 0, 1, false)
  return set(out, rest, 0, 0, easeOut(t))
}

// How far a melee weapon has to push forward so its tip, at full reach, ends where the hitbox ends.
// `reachX` is the hitbox's far edge and `handX` the hand, both forward of the body centre.
export function meleeLunge(reachX: number, handX: number, tip: number, length: number): number {
  return Math.min(MAX_LUNGE * length, Math.max(0, reachX - handX - tip))
}

// Where the business end of the weapon is, forward of the hand and below it, for a mob facing right.
export function weaponTipOffset(pose: WeaponPose, tip: number): { x: number; y: number } {
  return { x: pose.dx + Math.cos(pose.angle) * tip, y: pose.dy + Math.sin(pose.angle) * tip }
}
