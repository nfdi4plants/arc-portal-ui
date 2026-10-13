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
export type FilterKind = 'hub' | 'group' | 'access' | 'query'

export interface HeadlineNumbers {
  total: number
  public: number
  private: number
  hubs: number
  /** Filled in once contributor details are loaded. */
  people: number | null
}

export interface CountItem { key: string; label: string; count: number }

export interface MonthCount { month: string; count: number }

export interface HubState {
  hub: GitLabInstance
  status: 'loading' | 'loaded' | 'failed'
  /** Keeps the last successful value during a reload. */
  arcs: ArcSummary[]
  error?: string
}

export type AccessMode = 'accessible' | 'public'
export type SearchScope = 'all' | 'title' | 'description' | 'group' | 'topic' | 'person'

export interface DashboardFilters {
  hubId?: string
  groupKey?: string
  access?: Access
  query: string
  scope: SearchScope
}

export interface SortState {
  column: 'title' | 'hub' | 'lastChange'
  direction: 'ASC' | 'DESC'
}

export type ExtraColumn = 'topics' | 'created' | 'stars' | 'description' | 'link'

/** One configured DataHUB with its data callbacks injected by `App`. */
export interface DataHubConnection {
  hub: GitLabInstance
  /** True only when the request carries the session token. */
  includesPrivate: boolean
  fetchProjects: (signal: AbortSignal) => Promise<Result<GitLabProject[]>>
  fetchGroups: (signal: AbortSignal) => Promise<Result<GitLabGroup[]>>
  fetchContributors: (projectId: number, signal: AbortSignal) => Promise<Result<GitLabContributor[]>>
  fetchLatestCommit: (projectId: number, signal: AbortSignal) => Promise<Result<GitLabCommit | null>>
}
