import type { ArcKey } from '../arc/types.ts'
import type { GitLabInstance, GitLabRequestOptions, ListGroupsOptions } from './gitlab.ts'
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
export type FilterKind = 'hub' | 'group' | 'query' | 'recent'

export interface CountItem { key: string; label: string; count: number }

export interface HubState {
  hub: GitLabInstance
  status: 'loading' | 'loaded' | 'failed'
  /** Keeps the last successful value during a reload. */
  arcs: ArcSummary[]
  /** Undefined while loading; null when the fast count is unavailable. */
  projectCount?: number | null
  error?: string
  /** Set when the membership list could not be loaded; "My ARCs" then shows an error. */
  membershipError?: string
  /** Set when a saved token was refused and the list fell back to the public ARCs. */
  tokenRejected?: boolean
}

export interface DashboardFilters {
  hubId?: string
  groupKey?: string
  query: string
  /** Only ARCs changed within the last 30 days. */
  recent: boolean
}

export interface SortState {
  column: 'title' | 'hub' | 'lastChange'
  direction: 'ASC' | 'DESC'
}

export type ExtraColumn = 'topics' | 'created' | 'stars' | 'description'

/** One configured DataHUB and its optional authenticated session. */
export interface DataHubConnection {
  hub: GitLabInstance
  token?: string
}

/** Shared fetch callbacks receive the GitLab instance URL and optional token/signal. */
export interface DataHubFetchers {
  /** Fast count, capped at 10,000; null if pagination headers are unavailable. */
  fetchProjectCount?: (source: string, options?: GitLabRequestOptions) => Promise<Result<number | null>>
  fetchProjects: (source: string, options?: GitLabRequestOptions) => Promise<Result<GitLabProject[]>>
  fetchGroups: (source: string, options?: Omit<ListGroupsOptions, 'page' | 'perPage'>) => Promise<Result<GitLabGroup[]>>
  fetchMemberProjectIds: (source: string, options?: GitLabRequestOptions) => Promise<Result<number[]>>
  fetchContributors: (source: string, projectId: number, options?: GitLabRequestOptions) => Promise<Result<GitLabContributor[]>>
  fetchLatestCommit: (source: string, projectId: number, options?: GitLabRequestOptions) => Promise<Result<GitLabCommit | null>>
}
