import { useEffect, useRef, useState } from 'react'
import { groupNamesFrom, toArcSummary } from '../logic/toArcSummary.ts'
import type { ArcSummary, DataHubConnection, HubState } from '../../../types/dashboard.ts'

const initialHub = (connection: DataHubConnection): HubState => ({ hub: connection.hub, status: 'loading', arcs: [] })

interface IndexState {
  hubs: HubState[]
  /** All loaded hubs flattened; keeps its identity until some hub's ARCs change. */
  arcs: ArcSummary[]
  updatedAt: Date | null
}

function nextState(state: IndexState, hubId: string, change: (hub: HubState) => HubState): IndexState {
  const hubs = state.hubs.map(hub => hub.hub.id === hubId ? change(hub) : hub)
  return {
    hubs,
    arcs: hubs.flatMap(hub => hub.arcs),
    updatedAt: hubs.every(hub => hub.status !== 'loading') ? new Date() : state.updatedAt,
  }
}

type Apply = (hubId: string, change: (hub: HubState) => HubState) => void

/** Loads one DataHUB independently; a failure here never hides another's ARCs. */
async function loadHub(connection: DataHubConnection, signal: AbortSignal, apply: Apply) {
  const id = connection.hub.id
  apply(id, hub => hub.status === 'loading' ? hub : { ...hub, status: 'loading', error: undefined })
  try {
    const [projects, groups] = await Promise.all([
      connection.fetchProjects(signal), connection.fetchGroups(signal),
    ])
    if (signal.aborted) return
    if (projects.success === false) {
      apply(id, hub => ({ ...hub, status: 'failed', error: projects.error }))
      return
    }
    // Group names are cosmetic: without them labels fall back to paths.
    const names = groups.success === true ? groupNamesFrom(groups.value) : new Map<string, string>()
    const arcs = projects.value.map(project => toArcSummary(project, connection.hub, names, !connection.includesPrivate))
    apply(id, hub => ({ ...hub, status: 'loaded', arcs, error: undefined }))
  } catch (error) {
    // Keep injected callbacks from causing an unhandled rejection.
    if (!signal.aborted) apply(id, hub => ({ ...hub, status: 'failed',
      error: error instanceof Error ? error.message : 'Unable to load ARCs.' }))
  }
}

/** Loads every DataHUB independently; a login change reloads only that DataHUB. */
export function useArcIndex(connections: DataHubConnection[]) {
  const [state, setState] = useState<IndexState>(() => ({
    hubs: connections.map(initialHub), arcs: [], updatedAt: null,
  }))
  const controllers = useRef(new Map<string, AbortController>())
  const previous = useRef(new Map<string, DataHubConnection>())
  const [reloadNonce, setReloadNonce] = useState(0)
  const forceRef = useRef(false)

  const apply: Apply = (hubId, change) => setState(previousState => nextState(previousState, hubId, change))

  useEffect(() => {
    const force = forceRef.current
    forceRef.current = false
    const currentIds = new Set(connections.map(connection => connection.hub.id))

    // Drop DataHUBs that disappeared from the configuration.
    for (const [id, controller] of controllers.current) {
      if (currentIds.has(id)) continue
      controller.abort()
      controllers.current.delete(id)
      previous.current.delete(id)
      setState(previousState => {
        const hubs = previousState.hubs.filter(hub => hub.hub.id !== id)
        return { hubs, arcs: hubs.flatMap(hub => hub.arcs), updatedAt: previousState.updatedAt }
      })
    }

    // Reload DataHUBs whose connection object changed (login/logout) or on Update.
    for (const connection of connections) {
      const id = connection.hub.id
      const last = previous.current.get(id)
      if (!force && last === connection) continue
      if (last !== undefined) {
        controllers.current.get(id)?.abort()
        controllers.current.delete(id)
      }
      const controller = new AbortController()
      controllers.current.set(id, controller)
      previous.current.set(id, connection)
      setState(previousState => {
        const missing = !previousState.hubs.some(hub => hub.hub.id === id)
        if (missing) {
          const hubs = [...previousState.hubs, initialHub(connection)]
          return { hubs, arcs: hubs.flatMap(hub => hub.arcs), updatedAt: previousState.updatedAt }
        }
        // A changed connection drops the old ARCs (they may include private ones from
        // a logged-out account); an Update keeps them visible until the new list arrives.
        return nextState(previousState, id, hub => ({ ...hub, status: 'loading', arcs: force ? hub.arcs : [], error: undefined }))
      })
      void loadHub(connection, controller.signal, apply)
    }
  }, [connections, reloadNonce])

  useEffect(() => () => {
    for (const controller of controllers.current.values()) controller.abort()
    controllers.current.clear()
  }, [])

  const retry = (hubId: string) => {
    const connection = connections.find(candidate => candidate.hub.id === hubId)
    if (!connection) return
    controllers.current.get(hubId)?.abort()
    const controller = new AbortController()
    controllers.current.set(hubId, controller)
    setState(previousState => nextState(previousState, hubId, hub => ({ ...hub, status: 'loading', error: undefined })))
    void loadHub(connection, controller.signal, apply)
  }
  const reload = () => {
    forceRef.current = true
    setReloadNonce(nonce => nonce + 1)
  }

  const { hubs, arcs, updatedAt } = state
  const loading = hubs.some(hub => hub.status === 'loading' && hub.arcs.length === 0)
  return { hubs, arcs, loading, updatedAt, retry, reload }
}