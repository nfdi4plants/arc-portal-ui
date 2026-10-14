import { useMemo } from 'react'
import { useAuthentication } from '../../../auth/context.ts'
import { useDashboardConfiguration } from '../configuration.ts'
import type { DataHubConnection } from '../../../types/dashboard.ts'

export function useConnections(): DataHubConnection[] {
  const { dataHubs } = useDashboardConfiguration()
  const { accounts } = useAuthentication()
  const tokens = JSON.stringify(dataHubs.map(hub => accounts[hub.id]?.session?.token ?? null))
  // Account errors/checking flags do not change connection identities.
  return useMemo(() => {
    const values: (string | null)[] = JSON.parse(tokens)
    return dataHubs.map((hub, index) => ({ hub, token: values[index] ?? undefined }))
  }, [dataHubs, tokens])
}
