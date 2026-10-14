import { useMemo } from 'react'
import { useAuthentication } from '../../../auth/context.ts'
import type { ListProjectsOptions } from '../../../types/gitlab.ts'
import { useResult } from '../../../util/useResult.ts'
import { useDashboardConfiguration } from '../configuration.ts'
import { withPublicFallback } from './requests.ts'

export interface ProjectSelection { hubId: string; groupId?: number }
export type ProjectPageOptions = Pick<ListProjectsOptions, 'page' | 'search' | 'orderBy' | 'sort' | 'lastActivityAfter'>

export function useProjectsPage({ hubId, groupId }: ProjectSelection,
  { page = 1, search, orderBy = 'last_activity_at', sort = 'desc', lastActivityAfter }: ProjectPageOptions, refreshKey = 0) {
  const { dataHubs, fetchProjects, fetchGroupProjects } = useDashboardConfiguration()
  const { accounts } = useAuthentication()
  const hub = dataHubs.find(candidate => candidate.id === hubId)
  const token = accounts[hubId]?.session?.token
  const load = useMemo(() => {
    void refreshKey
    return hub ? (signal: AbortSignal) => withPublicFallback(token, current => {
      const options = { token: current, signal, page, perPage: 25, search: search || undefined, orderBy, sort,
        visibility: current ? undefined : 'public' as const }
      return groupId === undefined
        ? fetchProjects(hub.url, { ...options, lastActivityAfter })
        : fetchGroupProjects(hub.url, groupId, options)
    }) : null
  }, [hub, token, groupId, page, search, orderBy, sort, lastActivityAfter, fetchProjects, fetchGroupProjects, refreshKey])
  return { ...useResult(load), hub }
}
