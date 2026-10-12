import { ARC } from '@nfdi4plants/arctrl'
import type { ArcSource, ArcStatus } from './types'

// What selectors read. A new object is created only when the ARC data changes
// (load or mutate), never on status changes, so selector hooks can compare
// snapshots by identity.
export interface ArcSnapshot {
  arc: ARC | null
  revision: number
}

// Owns one parsed ARC. arctrl objects are mutable, so React can't detect changes
// by reference. Every change therefore goes through the store, which replaces
// the snapshot and notifies subscribers.
export function createArcStore(source: ArcSource) {
  let snapshot: ArcSnapshot = { arc: null, revision: 0 }
  let status: ArcStatus = { kind: 'idle' }
  let controller: AbortController | null = null
  let pending: Promise<void> | null = null
  let disposed = false
  const listeners = new Set<() => void>()

  function notify() {
    for (const listener of listeners) listener()
  }

  function setData(arc: ARC) {
    snapshot = { arc, revision: snapshot.revision + 1 }
  }

  async function run(current: AbortController): Promise<void> {
    let result: { arc: ARC } | { error: unknown }
    try {
      const json = await source.fetchROCrate(current.signal)
      // A newer load or dispose() took over: settle with the newer load instead.
      if (controller !== current) return pending ?? undefined
      result = { arc: ARC.fromROCrateJsonString(json) }
    } catch (error) {
      result = { error }
    }
    if (controller !== current) return pending ?? undefined

    controller = null
    pending = null
    if ('arc' in result) {
      setData(result.arc)
      status = { kind: 'ready' }
    } else {
      // On a failed reload the previous ARC stays readable through selectors.
      status = { kind: 'error', error: result.error }
    }
    notify()
  }

  return {
    source,

    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    getSnapshot: () => snapshot,
    getStatus: () => status,
    // The raw ARC, for selectors. Never mutate it directly; use mutate().
    getArc: () => snapshot.arc,

    // Starts loading unless a load is running or already done; `force` restarts it.
    // The returned promise settles when the latest load has settled, even if
    // this call's load was superseded by a forced one.
    load(options: { force?: boolean } = {}): Promise<void> {
      if (disposed) return Promise.resolve()
      if (!options.force) {
        if (pending) return pending
        if (status.kind === 'ready') return Promise.resolve()
      }
      controller?.abort()
      const current = new AbortController()
      controller = current
      status = { kind: 'loading' }
      notify()
      pending = run(current)
      return pending
    },

    // The only sanctioned way to change the ARC, so subscribers re-read it.
    // Refused (returns false) before the first load, during a load (the change
    // would be overwritten by the fetched ARC) and after dispose.
    mutate(change: (arc: ARC) => void): boolean {
      const arc = snapshot.arc
      if (disposed || !arc || status.kind === 'loading') return false
      try {
        change(arc)
      } finally {
        // Notify even if `change` threw halfway, since the ARC may already be modified.
        setData(arc)
        notify()
      }
      return true
    },

    // Stops any running load and turns the store inert. Subscribers are left
    // alone so mounted components unsubscribe normally.
    dispose() {
      if (disposed) return
      disposed = true
      controller?.abort()
      controller = null
      pending = null
      if (status.kind === 'loading') {
        status = { kind: 'idle' }
        notify()
      }
    },
  }
}

export type ArcStore = ReturnType<typeof createArcStore>
