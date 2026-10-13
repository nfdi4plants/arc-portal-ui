import { useCallback, useEffect, useRef, useState } from 'react'
import { groupNamesFrom, toArcSummary } from '../logic/toArcSummary.ts'
import type { ArcSummary, DataHubConnection, HubState } from '../../../types/dashboard.ts'

const initialHub = (connection: DataHubConnection): HubState => ({ hub: connection.hub, status: 'loading', arcs: [] })

interface IndexState {
  hubs: HubState[]
  /** All loaded hubs flattened; keeps its identity until some hub's ARCs change. */
  arcs: ArcSummary[]
  updatedAt: Date | null
}

const initialState = (connections: DataHubConnection[]): IndexState =>
  ({ hubs: connections.map(initialHub), arcs: [], updatedAt: null })

/** Loads every DataHUB independently; a failure in one never hides another's ARCs. */
export function useArcIndex(connections: DataHubConnection[]) {
  const [state, setState] = useState(() => initialState(connections))
  const [seen, setSeen] = useState(connections)
  const [reloadCount, setReloadCount] = useState(0)
  const signalRef = useRef<AbortSignal | null>(null)

  // New connections (login/logout) must not show the previous session's ARCs.
  if (seen !== connections) {
    setSeen(connections)
    setState(initialState(connections))
  }

  const loadHub = useCallback(async (connection: DataHubConnection, signal: AbortSignal) => {
    const id = connection.hub.id
    const update = (change: (hub: HubState) => HubState) => {
      const settledAt = new Date()
      setState(previous => {
        const hubs = previous.hubs.map(hub => hub.hub.id === id ? change(hub) : hub)
        const unchanged = hubs.every((hub, index) => hub.arcs === previous.hubs[index].arcs)
        return {
          hubs,
          arcs: unchanged ? previous.arcs : hubs.flatMap(hub => hub.arcs),
          updatedAt: hubs.every(hub => hub.status !== 'loading') ? settledAt : previous.updatedAt,
        }
      })
    }
    update(hub => hub.status === 'loading' ? hub : { ...hub, status: 'loading', error: undefined })
    try {
      const [projects, groups] = await Promise.all([
        connection.fetchProjects(signal), connection.fetchGroups(signal),
      ])
      if (signal.aborted) return
      if (projects.success === false) {
        update(hub => ({ ...hub, status: 'failed', error: projects.error }))
        return
      }
      // Group names are cosmetic: without them labels fall back to paths.
      const names = groups.success === true ? groupNamesFrom(groups.value) : new Map<string, string>()
      const arcs = projects.value.map(project => toArcSummary(project, connection.hub, names, !connection.includesPrivate))
      update(hub => ({ ...hub, status: 'loaded', arcs, error: undefined }))
    } catch (error) {
      // Keep injected callbacks from causing an unhandled rejection.
      if (!signal.aborted) update(hub => ({ ...hub, status: 'failed',
        error: error instanceof Error ? error.message : 'Unable to load ARCs.' }))
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    signalRef.current = controller.signal
    for (const connection of connections) void loadHub(connection, controller.signal)
    return () => controller.abort()
  }, [connections, reloadCount, loadHub])

  const retry = useCallback((hubId: string) => {
    const connection = connections.find(candidate => candidate.hub.id === hubId)
    if (connection && signalRef.current) void loadHub(connection, signalRef.current)
  }, [connections, loadHub])
  const reload = useCallback(() => setReloadCount(count => count + 1), [])

  const { hubs, arcs, updatedAt } = state
  const loading = hubs.some(hub => hub.status === 'loading' && hub.arcs.length === 0)
  return { hubs, arcs, loading, updatedAt, retry, reload }
}
