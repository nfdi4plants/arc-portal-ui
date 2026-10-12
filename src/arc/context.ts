import { createContext } from 'react'
import type { ArcRegistry } from './arcRegistry'
import type { ArcStore } from './arcStore'

// Both contexts carry long-lived instances, never data. Their values don't
// change on ARC updates, so the contexts themselves never cause re-renders.
export const ArcStoreContext = createContext<ArcStore | null>(null)
export const ArcRegistryContext = createContext<ArcRegistry | null>(null)
