import { createContext } from 'react'

// Undefined keeps embedded viewers outside a PopupDashlet independent.
export type PopupDashletMode = 'compact' | 'preview' | 'expanded'
export const PopupDashletModeContext = createContext<PopupDashletMode | undefined>(undefined)
