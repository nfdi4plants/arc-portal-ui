import { ACTIONS } from '../../contracts/input'
import type { Action, Binding, Bindings, FindConflicts, LoadBindings, SaveBindings } from '../../contracts/input'

export const BINDINGS_STORAGE_KEY = 'arc-mage.bindings.v1'

const key = (code: string): Binding => ({ device: 'key', code })
const mouse = (button: 0 | 1 | 2): Binding => ({ device: 'mouse', button })

export const DEFAULT_BINDINGS: Bindings = {
  left: [key('KeyA')],
  right: [key('KeyD')],
  up: [key('KeyW')],
  down: [key('KeyS')],
  jump: [key('Space')],
  dash: [key('ShiftLeft')],
  light: [mouse(0)],
  heavy: [mouse(2)],
  ability1: [key('KeyQ')],
  ability2: [key('KeyE')],
  ability3: [key('KeyR')],
  ability4: [key('KeyF')],
  pause: [key('Escape')],
}

const MAX_BINDINGS_PER_ACTION = 2

function cloneBindings(bindings: Bindings): Bindings {
  const copy = {} as Bindings
  for (const action of ACTIONS) copy[action] = bindings[action].map((b) => ({ ...b }))
  return copy
}

function parseBinding(value: unknown): Binding | null {
  if (typeof value !== 'object' || value === null) return null
  const v = value as Record<string, unknown>
  if (v.device === 'key' && typeof v.code === 'string' && v.code.length > 0) return key(v.code)
  if (v.device === 'mouse' && (v.button === 0 || v.button === 1 || v.button === 2)) return mouse(v.button)
  return null
}

// Actions missing from storage (for example added in a later version) keep their defaults.
export const loadBindings: LoadBindings = () => {
  const result = cloneBindings(DEFAULT_BINDINGS)
  let raw: string | null = null
  try {
    raw = localStorage.getItem(BINDINGS_STORAGE_KEY)
  } catch {
    return result
  }
  if (!raw) return result
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return result
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return result
  const stored = parsed as Record<string, unknown>
  for (const action of ACTIONS) {
    const list = stored[action]
    if (!Array.isArray(list)) continue
    const bindings = list.map(parseBinding).filter((b): b is Binding => b !== null)
    if (bindings.length !== list.length) continue
    result[action] = bindings.slice(0, MAX_BINDINGS_PER_ACTION)
  }
  return result
}

export const saveBindings: SaveBindings = (bindings) => {
  try {
    localStorage.setItem(BINDINGS_STORAGE_KEY, JSON.stringify(bindings))
  } catch {
    // Private mode or a full quota. The bindings still apply for this session.
  }
}

export function bindingId(binding: Binding): string {
  return binding.device === 'key' ? `key:${binding.code}` : `mouse:${binding.button}`
}

export const findConflicts: FindConflicts = (bindings) => {
  const byInput = new Map<string, { binding: Binding; actions: Action[] }>()
  for (const action of ACTIONS) {
    for (const binding of bindings[action] ?? []) {
      const id = bindingId(binding)
      const entry = byInput.get(id) ?? { binding, actions: [] }
      if (!entry.actions.includes(action)) entry.actions.push(action)
      byInput.set(id, entry)
    }
  }
  return [...byInput.values()].filter((entry) => entry.actions.length > 1)
}

const MOUSE_LABELS = ['Left mouse', 'Middle mouse', 'Right mouse'] as const

const CODE_LABELS: Record<string, string> = {
  Space: 'Space',
  ShiftLeft: 'Left Shift',
}

export function bindingLabel(binding: Binding): string {
  if (binding.device === 'mouse') return MOUSE_LABELS[binding.button]
  const { code } = binding
  if (CODE_LABELS[code]) return CODE_LABELS[code]
  const match = /^(?:Key|Digit)(.)$/.exec(code)
  if (match) return match[1]
  return code
}
