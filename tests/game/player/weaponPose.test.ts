import { describe, expect, it } from 'vitest'
import type { AttackVariant } from '../../../src/game/contracts/player'
import type { WeaponSlot } from '../../../src/game/contracts/progression'
import { createAttackMachine } from '../../../src/game/phaser/player/attacks'
import { staffMoveset } from '../../../src/game/phaser/player/staffMoveset'
import { heldSlot, holdOf, weaponPose } from '../../../src/game/phaser/player/weaponPose'
import type { WeaponHold, WeaponPose } from '../../../src/game/phaser/player/weaponPose'
import type { AttackPhase } from '../../../src/game/phaser/player/attacks'

const STEP_MS = 10
const GROUND = { grounded: true, attackSpeed: 1, canStart: true }

function pose(hold: WeaponHold, phase: AttackPhase, variant: AttackVariant = 'ground', spinMs = 0): WeaponPose {
  return weaponPose({ heavy: true, variant, plunge: false, spin: false, hold }, phase, spinMs, { x: 0, y: 0, angle: 0, poke: 0, visible: true })
}

// The staff's moves stand in for both slots, so the heavy move is the real slam.
function machine() {
  return createAttackMachine({ movesFor: (slot: WeaponSlot) => staffMoveset.moves(slot, 1), onStart() {}, onActive() {} })
}

describe('held weapon', () => {
  it('holds the heavy weapon through a heavy move and the light weapon again after it', () => {
    const attacks = machine()
    const seen: string[] = []
    attacks.step(STEP_MS, { light: false, heavy: true }, GROUND)
    for (let t = 0; t < 2000; t += STEP_MS) {
      seen.push(`${attacks.phase()}:${heldSlot(attacks.current())}`)
      attacks.step(STEP_MS, { light: false, heavy: false }, GROUND)
    }
    const phases = [...new Set(seen)]
    expect(phases).toEqual(['startup:heavy', 'active:heavy', 'recovery:heavy', 'idle:light'])
  })

  it('hands back the light weapon when a jump or a hit cancels the heavy move', () => {
    const attacks = machine()
    attacks.step(STEP_MS, { light: false, heavy: true }, GROUND)
    expect(heldSlot(attacks.current())).toBe('heavy')
    attacks.cancel()
    expect(heldSlot(attacks.current())).toBe('light')
  })

  it('holds the light weapon during light moves', () => {
    const attacks = machine()
    attacks.step(STEP_MS, { light: true, heavy: false }, GROUND)
    expect(heldSlot(attacks.current())).toBe('light')
  })
})

describe('heavy weapon holds', () => {
  it('swings the staff and the beaker, aims the Bunsen staff, raises the shield and throws the disc', () => {
    expect(holdOf('staff')).toBe('swing')
    expect(holdOf('beakerHammer')).toBe('swing')
    expect(holdOf('bunsenStaff')).toBe('aim')
    expect(holdOf('petriShield')).toBe('shield')
    expect(holdOf('centrifugeDisc')).toBe('throw')
  })

  it('shows the disc while winding up and hides it while it flies', () => {
    expect(pose('throw', 'startup').visible).toBe(true)
    expect(pose('throw', 'active').visible).toBe(false)
    expect(pose('throw', 'recovery').visible).toBe(false)
    expect(pose('throw', 'idle').visible).toBe(true)
  })

  it('keeps the shield up in front of the body through the bash and the shield charge', () => {
    for (const variant of ['ground', 'dash'] as const) {
      const bash = pose('shield', 'active', variant, 400)
      expect(Math.abs(bash.angle)).toBeLessThan(0.4)
      expect(bash.x).toBeGreaterThan(8)
      expect(bash.visible).toBe(true)
    }
  })

  it('lifts the shield over the head for the up heavy', () => {
    expect(pose('shield', 'active', 'up').y).toBeLessThan(pose('shield', 'active').y - 20)
  })

  it('points the Bunsen staff level ahead while the flame streams', () => {
    expect(pose('aim', 'active').angle).toBeCloseTo(Math.PI / 2)
  })

  it('leaves the staff slam and its dash spin as they were', () => {
    expect(pose('swing', 'active').angle).toBe(2)
    expect(pose('swing', 'active', 'dash', 100).angle).toBeCloseTo(100 * 0.03)
  })
})
