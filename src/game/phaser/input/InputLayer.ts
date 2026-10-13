import Phaser from 'phaser'
import { ACTIONS } from '../../contracts/input'
import type { Action, Bindings, InputFrame } from '../../contracts/input'
import { bindingId } from '../../model/input'

export interface InputLayer {
  // Call once per fixed step. Edges collect between calls, so a tap shorter than a step still
  // shows up. The returned frame and its sets are reused: they are valid until the next call.
  frame(): InputFrame
  setBindings(bindings: Bindings): void
  setEnabled(enabled: boolean): void
  destroy(): void
}

// Reads keys and mouse buttons with DOM listeners on the game canvas. Phaser's keyboard plugin
// stays off (keyboard: false in the game config) so it never captures keys for the whole page.
export function createInputLayer(scene: Phaser.Scene, bindings: Bindings): InputLayer {
  const canvas = scene.game.canvas
  canvas.tabIndex = 0

  let actionsByInput = new Map<string, Action[]>()
  let inputsByAction = new Map<Action, string[]>()
  const down = new Set<string>()
  let pressedAcc = new Set<Action>()
  let releasedAcc = new Set<Action>()
  let enabled = true

  const out = {
    held: new Set<Action>(),
    pressed: new Set<Action>(),
    released: new Set<Action>(),
    aim: { x: 0, y: 0 },
  }
  const aimPoint = new Phaser.Math.Vector2()

  const mapBindings = (b: Bindings) => {
    actionsByInput = new Map()
    inputsByAction = new Map()
    for (const action of ACTIONS) {
      const ids = b[action].map(bindingId)
      inputsByAction.set(action, ids)
      for (const id of ids) actionsByInput.set(id, [...(actionsByInput.get(id) ?? []), action])
    }
  }

  const isHeld = (action: Action): boolean => {
    for (const id of inputsByAction.get(action) ?? []) if (down.has(id)) return true
    return false
  }

  const press = (id: string) => {
    if (down.has(id)) return
    const actions = actionsByInput.get(id) ?? []
    for (const action of actions) if (!isHeld(action)) pressedAcc.add(action)
    down.add(id)
  }

  const release = (id: string) => {
    if (!down.delete(id)) return
    for (const action of actionsByInput.get(id) ?? []) if (!isHeld(action)) releasedAcc.add(action)
  }

  const releaseAll = () => {
    for (const id of [...down]) release(id)
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (!enabled) return
    const id = `key:${event.code}`
    if (!actionsByInput.has(id)) return
    // Ctrl or Cmd shortcuts (reload, close tab) keep working even when the letter is bound.
    if (!event.ctrlKey && !event.metaKey) event.preventDefault()
    if (!event.repeat) press(id)
  }
  const onKeyUp = (event: KeyboardEvent) => {
    const id = `key:${event.code}`
    if (actionsByInput.has(id)) event.preventDefault()
    release(id)
  }
  // Mouse events fire once per button. Pointer events fire pointerdown only for the first button of
  // a chord and pointerup only for the last, so the second button would be lost.
  const onMouseDown = (event: MouseEvent) => {
    // Phaser cancels mousedown, which stops the browser from focusing the canvas on click.
    canvas.focus()
    if (!enabled || event.button > 2) return
    press(`mouse:${event.button}`)
  }
  const onMouseUp = (event: MouseEvent) => {
    if (event.button > 2) return
    release(`mouse:${event.button}`)
  }
  const onContextMenu = (event: Event) => event.preventDefault()

  mapBindings(bindings)
  canvas.addEventListener('keydown', onKeyDown)
  canvas.addEventListener('keyup', onKeyUp)
  canvas.addEventListener('mousedown', onMouseDown)
  canvas.addEventListener('mouseup', onMouseUp)
  canvas.addEventListener('contextmenu', onContextMenu)
  canvas.addEventListener('blur', releaseAll)
  window.addEventListener('mouseup', onMouseUp)
  window.addEventListener('blur', releaseAll)

  return {
    frame() {
      out.held.clear()
      if (enabled) for (const action of ACTIONS) if (isHeld(action)) out.held.add(action)

      // Hand out the collected edges and collect the next ones in last step's cleared sets.
      const pressed = pressedAcc
      const released = releasedAcc
      pressedAcc = out.pressed
      releasedAcc = out.released
      pressedAcc.clear()
      releasedAcc.clear()
      out.pressed = pressed
      out.released = released
      if (!enabled) out.pressed.clear()

      const pointer = scene.input.activePointer
      scene.cameras.main.getWorldPoint(pointer.x, pointer.y, aimPoint)
      out.aim.x = aimPoint.x
      out.aim.y = aimPoint.y
      return out
    },
    setBindings(next) {
      releaseAll()
      mapBindings(next)
    },
    setEnabled(next) {
      if (!next) releaseAll()
      enabled = next
    },
    destroy() {
      canvas.removeEventListener('keydown', onKeyDown)
      canvas.removeEventListener('keyup', onKeyUp)
      canvas.removeEventListener('mousedown', onMouseDown)
      canvas.removeEventListener('mouseup', onMouseUp)
      canvas.removeEventListener('contextmenu', onContextMenu)
      canvas.removeEventListener('blur', releaseAll)
      window.removeEventListener('mouseup', onMouseUp)
      window.removeEventListener('blur', releaseAll)
    },
  }
}
