import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Bindings } from '../../../src/game/contracts/input'
import {
  BINDINGS_STORAGE_KEY,
  DEFAULT_BINDINGS,
  bindingLabel,
  findConflicts,
  loadBindings,
  saveBindings,
} from '../../../src/game/model/input'

afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
})

describe('bindings', () => {
  it('uses WASD, Space, Shift and the mouse buttons by default', () => {
    expect(DEFAULT_BINDINGS.left).toEqual([{ device: 'key', code: 'KeyA' }])
    expect(DEFAULT_BINDINGS.jump).toEqual([{ device: 'key', code: 'Space' }])
    expect(DEFAULT_BINDINGS.dash).toEqual([{ device: 'key', code: 'KeyC' }])
    expect(DEFAULT_BINDINGS.light).toEqual([{ device: 'mouse', button: 0 }])
    expect(DEFAULT_BINDINGS.heavy).toEqual([{ device: 'mouse', button: 2 }])
    expect(DEFAULT_BINDINGS.ability4).toEqual([{ device: 'key', code: 'KeyF' }])
    expect(DEFAULT_BINDINGS.pause).toEqual([{ device: 'key', code: 'Escape' }])
    expect(findConflicts(DEFAULT_BINDINGS)).toEqual([])
  })

  it('loads what it saved', () => {
    const custom: Bindings = { ...DEFAULT_BINDINGS, jump: [{ device: 'key', code: 'KeyK' }, { device: 'mouse', button: 1 }] }
    saveBindings(custom)
    expect(loadBindings()).toEqual(custom)
  })

  it('falls back to the defaults when storage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota')
    })
    expect(() => saveBindings(DEFAULT_BINDINGS)).not.toThrow()
    expect(loadBindings()).toEqual(DEFAULT_BINDINGS)
  })

  it('fills actions missing from storage with their defaults', () => {
    localStorage.setItem(BINDINGS_STORAGE_KEY, JSON.stringify({ jump: [{ device: 'key', code: 'KeyK' }] }))
    const loaded = loadBindings()
    expect(loaded.jump).toEqual([{ device: 'key', code: 'KeyK' }])
    expect(loaded.left).toEqual(DEFAULT_BINDINGS.left)
    expect(loaded.pause).toEqual(DEFAULT_BINDINGS.pause)
  })

  it('reports an input bound to more than one action', () => {
    const bindings: Bindings = { ...DEFAULT_BINDINGS, dash: [{ device: 'key', code: 'Space' }] }
    expect(findConflicts(bindings)).toEqual([{ binding: { device: 'key', code: 'Space' }, actions: ['jump', 'dash'] }])
  })

  it('labels keys and mouse buttons', () => {
    expect(bindingLabel({ device: 'key', code: 'KeyW' })).toBe('W')
    expect(bindingLabel({ device: 'key', code: 'Digit1' })).toBe('1')
    expect(bindingLabel({ device: 'key', code: 'Space' })).toBe('Space')
    expect(bindingLabel({ device: 'key', code: 'ShiftLeft' })).toBe('Left Shift')
    expect(bindingLabel({ device: 'mouse', button: 2 })).toBe('Right mouse')
    expect(bindingLabel({ device: 'key', code: 'F5' })).toBe('F5')
  })
})
