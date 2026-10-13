import type { ARC } from '@nfdi4plants/arctrl'
import { useCallback, useContext, useEffect, useMemo, useSyncExternalStore } from 'react'
import { useSyncExternalStoreWithSelector } from 'use-sync-external-store/with-selector'
import { createArcStore, type ArcStore, type ArcSnapshot } from './arcStore'
import { ArcRegistryContext, ArcStoreContext } from './context'
import { plainEqual } from './plainEqual'
import type { ArcKey, ArcStatus } from './types'

export type State<T> =
  | { status: 'Startup' }
  | { status: 'Loading' }
  | { status: 'Error'; error: Error }
  | { status: 'Result'; arc: T }

const idleStatus: ArcStatus = { kind: 'idle' }
const getIdleStatus = () => idleStatus
const subscribeIdle = () => () => {}

/** Downloads and parses the generated DataHub export, exposing the loaded ARC directly. */
export function useROCrate(source: string | null, projectId: number | null, token?: string): State<ARC> {
  const store = useMemo(() => {
    if (source === null || projectId === null) return null
    const url = `${source.replace(/\/+$/, '')}/api/v4/projects/${projectId}/packages/generic/isa_arc_json/0.0.1/arc-ro-crate-metadata.json`
    return createArcStore({
      key: url,
      label: `ARC ${projectId}`,
      async fetchROCrate(signal) {
        const headers = new Headers({ Accept: 'application/json' })
        if (token) headers.set('PRIVATE-TOKEN', token)
        const response = await fetch(url, { headers, signal, credentials: 'omit' })
        if (!response.ok) throw new Error(`Unable to load RO-Crate (${response.status}).`)
        return response.text()
      },
    })
  }, [source, projectId, token])

  const status = useSyncExternalStore(store?.subscribe ?? subscribeIdle, store?.getStatus ?? getIdleStatus)

  useEffect(() => {
    if (!store) return
    void store.load()
    // Reversible cleanup lets Strict Mode replay the effect on the same store.
    return () => store.cancelLoad()
  }, [store])

  if (!store) return { status: 'Startup' }
  switch (status.kind) {
    case 'idle': return { status: 'Startup' }
    case 'loading': return { status: 'Loading' }
    // A ready store always has a successfully parsed ARC.
    case 'ready': return { status: 'Result', arc: store.getArc()! }
    case 'error': return { status: 'Error', error: status.error instanceof Error ? status.error : new Error(String(status.error)) }
  }
}

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
