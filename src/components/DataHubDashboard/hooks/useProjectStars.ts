import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuthentication } from '../../../auth/context.ts'
import type { ArcSummary } from '../../../types/dashboard.ts'
import { useResult } from '../../../util/useResult.ts'
import { useDashboardConfiguration } from '../configuration.ts'

interface StarUpdate { starred: boolean; stars: number }

export function useProjectStars(hubId: string, refreshKey: number) {
  const { dataHubs, fetchStarredProjectIds, setProjectStarred } = useDashboardConfiguration()
  const { accounts } = useAuthentication()
  const hub = dataHubs.find(candidate => candidate.id === hubId)
  const token = accounts[hubId]?.session?.token
  const load = useMemo(() => {
    void refreshKey
    return hub && token ? (signal: AbortSignal) => fetchStarredProjectIds(hub.url, { token, signal }) : null
  }, [hub, token, fetchStarredProjectIds, refreshKey])
  const state = useResult(load)
  const [mutation, setMutation] = useState(() => ({
    load, pendingProjectId: null as number | null, updates: new Map<number, StarUpdate>(), error: null as string | null,
  }))
  if (mutation.load !== load) {
    setMutation({ load, pendingProjectId: null, updates: new Map(), error: null })
  }
  const activeRequest = useRef<AbortController | null>(null)
  useEffect(() => () => {
    activeRequest.current?.abort()
    activeRequest.current = null
  }, [load])

  const starredIds = useMemo(() => {
    const ids = new Set(state.result)
    for (const [id, update] of mutation.updates) {
      if (update.starred) ids.add(id)
      else ids.delete(id)
    }
    return ids
  }, [state.result, mutation.updates])

  async function toggleStar(arc: ArcSummary) {
    if (!hub || !token || state.status !== 'success' || activeRequest.current) return
    const starred = !starredIds.has(arc.projectId)
    const controller = new AbortController()
    activeRequest.current = controller
    setMutation(previous => ({ ...previous, pendingProjectId: arc.projectId, error: null }))
    try {
      const result = await setProjectStarred(hub.url, arc.projectId, starred, { token, signal: controller.signal })
      if (controller.signal.aborted) return
      if (result.success === false) {
        setMutation(previous => ({ ...previous, pendingProjectId: null, error: result.error }))
        return
      }
      setMutation(previous => ({ ...previous, pendingProjectId: null,
        updates: new Map(previous.updates).set(arc.projectId, { starred, stars: result.value.star_count }) }))
    } catch (error) {
      if (!controller.signal.aborted) setMutation(previous => ({ ...previous, pendingProjectId: null,
        error: error instanceof Error ? error.message : 'Unable to update the repository star.' }))
    } finally {
      if (activeRequest.current === controller) activeRequest.current = null
    }
  }

  return { ...state, starredIds, updates: mutation.updates, pendingProjectId: mutation.pendingProjectId,
    mutationError: mutation.error, toggleStar }
}
