import type { ReactNode } from 'react'
import type { ArcRegistry } from './arcRegistry'
import type { ArcStore } from './arcStore'
import { ArcRegistryContext, ArcStoreContext } from './context'

// Scopes everything below it to one ARC. Nest several of these to render
// several ARCs side by side with the same components.
export function ArcProvider({ store, children }: { store: ArcStore; children: ReactNode }) {
  return <ArcStoreContext.Provider value={store}>{children}</ArcStoreContext.Provider>
}

export function ArcRegistryProvider({ registry, children }: { registry: ArcRegistry; children: ReactNode }) {
  return <ArcRegistryContext.Provider value={registry}>{children}</ArcRegistryContext.Provider>
}
