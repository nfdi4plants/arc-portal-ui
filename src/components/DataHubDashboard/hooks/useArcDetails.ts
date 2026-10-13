import { useEffect, useRef, useState } from 'react'
import type { ArcDetails, ArcSummary, DataHubConnection, DetailsMap } from '../../../types/dashboard.ts'
import { toPeople } from '../logic/people.ts'

const MAX_IN_FLIGHT = 4
const EMIT_INTERVAL_MS = 250

/** Loads people and the latest commit for every ARC, at most 4 lookups at once. */
export function useArcDetails(arcs: ArcSummary[], connectionsByHub: Map<string, DataHubConnection>) {
  const previousConnections = useRef(new Map<string, DataHubConnection>())
  const keysByHub = useRef(new Map<string, Set<string>>())
  const done = useRef(new Map<string, ArcDetails | 'unavailable'>())
  const inFlight = useRef(new Map<string, AbortController>())
  const pending = useRef<string[]>([])
  const connectionsRef = useRef(connectionsByHub)
  const arcsRef = useRef<ArcSummary[]>([])
  const arcsByKey = useRef(new Map<string, ArcSummary>())
  const [details, setDetails] = useState<DetailsMap>(new Map())
  const snapshot = useRef(new Map<string, ArcDetails | 'unavailable'>())
  const emitTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const alive = useRef(true)

  const flush = () => {
    if (!alive.current) return
    setDetails(new Map(snapshot.current))
  }
  const scheduleFlush = () => {
    if (emitTimer.current !== null) return
    emitTimer.current = setTimeout(() => {
      emitTimer.current = null
      flush()
    }, EMIT_INTERVAL_MS)
  }

  const start = (key: string) => {
    const arc = arcsByKey.current.get(key)
    const connection = connectionsRef.current.get(arc?.hubId ?? '')
    if (!arc || !connection) return
    const controller = new AbortController()
    inFlight.current.set(key, controller)
    void (async () => {
      const [contributors, commit] = await Promise.all([
        connection.fetchContributors(arc.projectId, controller.signal),
        connection.fetchLatestCommit(arc.projectId, controller.signal),
      ])
      if (controller.signal.aborted || !alive.current) return
      inFlight.current.delete(key)
      if (contributors.success === false || commit.success === false) {
        done.current.set(key, 'unavailable')
      } else {
        done.current.set(key, {
          people: toPeople(contributors.value),
          lastChangeBy: commit.value?.author_name ?? null,
        })
      }
      snapshot.current = new Map(done.current)
      scheduleFlush()
      pump()
    })()
  }

  const queueMissing = () => {
    pending.current = arcsRef.current.map(arc => arc.key).filter(key => !done.current.has(key) && !inFlight.current.has(key))
    pump()
  }

  const pump = () => {
    while (alive.current && inFlight.current.size < MAX_IN_FLIGHT && pending.current.length > 0) {
      const key = pending.current.shift()!
      if (done.current.has(key) || inFlight.current.has(key)) continue
      start(key)
    }
  }

  useEffect(() => {
    alive.current = true
    connectionsRef.current = connectionsByHub
    // DataHUBs whose connection changed or disappeared lose their lookups; the changed ones start over.
    let changed = false
    for (const [hubId, previous] of [...previousConnections.current]) {
      if (previous === connectionsByHub.get(hubId)) continue
      previousConnections.current.delete(hubId)
      for (const key of keysByHub.current.get(hubId) ?? []) {
        inFlight.current.get(key)?.abort()
        inFlight.current.delete(key)
        done.current.delete(key)
      }
      changed = true
    }
    for (const [hubId, connection] of connectionsByHub) previousConnections.current.set(hubId, connection)
    if (changed) {
      snapshot.current = new Map(done.current)
      scheduleFlush()
      queueMissing()
    }
  }, [connectionsByHub])

  useEffect(() => {
    const byKey = new Map(arcs.map(arc => [arc.key, arc]))
    arcsRef.current = arcs
    arcsByKey.current = byKey
    const byHub = new Map<string, Set<string>>()
    for (const arc of arcs) {
      if (!byHub.has(arc.hubId)) byHub.set(arc.hubId, new Set())
      byHub.get(arc.hubId)!.add(arc.key)
    }
    keysByHub.current = byHub
    queueMissing()
  }, [arcs])

  useEffect(() => () => {
    alive.current = false
    if (emitTimer.current !== null) clearTimeout(emitTimer.current)
    emitTimer.current = null
    for (const controller of inFlight.current.values()) controller.abort()
    previousConnections.current.clear()
    keysByHub.current.clear()
    done.current.clear()
    inFlight.current.clear()
    pending.current = []
    snapshot.current = new Map()
  }, [])

  return { details }
}