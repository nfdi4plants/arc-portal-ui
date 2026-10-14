import { useEffect, useMemo, useRef, useState } from 'react'
import type { DataHubConnection } from '../../../types/dashboard.ts'
import type { Result } from '../../../types/result.ts'
import type { ResourceValue } from './requests.ts'
import { useConnections } from './useConnections.ts'

type Loader<T> = (connection: DataHubConnection, signal: AbortSignal) => Promise<Result<ResourceValue<T>>>
type ResponseState<T> = {
  token?: string
  version: number
  data?: T
  error?: string
  tokenRejected?: boolean
  updatedAt: Date
}

/** Fixed hub configuration; only changed sessions and explicit refreshes restart requests. */
export function useHubRequests<T>(load: Loader<T>, refreshKey: number) {
  const connections = useConnections()
  const [responses, setResponses] = useState(new Map<string, ResponseState<T>>())
  const [attempts, setAttempts] = useState(new Map<string, number>())
  const requests = useRef(new Map<string, { token?: string; version: number; controller: AbortController }>())

  useEffect(() => {
    for (const connection of connections) {
      const id = connection.hub.id
      const version = refreshKey + (attempts.get(id) ?? 0)
      const previous = requests.current.get(id)
      if (previous?.version === version && previous.token === connection.token) continue
      previous?.controller.abort()
      const controller = new AbortController()
      requests.current.set(id, { token: connection.token, version, controller })
      const publish = (result: Result<ResourceValue<T>>) => {
        if (controller.signal.aborted) return
        setResponses(previousResponses => new Map(previousResponses).set(id, {
          token: connection.token, version, updatedAt: new Date(),
          ...(result.success ? result.value : { error: result.error }),
        }))
      }
      void load(connection, controller.signal).then(publish, error => publish({
        success: false, error: error instanceof Error ? error.message : 'Unable to load DataHUB data.',
      }))
    }
  }, [connections, load, refreshKey, attempts])

  useEffect(() => {
    const active = requests.current
    return () => {
      for (const request of active.values()) request.controller.abort()
      active.clear()
    }
  }, [])

  const hubs = useMemo(() => connections.map(connection => {
    const version = refreshKey + (attempts.get(connection.hub.id) ?? 0)
    const response = responses.get(connection.hub.id)
    // Keep same-session data during Update so mounted group bars retain their loaders.
    const current = response && response.token === connection.token ? response : undefined
    return { ...connection, ...current, status: !current || current.version !== version ? 'loading' as const
      : current.error !== undefined ? 'failed' as const : 'loaded' as const }
  }), [connections, responses, refreshKey, attempts])
  return { hubs, retry: (id: string) => setAttempts(previous => new Map(previous).set(id, (previous.get(id) ?? 0) + 1)) }
}
