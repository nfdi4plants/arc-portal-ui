import { renderHook, waitFor, act } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useArcIndex } from './useArcIndex.ts'
import { fakeConnection, gitLabProjectFull } from '../../../test/helpers.tsx'
import { Failure, Success } from '../../../types/result.ts'
import type { DataHubConnection } from '../../../types/dashboard.ts'

const hubA = { id: 'a', name: 'Alpha', url: 'https://a.example' }
const hubB = { id: 'b', name: 'Beta', url: 'https://b.example' }

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

  it('reloads only the DataHUB whose connection object changed', async () => {
    const projectsA = vi.fn<DataHubConnection['fetchProjects']>(async () => Success([gitLabProjectFull({ id: 1, name: 'ARC of Alpha' })]))
    const projectsB = vi.fn<DataHubConnection['fetchProjects']>(async () => Success([gitLabProjectFull({ id: 2, name: 'ARC of Beta' })]))
    const signals: Record<string, AbortSignal[]> = { a: [], b: [] }
    const firstA = fakeConnection({ hub: hubA, fetchProjects: (signal) => { signals.a.push(signal); return projectsA(signal) } })
    const firstB = fakeConnection({ hub: hubB, fetchProjects: (signal) => { signals.b.push(signal); return projectsB(signal) } })
    const { result, rerender } = renderHook(({ connections }) => useArcIndex(connections),
      { initialProps: { connections: [firstA, firstB] } })
    await waitFor(() => expect(result.current.hubs.every(hub => hub.status === 'loaded')).toBe(true))

    const secondB = fakeConnection({ hub: hubB, includesPrivate: true,
      fetchProjects: (signal) => { signals.b.push(signal); return projectsB(signal) } })
    rerender({ connections: [firstA, secondB] })
    expect(signals.a[0].aborted).toBe(false)
    expect(signals.b[0].aborted).toBe(true)
    expect(result.current.arcs.map(arc => arc.hubId)).toEqual(['a'])
    await waitFor(() => expect(projectsB).toHaveBeenCalledTimes(2))
    expect(projectsA).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(result.current.arcs.map(arc => arc.hubId)).toEqual(['a', 'b']))
  })

  it('drops the state and ARCs of a removed DataHUB', async () => {
    const connections = [connection(hubA), connection(hubB)]
    const { result, rerender } = renderHook(({ connections }) => useArcIndex(connections),
      { initialProps: { connections } })
    await waitFor(() => expect(result.current.arcs).toHaveLength(2))
    rerender({ connections: [connections[0]] })
    expect(result.current.hubs.map(hub => hub.hub.id)).toEqual(['a'])
    expect(result.current.arcs.map(arc => arc.hubId)).toEqual(['a'])
  })

  it('starts no request when the same connection objects arrive in a new array', async () => {
    const projectsA = vi.fn<DataHubConnection['fetchProjects']>(async () => Success([]))
    const projectsB = vi.fn<DataHubConnection['fetchProjects']>(async () => Success([]))
    const connections = [
      fakeConnection({ hub: hubA, fetchProjects: projectsA }),
      fakeConnection({ hub: hubB, fetchProjects: projectsB }),
    ]
    const { result, rerender } = renderHook(({ connections }) => useArcIndex(connections),
      { initialProps: { connections } })
    await waitFor(() => expect(result.current.hubs.every(hub => hub.status === 'loaded')).toBe(true))
    rerender({ connections: [connections[0], connections[1]] })
    await waitFor(() => expect(projectsA).toHaveBeenCalledTimes(1))
    expect(projectsB).toHaveBeenCalledTimes(1)
  })

  it('marks ARCs as members from the membership id list', async () => {
    const projects = [gitLabProjectFull({ id: 1 }), gitLabProjectFull({ id: 2 })]
    const connections = [fakeConnection({ hub: hubA, fetchProjects: async () => Success(projects),
      fetchMemberProjectIds: async () => Success([2]) })]
    const { result } = renderHook(() => useArcIndex(connections))
    await waitFor(() => expect(result.current.hubs[0].status).toBe('loaded'))
    expect(result.current.arcs.map(arc => [arc.projectId, arc.member])).toEqual([[1, false], [2, true]])
  })

  it('keeps the hub loaded with a membershipError when the membership list fails', async () => {
    const projects = [gitLabProjectFull({ id: 1 })]
    const connections = [fakeConnection({ hub: hubA, includesPrivate: true,
      fetchProjects: async () => Success(projects), fetchMemberProjectIds: async () => Failure('membership down') })]
    const { result } = renderHook(() => useArcIndex(connections))
    await waitFor(() => expect(result.current.hubs[0].status).toBe('loaded'))
    expect(result.current.hubs[0].membershipError).toBe('membership down')
    expect(result.current.arcs).toHaveLength(1)
  })

  it('still loads every DataHUB under StrictMode remounts', async () => {
    const connections = [connection(hubA), connection(hubB)]
    const { result } = renderHook(() => useArcIndex(connections), { reactStrictMode: true })
    await waitFor(() => expect(result.current.hubs.map(hub => hub.status)).toEqual(['loaded', 'loaded']))
    expect(result.current.arcs).toHaveLength(2)
  })

  it('is not loading while one DataHUB reloads and another has ARCs', async () => {
    const first = [connection(hubA), connection(hubB)]
    const { result, rerender } = renderHook(({ connections }) => useArcIndex(connections),
      { initialProps: { connections: first } })
    await waitFor(() => expect(result.current.arcs).toHaveLength(2))
    const loggingIn = fakeConnection({ hub: hubB, includesPrivate: true, fetchProjects: () => new Promise(() => {}) })
    rerender({ connections: [first[0], loggingIn] })
    expect(result.current.arcs.map(arc => arc.hubId)).toEqual(['a'])
    expect(result.current.hubs[1].status).toBe('loading')
    expect(result.current.loading).toBe(false)
  })
})
