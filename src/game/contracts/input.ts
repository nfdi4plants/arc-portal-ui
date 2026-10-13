export type Action =
  | 'left'
  | 'right'
  | 'up'
  | 'down'
  | 'jump'
  | 'dash'
  | 'light'
  | 'heavy'
  | 'ability1'
  | 'ability2'
  | 'ability3'
  | 'ability4'
  | 'pause'

export const ACTIONS: readonly Action[] = [
  'left',
  'right',
  'up',
  'down',
  'jump',
  'dash',
  'light',
  'heavy',
  'ability1',
  'ability2',
  'ability3',
  'ability4',
  'pause',
]

// Keys are bound by KeyboardEvent.code, so WASD stays in place on any keyboard layout.
export type Binding = { device: 'key'; code: string } | { device: 'mouse'; button: 0 | 1 | 2 }

// Up to two bindings per action.
export type Bindings = Record<Action, Binding[]>

// The input of one fixed physics step.
export interface InputFrame {
  held: ReadonlySet<Action>
  // Went down since the previous step.
  pressed: ReadonlySet<Action>
  released: ReadonlySet<Action>
  // Pointer position in world units, for ranged weapons.
  aim: { x: number; y: number }
}

// Falls back to the defaults on any storage error.
export type LoadBindings = () => Bindings
export type SaveBindings = (bindings: Bindings) => void
export type FindConflicts = (bindings: Bindings) => { binding: Binding; actions: Action[] }[]
