import type { ArcFetchOptions, ArcPage } from './arc.ts'
import type { GitLabGroup } from './gitlab.ts'
import type { Result } from './result.ts'

export type FetchGroups = (signal: AbortSignal) => Promise<Result<GitLabGroup[]>>
export type FetchGroupArcs = (groupId: number, options?: ArcFetchOptions) => Promise<Result<ArcPage>>

export interface OrganisationBrowserProps {
  fetchPublicGroups: FetchGroups
  fetchMembershipGroups: FetchGroups | null
  fetchGroupProjects: FetchGroupArcs
}
