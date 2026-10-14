import { useCallback, useMemo } from 'react'
import type { DataHubConnection } from '../../../types/dashboard.ts'
import type { GitLabGroup } from '../../../types/gitlab.ts'
import { map, Success } from '../../../types/result.ts'
import { useDashboardConfiguration, type DashboardGroup } from '../configuration.ts'
import { withPublicFallback } from './requests.ts'
import { useHubRequests } from './useHubRequests.ts'

export function useGroups(refreshKey = 0) {
  const { fetchGroups } = useDashboardConfiguration()
  const loadAll = useCallback(({ hub, token }: DataHubConnection, signal: AbortSignal) =>
    withPublicFallback(token, current => fetchGroups(hub.url, { allAvailable: true, token: current, signal })), [fetchGroups])
  const loadMine = useCallback(async ({ hub, token }: DataHubConnection, signal: AbortSignal) =>
    token ? map(await fetchGroups(hub.url, { allAvailable: false, token, signal }), data => ({ data, tokenRejected: false }))
      : Success({ data: [] as GitLabGroup[], tokenRejected: false }), [fetchGroups])
  const all = useHubRequests(loadAll, refreshKey)
  const mine = useHubRequests(loadMine, refreshKey)
  const allGroups = useMemo(() => all.hubs.flatMap(({ hub, data }) =>
    (data ?? []).map(group => ({ key: hub.id + '/' + group.id, hub, group }))), [all.hubs])
  const myGroups = useMemo(() => mine.hubs.flatMap(({ hub, data }) =>
    (data ?? []).map(group => ({ key: hub.id + '/' + group.id, hub, group }))), [mine.hubs])
  return { all, mine, allGroups: allGroups as DashboardGroup[], myGroups: myGroups as DashboardGroup[] }
}
