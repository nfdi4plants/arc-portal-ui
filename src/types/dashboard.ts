import type { ArcKey } from '../arc/types.ts'
import type { GitLabInstance } from './gitlab.ts'
import type { GitLabCommit, GitLabContributor, GitLabGroup, GitLabProject } from './gitlab.ts'
import type { Result } from './result.ts'

export interface WorkingGroup {
  /** `hubId/topLevelPath`, or `hubId/~personal`. */
  key: string
  label: string
  hubId: string
  personal: boolean
}

/** One row of the overview. */
export interface ArcSummary {
  key: ArcKey
  projectId: number
  hubId: string
  title: string
  description: string
  group: WorkingGroup
  access: Access
  /** True when the project appears in the logged-in user's membership list. */
  member: boolean
  createdAt: string
  lastActivityAt: string
  topics: string[]
  stars: number
  url: string
}

export interface Person {
  /** Lower-cased email, falling back to the lower-cased name. */
  id: string
  name: string
}

export interface ArcDetails {
  people: Person[]
  lastChangeBy: string | null
}

export type DetailsMap = Map<string, ArcDetails | 'unavailable'>

export type Access = 'public' | 'private'
export type FilterKind = 'hub' | 'group' | 'access' | 'query' | 'recent'

export interface HeadlineNumbers {
  total: number
  public: number
  private: number
  hubs: number
  /** 'counting' while any ARC in the set still lacks details; null before details load. */
  people: number | 'counting' | null
  /** True when some ARCs' details could not be loaded. */
  peopleIncomplete: boolean
}

export interface CountItem { key: string; label: string; count: number }

export interface MonthCount { month: string; count: number }

export interface HubState {
  hub: GitLabInstance
  status: 'loading' | 'loaded' | 'failed'
  /** Keeps the last successful value during a reload. */
  arcs: ArcSummary[]
  error?: string
  /** Set when the membership list could not be loaded; "My ARCs" then shows an error. */
  membershipError?: string
  /** Set when a saved token was refused and the list fell back to the public ARCs. */
  tokenRejected?: boolean
}

export interface DashboardFilters {
  hubId?: string
  groupKey?: string
  access?: Access
  query: string
  /** Only ARCs changed within the last 30 days. */
  recent: boolean
}

export interface SortState {
  column: 'title' | 'hub' | 'lastChange'
  direction: 'ASC' | 'DESC'
}

export type ExtraColumn = 'topics' | 'created' | 'stars' | 'description'

/** One configured DataHUB with its data callbacks injected by `App`. */
export interface DataHubConnection {
  hub: GitLabInstance
  /** True only when the request carries the session token. */
  includesPrivate: boolean
  /** `tokenRejected` means the saved token was refused (401) and the result is the anonymous public list. */
  fetchProjects: (signal: AbortSignal) => Promise<Result<{ projects: GitLabProject[]; tokenRejected: boolean }>>
  fetchGroups: (signal: AbortSignal) => Promise<Result<GitLabGroup[]>>
  fetchMemberProjectIds: (signal: AbortSignal) => Promise<Result<number[]>>
  fetchContributors: (projectId: number, signal: AbortSignal) => Promise<Result<GitLabContributor[]>>
  fetchLatestCommit: (projectId: number, signal: AbortSignal) => Promise<Result<GitLabCommit | null>>
}
