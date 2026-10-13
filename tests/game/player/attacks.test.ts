import { describe, expect, it } from 'vitest'
import type { AttackMove } from '../../../src/game/contracts/player'
import type { WeaponSlot } from '../../../src/game/contracts/progression'
import { createAttackMachine, type AttackStepEnv } from '../../../src/game/phaser/player/attacks'

const STEP_MS = 10
const NONE = { light: false, heavy: false }
const LIGHT = { light: true, heavy: false }

function move(name: string, cancelAfterMs: number): AttackMove {
  return { name, startupMs: 50, activeMs: 50, recoveryMs: 200, cancelAfterMs, allowedInAir: true, onActive: () => {} }
}

function setup(cancelAfterMs: number, attackSpeed = 1) {
  const light = [move('a', cancelAfterMs), move('b', cancelAfterMs), move('c', cancelAfterMs)]
  const heavy = [move('heavy', cancelAfterMs)]
  const started: { slot: WeaponSlot; comboIndex: number }[] = []
  const activated: string[] = []
  const machine = createAttackMachine({
    movesFor: (slot) => (slot === 'light' ? light : heavy),
    onStart: (slot, comboIndex) => started.push({ slot, comboIndex }),
    onActive: (_slot, _index, m) => activated.push(m.name),
  })
  const env: AttackStepEnv = { grounded: true, attackSpeed, canStart: true }
  const press = (pressed = LIGHT) => machine.step(STEP_MS, pressed, env)
  const wait = (ms: number) => {
    for (let t = 0; t < ms; t += STEP_MS) machine.step(STEP_MS, NONE, env)
  }
  return { machine, started, activated, press, wait }
}

describe('createAttackMachine', () => {
  it('fires a press made 100 ms before recovery ends', () => {
    const { started, press, wait } = setup(200)
    press()
    // The move lasts 300 ms. The press step and the wait add up to 200 ms.
    wait(190)
    press()
    wait(100)
    expect(started).toHaveLength(2)
  })

  it('drops a press made 200 ms before recovery ends', () => {
    const { started, press, wait } = setup(200)
    press()
    wait(90)
    press()
    wait(300)
    expect(started).toHaveLength(1)
  })

  it('advances the light combo when pressed inside the cancel window', () => {
    const { started, press, wait } = setup(100)
    press()
    // Startup, active and 100 ms of recovery.
    wait(200)
    press()
    expect(started.map((s) => s.comboIndex)).toEqual([0, 1])
  })

  it('lets jump and dash cancel only after cancelAfterMs', () => {
    const { machine, press, wait } = setup(100)
    press()
    wait(150)
    expect(machine.phase()).toBe('recovery')
    expect(machine.canCancel()).toBe(false)
    expect(machine.isLocked()).toBe(true)
    wait(60)
    expect(machine.canCancel()).toBe(true)
    expect(machine.isLocked()).toBe(false)
    machine.cancel()
    expect(machine.phase()).toBe('idle')
  })

  it('divides the phase durations by the attack speed', () => {
    const normal = setup(100)
    const fast = setup(100, 2)
    for (const run of [normal, fast]) {
      run.press()
      run.wait(30)
    }
    expect(normal.machine.phase()).toBe('startup')
    expect(fast.activated).toEqual(['a'])
    expect(fast.machine.phase()).toBe('active')
  })
})
