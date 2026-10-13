// Callbacks that need no group. Only a group above this can be cancelled.
export const UNGROUPED = 0

export interface Scheduler {
  // Runs `run` after `delayMs` of loadout time, which stands still during hit-stop. A full list
  // drops the call. Calls in a group above UNGROUPED can be dropped together with `cancel`.
  at(delayMs: number, run: () => void, group?: number): void
  update(dtMs: number): void
  // Drops the pending calls of one group.
  cancel(group: number): void
  clear(): void
}

// A fixed-size list of pending callbacks. The slots are allocated once, so stepping it never
// allocates. Only the closures handed to `at` are created per call.
export function createScheduler(capacity = 64): Scheduler {
  const remaining = new Float64Array(capacity)
  const groups = new Int32Array(capacity)
  const tasks: ((() => void) | null)[] = Array.from({ length: capacity }, () => null)
  let pending = 0

  return {
    at(delayMs, run, group = UNGROUPED) {
      for (let i = 0; i < capacity; i++) {
        if (tasks[i]) continue
        tasks[i] = run
        remaining[i] = delayMs
        groups[i] = group
        pending++
        return
      }
    },
    update(dtMs) {
      if (pending === 0) return
      for (let i = 0; i < capacity; i++) {
        const run = tasks[i]
        if (!run) continue
        remaining[i] -= dtMs
        if (remaining[i] > 0) continue
        // Free the slot first, so the callback may schedule again.
        tasks[i] = null
        pending--
        run()
      }
    },
    cancel(group) {
      if (pending === 0 || group === UNGROUPED) return
      for (let i = 0; i < capacity; i++) {
        if (!tasks[i] || groups[i] !== group) continue
        tasks[i] = null
        pending--
      }
    },
    clear() {
      tasks.fill(null)
      pending = 0
    },
  }
}
