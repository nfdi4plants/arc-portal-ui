import { createContext } from 'react'

// Undefined keeps embedded viewers outside a PopupDashlet independent.
export const PopupDashletExpandedContext = createContext<boolean | undefined>(undefined)
