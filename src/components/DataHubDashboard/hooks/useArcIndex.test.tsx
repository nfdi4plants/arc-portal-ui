import { renderHook, waitFor, act } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useArcIndex } from './useArcIndex.ts'
import { fakeConnection, gitLabProjectFull } from '../../../test/helpers.tsx'
import { Failure, Success } from '../../../types/result.ts'
import type { DataHubConnection } from '../../../types/dashboard.ts'

const hubA = { id: 'a', name: 'Alpha', source: 'https://a.example' }
const hubB = { id: 'b', name: 'Beta', source: 'https://b.example' }

function connection(hub: typeof hubA, fetchProjects?: DataHubConnection['fetchProjects']) {
  return fakeConnection({
    hub,
    fetchProjects: fetchProjects ?? (async () => Success([gitLabProjectFull({ id: hub === hubA ? 1 : 2, name: `ARC of ${hub.name}` })])),
  })
}

describe('useArcIndex', () => {
  it('loads every DataHUB and maps its projects', async () => {
    // Stable across renders, like the App's memoised connections.
    const connections = [connection(hubA), connection(hubB)]
    const { result } = renderHook(() => useArcIndex(connections))
    expect(result.current.hubs.map(hub => hub.status)).toEqual(['loading', 'loading'])
    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current.hubs.map(hub => hub.status)).toEqual(['loaded', 'loaded']))
    expect(result.current.arcs.map(arc => [arc.hubId, arc.title])).toEqual([['a', 'ARC of Alpha'], ['b', 'ARC of Beta']])
    expect(result.current.loading).toBe(false)
  })

  it('marks only the failing DataHUB as failed', async () => {
    const connections = [connection(hubA, async () => Failure('down')), connection(hubB)]
    const { result } = renderHook(() => useArcIndex(connections))
    await waitFor(() => expect(result.current.hubs.map(hub => hub.status)).toEqual(['failed', 'loaded']))
    expect(result.current.hubs[0].error).toBe('down')
    expect(result.current.arcs).toHaveLength(1)
  })

  it('falls back to group paths when the group list fails', async () => {
    const connections = [fakeConnection({
      hub: hubA,
      fetchProjects: async () => Success([gitLabProjectFull()]),
      fetchGroups: async () => Failure('no groups'),
    })]
    const { result } = renderHook(() => useArcIndex(connections))
    await waitFor(() => expect(result.current.hubs[0].status).toBe('loaded'))
    expect(result.current.arcs[0].group.label).toBe('ceplas')
  })

  it('retries only the DataHUB asked for', async () => {
    const failing = vi.fn<DataHubConnection['fetchProjects']>()
      .mockResolvedValueOnce(Failure('down'))
      .mockResolvedValue(Success([gitLabProjectFull()]))
    const other = vi.fn<DataHubConnection['fetchProjects']>(async () => Success([]))
    const connections = [connection(hubA, failing), connection(hubB, other)]
    const { result } = renderHook(() => useArcIndex(connections))
    await waitFor(() => expect(result.current.hubs[0].status).toBe('failed'))
    act(() => result.current.retry('a'))
    await waitFor(() => expect(result.current.hubs[0].status).toBe('loaded'))
    expect(failing).toHaveBeenCalledTimes(2)
    expect(other).toHaveBeenCalledTimes(1)
  })

  it('keeps previous ARCs visible while reloading', async () => {
    const connections = [connection(hubA)]
    const { result } = renderHook(() => useArcIndex(connections))
    await waitFor(() => expect(result.current.hubs[0].status).toBe('loaded'))
    act(() => result.current.reload())
    expect(result.current.hubs[0].status).toBe('loading')
    expect(result.current.arcs).toHaveLength(1)
    expect(result.current.loading).toBe(false)
    await waitFor(() => expect(result.current.hubs[0].status).toBe('loaded'))
  })

  it('aborts old requests when the connections change', async () => {
    const signals: AbortSignal[] = []
    const never: DataHubConnection['fetchProjects'] = (signal) => { signals.push(signal); return new Promise(() => {}) }
    const { rerender } = renderHook(({ connections }) => useArcIndex(connections),
      { initialProps: { connections: [connection(hubA, never)] } })
    await waitFor(() => expect(signals).toHaveLength(1))
    rerender({ connections: [connection(hubA, never)] })
    expect(signals[0].aborted).toBe(true)
  })

  it('sets updatedAt once every DataHUB has settled', async () => {
    const connections = [connection(hubA), connection(hubB, async () => Failure('down'))]
    const { result } = renderHook(() => useArcIndex(connections))
    expect(result.current.updatedAt).toBeNull()
    await waitFor(() => expect(result.current.updatedAt).toBeInstanceOf(Date))
    expect(result.current.hubs.every(hub => hub.status !== 'loading')).toBe(true)
  })
})
