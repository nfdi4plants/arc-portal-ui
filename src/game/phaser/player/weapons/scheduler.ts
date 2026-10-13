export interface Scheduler {
  // Runs `run` after `delayMs` of loadout time, which stands still during hit-stop. A full list
  // drops the call.
  at(delayMs: number, run: () => void): void
  update(dtMs: number): void
  clear(): void
}

// A fixed-size list of pending callbacks. The slots are allocated once, so stepping it never
// allocates. Only the closures handed to `at` are created per call.
export function createScheduler(capacity = 64): Scheduler {
  const remaining = new Float64Array(capacity)
  const tasks: ((() => void) | null)[] = Array.from({ length: capacity }, () => null)
  let pending = 0

  return {
    at(delayMs, run) {
      for (let i = 0; i < capacity; i++) {
        if (tasks[i]) continue
        tasks[i] = run
        remaining[i] = delayMs
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
    clear() {
      tasks.fill(null)
      pending = 0
    },
  }
}
