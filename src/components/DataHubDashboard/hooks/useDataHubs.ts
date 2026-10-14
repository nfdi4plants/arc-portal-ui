import { useCallback } from 'react'
import type { DataHubConnection } from '../../../types/dashboard.ts'
import { useDashboardConfiguration } from '../configuration.ts'
import { withPublicFallback } from './requests.ts'
import { useHubRequests } from './useHubRequests.ts'

export function useDataHubs(refreshKey = 0) {
  const { fetchProjectCount } = useDashboardConfiguration()
  const load = useCallback(({ hub, token }: DataHubConnection, signal: AbortSignal) =>
    withPublicFallback(token, current => fetchProjectCount(hub.url, { token: current, signal })), [fetchProjectCount])
  return useHubRequests(load, refreshKey)
}
