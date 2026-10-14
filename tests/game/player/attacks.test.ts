import { describe, expect, it } from 'vitest'
import type { AttackMove, AttackVariant } from '../../../src/game/contracts/player'
import type { WeaponSlot } from '../../../src/game/contracts/progression'
import { PLUNGE_MAX_MS, createAttackMachine, type AttackStepEnv } from '../../../src/game/phaser/player/attacks'

const STEP_MS = 10
const NONE = { light: false, heavy: false }
const LIGHT = { light: true, heavy: false }
const HEAVY = { light: false, heavy: true }

function move(name: string, cancelAfterMs: number, extra: Partial<AttackMove> = {}): AttackMove {
  return { name, startupMs: 50, activeMs: 50, recoveryMs: 200, cancelAfterMs, allowedInAir: true, onActive: () => {}, ...extra }
}

interface Variants {
  air?: AttackMove | null
  dashLight?: AttackMove | null
  dashHeavy?: AttackMove | null
  upLight?: AttackMove | null
  upHeavy?: AttackMove | null
}

function setup(cancelAfterMs: number, attackSpeed = 1, variants: Variants = {}, heavyInAir = true) {
  const light = [move('a', cancelAfterMs), move('b', cancelAfterMs), move('c', cancelAfterMs)]
  const heavy = [move('heavy', cancelAfterMs, { allowedInAir: heavyInAir })]
  const started: { slot: WeaponSlot; comboIndex: number; name: string; variant: AttackVariant }[] = []
  const activated: string[] = []
  const landed: string[] = []
  const machine = createAttackMachine({
    movesFor: (slot) => (slot === 'light' ? light : heavy),
    variantFor(slot, variant) {
      if (variant === 'air') return slot === 'heavy' ? (variants.air ?? null) : null
      if (variant === 'dash') return (slot === 'light' ? variants.dashLight : variants.dashHeavy) ?? null
      return (slot === 'light' ? variants.upLight : variants.upHeavy) ?? null
    },
    onStart: (slot, comboIndex, m, variant) => started.push({ slot, comboIndex, name: m.name, variant }),
    onActive: (_slot, _index, m) => activated.push(m.name),
    onLand: (_slot, m) => landed.push(m.name),
  })
  const env: AttackStepEnv = { grounded: true, attackSpeed, canStart: true, dashing: false, up: false }
  const press = (pressed = LIGHT) => machine.step(STEP_MS, pressed, env)
  const wait = (ms: number) => {
    for (let t = 0; t < ms; t += STEP_MS) machine.step(STEP_MS, NONE, env)
  }
  return { machine, env, started, activated, landed, press, wait }
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

describe('attack variants', () => {
  const air = move('air', 100, { plunge: { speed: 700 }, landingLockMs: 220, onLand: () => {} })
  const dashLight = move('dashLight', 0, { keepsMomentum: true })
  const dashHeavy = move('dashHeavy', 100, { lockMs: 150 })
  const upLight = move('upLight', 60)
  const upHeavy = move('upHeavy', 100)
  const all: Variants = { air, dashLight, dashHeavy, upLight, upHeavy }

  it('plays the air heavy for a heavy press in the air', () => {
    const { env, started, press } = setup(100, 1, all, false)
    env.grounded = false
    press(HEAVY)
    expect(started).toEqual([{ slot: 'heavy', comboIndex: 0, name: 'air', variant: 'air' }])
  })

  it('keeps the ground light for a light press in the air', () => {
    const { env, started, press } = setup(100, 1, all)
    env.grounded = false
    press(LIGHT)
    expect(started[0]).toMatchObject({ name: 'a', variant: 'ground' })
  })

  it('plays the dash variants for presses during a dash', () => {
    const light = setup(100, 1, all)
    light.env.dashing = true
    light.press(LIGHT)
    const heavy = setup(100, 1, all)
    heavy.env.dashing = true
    heavy.press(HEAVY)
    expect(light.started[0]).toMatchObject({ name: 'dashLight', variant: 'dash' })
    expect(heavy.started[0]).toMatchObject({ name: 'dashHeavy', variant: 'dash' })
  })

  it('lets a dash light cancel right after its active phase, with no lock', () => {
    const { env, machine, press, wait } = setup(100, 1, all)
    env.dashing = true
    press(LIGHT)
    env.dashing = false
    // The move starts at the end of the press step, so startup and active take the whole wait.
    wait(100)
    expect(machine.phase()).toBe('recovery')
    expect(machine.lockRemainingMs()).toBe(0)
    expect(machine.canCancel()).toBe(true)
    expect(machine.isLocked()).toBe(false)
  })

  it('locks after the active phase of a dash heavy for lockMs', () => {
    const { env, machine, started, press, wait } = setup(100, 1, all)
    env.dashing = true
    press(HEAVY)
    env.dashing = false
    wait(100)
    expect(machine.phase()).toBe('recovery')
    expect(machine.lockRemainingMs()).toBeGreaterThan(0)
    // A press inside the lock waits until the lock and the cancel window allow it.
    wait(80)
    press(LIGHT)
    expect(started).toHaveLength(1)
    wait(80)
    expect(machine.lockRemainingMs()).toBe(0)
    expect(started).toHaveLength(2)
  })

  it('plays the dash variant for a press buffered during the dash', () => {
    const { env, started, press, wait } = setup(100, 1, all)
    // The dash starts on this step, so the attack waits.
    env.dashing = true
    env.canStart = false
    press(LIGHT)
    expect(started).toHaveLength(0)
    env.dashing = false
    env.canStart = true
    wait(10)
    expect(started[0]).toMatchObject({ name: 'dashLight', variant: 'dash' })
  })

  it('lets a dash win over up', () => {
    const { env, started, press } = setup(100, 1, all)
    env.dashing = true
    env.up = true
    press(LIGHT)
    expect(started[0].variant).toBe('dash')
  })

  it('plays the up variants with up held, on the ground and in the air', () => {
    const ground = setup(100, 1, all)
    ground.env.up = true
    ground.press(LIGHT)
    const inAir = setup(100, 1, all)
    inAir.env.up = true
    inAir.env.grounded = false
    inAir.press(HEAVY)
    expect(ground.started[0]).toMatchObject({ name: 'upLight', variant: 'up' })
    expect(inAir.started[0]).toMatchObject({ name: 'upHeavy', variant: 'up' })
  })

  it('keeps counting the light combo through up lights', () => {
    const { env, started, press, wait } = setup(60, 1, all)
    env.up = true
    press(LIGHT)
    wait(160)
    press(LIGHT)
    expect(started.map((s) => [s.variant, s.comboIndex])).toEqual([
      ['up', 0],
      ['up', 1],
    ])
  })

  it('ignores up for a weapon without up moves', () => {
    const ranged = setup(100, 1, { ...all, upLight: null, upHeavy: null }, false)
    ranged.env.up = true
    ranged.press(LIGHT)
    const rangedAir = setup(100, 1, { ...all, upLight: null, upHeavy: null }, false)
    rangedAir.env.up = true
    rangedAir.env.grounded = false
    rangedAir.press(HEAVY)
    expect(ranged.started[0]).toMatchObject({ name: 'a', variant: 'ground' })
    expect(rangedAir.started[0]).toMatchObject({ name: 'air', variant: 'air' })
  })

  it('leaves a light in the air with up and down held to the pogo', () => {
    // The player sets env.up only when down is not held, so the ground light (and its pogo) plays.
    const { env, started, press } = setup(100, 1, all)
    env.grounded = false
    env.up = false
    press(LIGHT)
    expect(started[0]).toMatchObject({ name: 'a', variant: 'ground' })
  })

  it('keeps a plunge active until it lands, then locks for landingLockMs', () => {
    const { env, machine, started, landed, press, wait } = setup(100, 1, all, false)
    env.grounded = false
    press(HEAVY)
    wait(400)
    expect(machine.phase()).toBe('active')
    expect(landed).toEqual([])
    env.grounded = true
    wait(10)
    expect(landed).toEqual(['air'])
    expect(machine.phase()).toBe('recovery')
    expect(machine.lockRemainingMs()).toBe(220)
    expect(machine.isLocked()).toBe(true)
    // No attack starts during the lock. A press in its last 150 ms waits for it to end.
    press(LIGHT)
    wait(140)
    expect(started).toHaveLength(1)
    press(LIGHT)
    wait(70)
    expect(machine.lockRemainingMs()).toBe(0)
    expect(started).toHaveLength(2)
    expect(landed).toEqual(['air'])
  })

  it('ends a plunge that never lands without onLand', () => {
    const { env, machine, landed, press, wait } = setup(100, 1, all, false)
    env.grounded = false
    press(HEAVY)
    wait(PLUNGE_MAX_MS + 300)
    expect(machine.phase()).toBe('idle')
    expect(machine.lockRemainingMs()).toBe(0)
    env.grounded = true
    wait(20)
    expect(landed).toEqual([])
  })

  it('fires onLand of an air move that lands after it ended', () => {
    const hover = move('hover', 100, { onLand: () => {}, landingLockMs: 50 })
    const { env, machine, landed, press, wait } = setup(100, 1, { ...all, air: hover }, false)
    env.grounded = false
    press(HEAVY)
    wait(400)
    expect(machine.phase()).toBe('idle')
    env.grounded = true
    wait(10)
    expect(landed).toEqual(['hover'])
    expect(machine.lockRemainingMs()).toBe(50)
  })

  it('drops a pending landing when the move is cancelled by a hit', () => {
    const { env, machine, landed, press, wait } = setup(100, 1, all, false)
    env.grounded = false
    press(HEAVY)
    wait(100)
    machine.cancel()
    env.grounded = true
    wait(20)
    expect(landed).toEqual([])
    expect(machine.lockRemainingMs()).toBe(0)
  })
})

describe('plunge bounce', () => {
  const air = move('air', 100, { plunge: { speed: 700 }, landingLockMs: 220, onLand: () => {} })
  const all: Variants = { air }

  function plunging() {
    const run = setup(100, 1, all, false)
    run.env.grounded = false
    run.press(HEAVY)
    run.wait(200)
    return run
  }

  it('ends the plunge on a hit, drops the landing and cancels at once', () => {
    const { env, machine, landed, wait } = plunging()
    expect(machine.phase()).toBe('active')
    expect(machine.onOwnHit()).toBe(true)
    expect(machine.phase()).toBe('recovery')
    expect(machine.canCancel()).toBe(true)
    expect(machine.lockRemainingMs()).toBe(0)
    env.grounded = true
    wait(20)
    expect(landed).toEqual([])
    expect(machine.lockRemainingMs()).toBe(0)
  })

  it('lets a landing hit cancel the landing lock', () => {
    const { env, machine, landed, wait } = plunging()
    env.grounded = true
    wait(10)
    expect(landed).toEqual(['air'])
    expect(machine.lockRemainingMs()).toBe(220)
    expect(machine.onOwnHit()).toBe(true)
    expect(machine.lockRemainingMs()).toBe(0)
    expect(machine.canCancel()).toBe(true)
  })

  it('bounces once per attack', () => {
    const { machine } = plunging()
    expect(machine.onOwnHit()).toBe(true)
    expect(machine.onOwnHit()).toBe(false)
  })

  it('does not bounce for hits long after the landing or outside an air heavy', () => {
    const late = plunging()
    late.env.grounded = true
    late.wait(300)
    expect(late.machine.onOwnHit()).toBe(false)
    const ground = setup(100)
    ground.press(HEAVY)
    ground.wait(60)
    expect(ground.machine.onOwnHit()).toBe(false)
  })
})

