import type { SearchScope } from '../../types/dashboard.ts'

export type ChipKind = 'hub' | 'group' | 'access' | 'query'

export const SCOPES: { scope: SearchScope; label: string }[] = [
  { scope: 'all', label: 'Everything' },
  { scope: 'title', label: 'Title' },
  { scope: 'description', label: 'Description' },
  { scope: 'group', label: 'Working group' },
  { scope: 'topic', label: 'Topic' },
  { scope: 'person', label: 'Person' },
]
