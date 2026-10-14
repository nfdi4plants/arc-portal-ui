import type Phaser from 'phaser'
import type { GameCommand, GameEvent, GameHandle } from '../contracts/events'

export interface LoopPause {
  setPaused(paused: boolean): void
  // A resize clears the canvas. While paused, this draws one frame so the canvas is not blank.
  drawOnce(): void
}

// Handles the 'pause' command. A paused Phaser scene keeps drawing, which costs GPU time for a
// picture nobody plays. This stops the whole render loop instead. It sleeps after the next frame,
// so the canvas keeps showing the current picture behind the overlay.
// Call setPaused(false) before game.destroy(): a sleeping loop never reaches the step that destroys.
export function createLoopPause(game: Phaser.Game): LoopPause {
  let paused = false
  const setPaused = (next: boolean) => {
    paused = next
    if (next) {
      game.events.once('postrender', () => {
        if (paused) game.loop.sleep()
      })
    } else {
      game.loop.wake()
      game.loop.resetDelta()
    }
  }
  return {
    setPaused,
    drawOnce() {
      if (!paused || game.loop.running) return
      setPaused(false)
      setPaused(true)
    },
  }
}

export interface GameHandleHooks {
  // Receives each command in the order it was sent, after ready() was called.
  command(command: GameCommand): void
  resize(width: number, height: number): void
  focus(): void
  destroy(): void
}

export interface GameHandleControl {
  handle: GameHandle
  emit(event: GameEvent): void
  // Call once the first scene exists. Emits 'ready', then delivers the commands sent before.
  ready(): void
}

// The plumbing of a GameHandle: listener set, a command queue for the time before the scene
// exists, and a destroy that makes every later call a no-op. React sends 'start' right after
// createGame returns, so the queue is what keeps that command from being lost.
export function createGameHandle(hooks: GameHandleHooks): GameHandleControl {
  const listeners = new Set<(event: GameEvent) => void>()
  const pending: GameCommand[] = []
  let isReady = false
  let draining = false
  let destroyed = false

  const emit = (event: GameEvent) => {
    for (const listener of [...listeners]) listener(event)
  }

  // A command sent while draining joins the queue, so the order of sending is kept.
  const drain = () => {
    draining = true
    while (pending.length > 0 && !destroyed) hooks.command(pending.shift()!)
    draining = false
  }

  const handle: GameHandle = {
    send(command) {
      if (destroyed) return
      pending.push(command)
      if (isReady && !draining) drain()
    },
    on(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    resize(width, height) {
      if (!destroyed) hooks.resize(width, height)
    },
    focus() {
      if (!destroyed) hooks.focus()
    },
    destroy() {
      if (destroyed) return
      destroyed = true
      listeners.clear()
      pending.length = 0
      hooks.destroy()
    },
  }

  return {
    handle,
    emit(event) {
      if (!destroyed) emit(event)
    },
    ready() {
      if (destroyed || isReady) return
      emit({ type: 'ready' })
      isReady = true
      drain()
    },
  }
}
