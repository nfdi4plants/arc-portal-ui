import { useMemo } from 'react'
import { useAuthentication } from '../../../auth/context.ts'
import type { GitLabPage, GitLabProject, ListProjectsOptions } from '../../../types/gitlab.ts'
import { Failure, map, type Result } from '../../../types/result.ts'
import { useResult } from '../../../util/useResult.ts'
import { useDashboardConfiguration } from '../configuration.ts'
import { withPublicFallback, type ResourceValue } from './requests.ts'

export interface ProjectSelection { hubId: string; groupId?: number }
export type ProjectPageOptions = Pick<ListProjectsOptions, 'page' | 'search' | 'orderBy' | 'sort' | 'lastActivityAfter' | 'membership' | 'starred'>

export function useProjectsPage({ hubId, groupId }: ProjectSelection,
  { page = 1, search, orderBy = 'last_activity_at', sort = 'desc', lastActivityAfter, membership, starred }: ProjectPageOptions, refreshKey = 0) {
  const { dataHubs, fetchProjects, fetchGroupProjects } = useDashboardConfiguration()
  const { accounts } = useAuthentication()
  const hub = dataHubs.find(candidate => candidate.id === hubId)
  const token = accounts[hubId]?.session?.token
  const load = useMemo(() => {
    void refreshKey
    return hub ? async (signal: AbortSignal): Promise<Result<ResourceValue<GitLabPage<GitLabProject>>>> => {
      const request = (current?: string) => {
        const options = { token: current, signal, page, perPage: 25, search: search || undefined, orderBy, sort,
          visibility: current ? undefined : 'public' as const }
        return groupId === undefined
          ? fetchProjects(hub.url, { ...options, lastActivityAfter, membership, starred })
          : fetchGroupProjects(hub.url, groupId, options)
      }
      // User-specific lists must never fall back to unrelated public repositories.
      if (membership || starred) return token
        ? map(await request(token), data => ({ data, tokenRejected: false }))
        : Failure('Log in to ' + hub.name + ' to see your ' + (starred ? 'starred ' : '') + 'repositories.')
      return withPublicFallback(token, request)
    } : null
  }, [hub, token, groupId, page, search, orderBy, sort, lastActivityAfter, membership, starred, fetchProjects, fetchGroupProjects, refreshKey])
  return { ...useResult(load), hub }
}
