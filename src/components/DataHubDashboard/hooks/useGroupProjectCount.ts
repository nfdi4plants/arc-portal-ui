import { useMemo } from 'react'
import { useAuthentication } from '../../../auth/context.ts'
import { useResult } from '../../../util/useResult.ts'
import { useDashboardConfiguration } from '../configuration.ts'
import { withPublicFallback } from './requests.ts'

export function useGroupProjectCount(hubId: string, groupId: number, refreshKey = 0) {
  const { dataHubs, fetchGroupProjectCount } = useDashboardConfiguration()
  const { accounts } = useAuthentication()
  const hub = dataHubs.find(candidate => candidate.id === hubId)
  const token = accounts[hubId]?.session?.token
  const load = useMemo(() => {
    // An Update deliberately creates a new loader.
    void refreshKey
    return hub && token ? (signal: AbortSignal) => withPublicFallback(token,
      current => fetchGroupProjectCount(hub.url, groupId, { token: current, signal })) : null
  }, [hub, token, groupId, fetchGroupProjectCount, refreshKey])
  return useResult(load)
}
