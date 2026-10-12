import { createArcStore, type ArcStore } from './arcStore'
import type { ArcKey, ArcSource } from './types'

// Holds one store per ARC. The single-ARC view takes one store out of it; a
// multi-ARC view can iterate over `getKeys()` and wrap each item in its own provider.
export function createArcRegistry() {
  const stores = new Map<ArcKey, ArcStore>()
  const listeners = new Set<() => void>()
  // Kept as a cached array so it can be used as a useSyncExternalStore snapshot.
  let keys: readonly ArcKey[] = []

  function emit() {
    keys = [...stores.keys()]
    for (const listener of listeners) listener()
  }

  return {
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    getKeys: () => keys,
    get: (key: ArcKey) => stores.get(key),

    // Adding the same key twice returns the existing store.
    add(source: ArcSource): ArcStore {
      const existing = stores.get(source.key)
      if (existing) return existing
      const store = createArcStore(source)
      stores.set(source.key, store)
      emit()
      return store
    },

    remove(key: ArcKey) {
      const store = stores.get(key)
      if (!store) return
      store.dispose()
      stores.delete(key)
      emit()
    },
  }
}

export type ArcRegistry = ReturnType<typeof createArcRegistry>
