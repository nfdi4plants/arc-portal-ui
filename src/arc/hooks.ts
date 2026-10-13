import type { ARC } from '@nfdi4plants/arctrl'
import { useCallback, useContext, useSyncExternalStore } from 'react'
import { useSyncExternalStoreWithSelector } from 'use-sync-external-store/with-selector'
import type { ArcStore, ArcSnapshot } from './arcStore'
import { ArcRegistryContext, ArcStoreContext } from './context'
import { plainEqual } from './plainEqual'
import type { ArcKey, ArcStatus } from './types'

export function useArcStore(): ArcStore {
  const store = useContext(ArcStoreContext)
  if (!store) throw new Error('useArcStore must be used inside an <ArcProvider>.')
  return store
}

export function useArcRegistry() {
  const registry = useContext(ArcRegistryContext)
  if (!registry) throw new Error('useArcRegistry must be used inside an <ArcRegistryProvider>.')
  return registry
}

export function useArcStatus(): ArcStatus {
  const store = useArcStore()
  return useSyncExternalStore(store.subscribe, store.getStatus)
}

export function useArcKeys(): readonly ArcKey[] {
  const registry = useArcRegistry()
  return useSyncExternalStore(registry.subscribe, registry.getKeys)
}

// Derives a value from a given store's ARC. Returns undefined until the ARC has
// loaded. Recomputes when the ARC data changes (not on status changes) and
// re-renders only if the result differs by `isEqual` (structural by default),
// so inline selectors are fine and unchanged results keep their identity.
export function useStoreSelector<T>(
  store: ArcStore,
  selector: (arc: ARC) => T,
  isEqual: (a: T | undefined, b: T | undefined) => boolean = plainEqual,
): T | undefined {
  const selectFromSnapshot = useCallback(
    (snapshot: ArcSnapshot) => (snapshot.arc ? selector(snapshot.arc) : undefined),
    [selector],
  )
  return useSyncExternalStoreWithSelector(store.subscribe, store.getSnapshot, undefined, selectFromSnapshot, isEqual)
}

// useStoreSelector for the ARC of the nearest <ArcProvider>.
export function useArcSelector<T>(
  selector: (arc: ARC) => T,
  isEqual?: (a: T | undefined, b: T | undefined) => boolean,
): T | undefined {
  return useStoreSelector(useArcStore(), selector, isEqual)
}
