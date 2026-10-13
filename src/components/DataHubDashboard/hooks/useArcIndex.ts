import { useEffect, useRef, useState } from 'react'
import { groupNamesFrom, toArcSummary } from '../logic/toArcSummary.ts'
import type { ArcSummary, DataHubConnection, DataHubFetchers, HubState } from '../../../types/dashboard.ts'
import { AUTH_FAILED_MESSAGE } from '../../../api/gitlab/client.ts'
import { getProjectCount } from '../../../api/gitlab/projectCount.ts'
import { Success, type Result } from '../../../types/result.ts'

type IndexFetchers = Pick<DataHubFetchers, 'fetchProjects' | 'fetchGroups' | 'fetchMemberProjectIds' | 'fetchProjectCount'>

/** An expired token falls back to the public list once and reports the rejection. */
async function withAnonymousFallback<T>(token: string | undefined, call: (token?: string) => Promise<Result<T>>) {
  const result = await call(token)
  if (token && result.success === false && result.error === AUTH_FAILED_MESSAGE) return { result: await call(), rejected: true }
  return { result, rejected: false }
}

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
    arcs: hubs.some((hub, index) => hub.arcs !== state.hubs[index].arcs) ? hubs.flatMap(hub => hub.arcs) : state.arcs,
    updatedAt: hubs.every(hub => hub.status !== 'loading') ? new Date() : state.updatedAt,
  }
}

type Apply = (hubId: string, change: (hub: HubState) => HubState) => void

/** Loads one DataHUB independently; a failure here never hides another's ARCs. */
async function loadHub(connection: DataHubConnection, fetchers: IndexFetchers, signal: AbortSignal, apply: Apply) {
  const id = connection.hub.id
  const { hub, token } = connection
  apply(id, hub => hub.status === 'loading' ? hub : { ...hub, status: 'loading', error: undefined })
  // Publish the small count response immediately, independently of the ARC index.
  void withAnonymousFallback(token, current => (fetchers.fetchProjectCount ?? getProjectCount)(hub.url, { token: current, signal }))
    .then(({ result }) => {
      if (!signal.aborted) apply(id, hub => ({ ...hub, projectCount: result.success ? result.value : null }))
    }).catch(() => {
      if (!signal.aborted) apply(id, hub => ({ ...hub, projectCount: null }))
    })
  try {
    const [projects, groups, memberships] = await Promise.all([
      withAnonymousFallback(token, current => fetchers.fetchProjects(hub.url, { token: current, signal })),
      withAnonymousFallback(token, current => fetchers.fetchGroups(hub.url, { allAvailable: true, token: current, signal })),
      token ? fetchers.fetchMemberProjectIds(hub.url, { token, signal }) : Promise.resolve(Success([])),
    ])
    if (signal.aborted) return
    if (projects.result.success === false) {
      const error = projects.result.error
      apply(id, hub => ({ ...hub, status: 'failed', error }))
      return
    }
    // Group names are cosmetic: without them labels fall back to paths.
    const names = groups.result.success === true ? groupNamesFrom(groups.result.value) : new Map<string, string>()
    const memberIds = memberships.success === true ? new Set(memberships.value) : null
    // A rejected token means the list is the anonymous, public one.
    const tokenRejected = projects.rejected
    const arcs = projects.result.value.map(project =>
      toArcSummary(project, hub, names, !token || tokenRejected, memberIds ?? new Set()))
    apply(id, hub => ({
      ...hub,
      status: 'loaded',
      arcs,
      error: undefined,
      tokenRejected: tokenRejected ? true : undefined,
      // A membership failure never hides the ARCs; the working-group chart names the DataHUB.
      // With a rejected token it is expected, and the expired-login banner explains it.
      membershipError: memberships.success === false && !tokenRejected ? memberships.error : undefined,
    }))
  } catch (error) {
    // Keep injected callbacks from causing an unhandled rejection.
    if (!signal.aborted) apply(id, hub => ({ ...hub, status: 'failed',
      error: error instanceof Error ? error.message : 'Unable to load ARCs.' }))
  }
}

/** Loads every DataHUB independently; a login change reloads only that DataHUB. */
export function useArcIndex(connections: DataHubConnection[], { fetchProjects, fetchGroups, fetchMemberProjectIds, fetchProjectCount = getProjectCount }: IndexFetchers) {
  const [state, setState] = useState<IndexState>(() => ({
    hubs: connections.map(initialHub), arcs: [], updatedAt: null,
  }))
  const controllers = useRef(new Map<string, AbortController>())
  const previous = useRef(new Map<string, DataHubConnection>())
  const previousFetchers = useRef<IndexFetchers | null>(null)
  const [reloadNonce, setReloadNonce] = useState(0)
  const forceRef = useRef(false)

  const apply: Apply = (hubId, change) => setState(previousState => nextState(previousState, hubId, change))

  useEffect(() => {
    const force = forceRef.current
    forceRef.current = false
    const fetchers = { fetchProjects, fetchGroups, fetchMemberProjectIds, fetchProjectCount }
    const fetchersChanged = previousFetchers.current?.fetchProjects !== fetchProjects
      || previousFetchers.current?.fetchGroups !== fetchGroups
      || previousFetchers.current?.fetchMemberProjectIds !== fetchMemberProjectIds
      || previousFetchers.current?.fetchProjectCount !== fetchProjectCount
    previousFetchers.current = fetchers
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

    // Reload only changed sessions, or every DataHUB on Update/a changed fetch callback.
    for (const connection of connections) {
      const id = connection.hub.id
      const last = previous.current.get(id)
      if (!force && !fetchersChanged && last?.hub === connection.hub && last.token === connection.token) continue
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
        return nextState(previousState, id, hub => ({ ...hub, status: 'loading', arcs: force ? hub.arcs : [],
          projectCount: force ? hub.projectCount : undefined, error: undefined }))
      })
      void loadHub(connection, fetchers, controller.signal, apply)
    }
  }, [connections, reloadNonce, fetchProjects, fetchGroups, fetchMemberProjectIds, fetchProjectCount])

  useEffect(() => () => {
    for (const controller of controllers.current.values()) controller.abort()
    controllers.current.clear()
    // StrictMode remounts with the same refs; forget the connections so the remount reloads them.
    previous.current.clear()
  }, [])

  const retry = (hubId: string) => {
    const connection = connections.find(candidate => candidate.hub.id === hubId)
    if (!connection) return
    controllers.current.get(hubId)?.abort()
    const controller = new AbortController()
    controllers.current.set(hubId, controller)
    setState(previousState => nextState(previousState, hubId, hub => ({ ...hub, status: 'loading', error: undefined })))
    void loadHub(connection, { fetchProjects, fetchGroups, fetchMemberProjectIds, fetchProjectCount }, controller.signal, apply)
  }
  const reload = () => {
    forceRef.current = true
    setReloadNonce(nonce => nonce + 1)
  }

  const { hubs, arcs, updatedAt } = state
  // Only the first load, when nothing can be shown yet; a hub reloading after a login never hides the others.
  const loading = hubs.some(hub => hub.status === 'loading') && arcs.length === 0
  return { hubs, arcs, loading, updatedAt, retry, reload }
}
