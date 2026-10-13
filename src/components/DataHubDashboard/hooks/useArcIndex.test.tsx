import { renderHook, waitFor, act } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useArcIndex } from './useArcIndex.ts'
import { fakeDataHubFetchers, gitLabProjectFull } from '../../../test/helpers.tsx'
import { AUTH_FAILED_MESSAGE } from '../../../api/gitlab/client.ts'
import { Failure, Success } from '../../../types/result.ts'
import type { DataHubConnection, DataHubFetchers } from '../../../types/dashboard.ts'

const hubA = { id: 'a', name: 'Alpha', url: 'https://a.example' }
const hubB = { id: 'b', name: 'Beta', url: 'https://b.example' }
const connections: DataHubConnection[] = [{ hub: hubA }, { hub: hubB }]

const fetchersForHubs = (overrides: Partial<DataHubFetchers> = {}) => fakeDataHubFetchers({
  fetchProjects: async source => Success([gitLabProjectFull({
    id: source === hubA.url ? 1 : 2, name: 'ARC of ' + (source === hubA.url ? hubA.name : hubB.name),
  })]),
  ...overrides,
})

describe('useArcIndex', () => {
  it('loads every DataHUB through shared callbacks with its own URL, token and signal', async () => {
    const fetchProjects = vi.fn<DataHubFetchers['fetchProjects']>(fetchersForHubs().fetchProjects)
    const fetchGroups = vi.fn<DataHubFetchers['fetchGroups']>(async () => Success([]))
    const fetchMemberProjectIds = vi.fn<DataHubFetchers['fetchMemberProjectIds']>(async () => Success([2]))
    const fetchers = fakeDataHubFetchers({ fetchProjects, fetchGroups, fetchMemberProjectIds })
    const sessions = [connections[0], { hub: hubB, token: 'beta-token' }]
    const { result } = renderHook(() => useArcIndex(sessions, fetchers))
    expect(result.current.hubs.map(hub => hub.status)).toEqual(['loading', 'loading'])
    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current.hubs.map(hub => hub.status)).toEqual(['loaded', 'loaded']))
    expect(result.current.arcs.map(arc => [arc.hubId, arc.title, arc.member]))
      .toEqual([['a', 'ARC of Alpha', false], ['b', 'ARC of Beta', true]])
    const anonymousOptions = { token: undefined, signal: expect.any(AbortSignal) }
    const authenticatedOptions = { token: 'beta-token', signal: expect.any(AbortSignal) }
    expect(fetchProjects).toHaveBeenCalledWith(hubA.url, anonymousOptions)
    expect(fetchProjects).toHaveBeenCalledWith(hubB.url, authenticatedOptions)
    expect(fetchGroups).toHaveBeenCalledWith(hubA.url, { ...anonymousOptions, allAvailable: true })
    expect(fetchGroups).toHaveBeenCalledWith(hubB.url, { ...authenticatedOptions, allAvailable: true })
    expect(fetchMemberProjectIds).toHaveBeenCalledExactlyOnceWith(hubB.url, authenticatedOptions)
    expect(result.current.loading).toBe(false)
  })

  it('marks only the failing DataHUB as failed', async () => {
    const fetchers = fetchersForHubs({ fetchProjects: async source => source === hubA.url
      ? Failure('down') : Success([gitLabProjectFull()]) })
    const { result } = renderHook(() => useArcIndex(connections, fetchers))
    await waitFor(() => expect(result.current.hubs.map(hub => hub.status)).toEqual(['failed', 'loaded']))
    expect(result.current.hubs[0].error).toBe('down')
    expect(result.current.arcs).toHaveLength(1)
  })

  it('falls back to group paths when the group list fails', async () => {
    const fetchers = fetchersForHubs({ fetchGroups: async () => Failure('no groups') })
    const { result } = renderHook(() => useArcIndex([connections[0]], fetchers))
    await waitFor(() => expect(result.current.hubs[0].status).toBe('loaded'))
    expect(result.current.arcs[0].group.label).toBe('ceplas')
  })

  it('retries only the DataHUB asked for', async () => {
    const failing = vi.fn<DataHubFetchers['fetchProjects']>()
      .mockResolvedValueOnce(Failure('down')).mockResolvedValue(Success([gitLabProjectFull()]))
    const other = vi.fn<DataHubFetchers['fetchProjects']>(async () => Success([]))
    const fetchers = fakeDataHubFetchers({ fetchProjects: (source, options) =>
      (source === hubA.url ? failing : other)(source, options) })
    const { result } = renderHook(() => useArcIndex(connections, fetchers))
    await waitFor(() => expect(result.current.hubs[0].status).toBe('failed'))
    act(() => result.current.retry('a'))
    await waitFor(() => expect(result.current.hubs[0].status).toBe('loaded'))
    expect(failing).toHaveBeenCalledTimes(2)
    expect(other).toHaveBeenCalledTimes(1)
  })

  it('keeps previous ARCs visible while updating', async () => {
    const fetchers = fetchersForHubs()
    const { result } = renderHook(() => useArcIndex(connections, fetchers))
    await waitFor(() => expect(result.current.hubs.every(hub => hub.status === 'loaded')).toBe(true))
    act(() => result.current.reload())
    expect(result.current.hubs[0].status).toBe('loading')
    expect(result.current.arcs).toHaveLength(2)
    expect(result.current.loading).toBe(false)
    await waitFor(() => expect(result.current.hubs.every(hub => hub.status === 'loaded')).toBe(true))
  })

  it('aborts old requests when a token changes', async () => {
    const signals: AbortSignal[] = []
    const fetchers = fakeDataHubFetchers({ fetchProjects: (_source, options) => {
      signals.push(options!.signal!); return new Promise(() => {})
    } })
    const { rerender } = renderHook(({ sessions }) => useArcIndex(sessions, fetchers),
      { initialProps: { sessions: connections } })
    await waitFor(() => expect(signals).toHaveLength(2))
    rerender({ sessions: [{ hub: hubA, token: 'alpha-token' }, connections[1]] })
    expect(signals[0].aborted).toBe(true)
    expect(signals[1].aborted).toBe(false)
  })

  it('sets updatedAt once every DataHUB has settled', async () => {
    const fetchers = fetchersForHubs({ fetchProjects: async () => Failure('down') })
    const { result } = renderHook(() => useArcIndex(connections, fetchers))
    expect(result.current.updatedAt).toBeNull()
    await waitFor(() => expect(result.current.updatedAt).toBeInstanceOf(Date))
    expect(result.current.hubs.every(hub => hub.status !== 'loading')).toBe(true)
  })

  it('reloads only the DataHUB whose token changes, including logout', async () => {
    const fetchProjects = vi.fn<DataHubFetchers['fetchProjects']>(fetchersForHubs().fetchProjects)
    const fetchers = fakeDataHubFetchers({ fetchProjects })
    const { result, rerender } = renderHook(({ sessions }) => useArcIndex(sessions, fetchers),
      { initialProps: { sessions: connections } })
    await waitFor(() => expect(result.current.arcs).toHaveLength(2))
    rerender({ sessions: [{ hub: hubA }, { hub: hubB, token: 'beta-token' }] })
    expect(result.current.arcs.map(arc => arc.hubId)).toEqual(['a'])
    await waitFor(() => expect(result.current.arcs).toHaveLength(2))
    expect(fetchProjects.mock.calls.filter(([source]) => source === hubA.url)).toHaveLength(1)
    expect(fetchProjects.mock.calls.filter(([source]) => source === hubB.url)).toHaveLength(2)
    rerender({ sessions: connections })
    expect(result.current.arcs.map(arc => arc.hubId)).toEqual(['a'])
    await waitFor(() => expect(result.current.arcs).toHaveLength(2))
    expect(fetchProjects.mock.calls.filter(([source]) => source === hubA.url)).toHaveLength(1)
    expect(fetchProjects.mock.calls.filter(([source]) => source === hubB.url)).toHaveLength(3)
  })

  it('starts no request when unchanged sessions arrive in a new array', async () => {
    const fetchProjects = vi.fn<DataHubFetchers['fetchProjects']>(async () => Success([]))
    const fetchers = fakeDataHubFetchers({ fetchProjects })
    const { result, rerender } = renderHook(({ sessions }) => useArcIndex(sessions, fetchers),
      { initialProps: { sessions: connections } })
    await waitFor(() => expect(result.current.hubs.every(hub => hub.status === 'loaded')).toBe(true))
    rerender({ sessions: connections.map(connection => ({ ...connection })) })
    expect(fetchProjects).toHaveBeenCalledTimes(2)
  })

  it('keeps ARCs visible with a membership error when the membership list fails', async () => {
    const fetchers = fetchersForHubs({ fetchMemberProjectIds: async () => Failure('membership down') })
    const { result } = renderHook(() => useArcIndex([{ hub: hubA, token: 'alpha-token' }], fetchers))
    await waitFor(() => expect(result.current.hubs[0].status).toBe('loaded'))
    expect(result.current.hubs[0].membershipError).toBe('membership down')
    expect(result.current.arcs).toHaveLength(1)
  })

  it('falls back to anonymous projects and groups when the saved token expires', async () => {
    const fetchProjects = vi.fn<DataHubFetchers['fetchProjects']>(async (_source, options) => options?.token
      ? Failure(AUTH_FAILED_MESSAGE) : Success([gitLabProjectFull()]))
    const fetchGroups = vi.fn<DataHubFetchers['fetchGroups']>(async (_source, options) => options?.token
      ? Failure(AUTH_FAILED_MESSAGE) : Success([]))
    const fetchers = fakeDataHubFetchers({ fetchProjects, fetchGroups,
      fetchMemberProjectIds: async () => Failure(AUTH_FAILED_MESSAGE) })
    const { result } = renderHook(() => useArcIndex([{ hub: hubA, token: 'expired-token' }], fetchers))
    await waitFor(() => expect(result.current.hubs[0].status).toBe('loaded'))
    expect(result.current.hubs[0].tokenRejected).toBe(true)
    expect(result.current.hubs[0].membershipError).toBeUndefined()
    expect(result.current.arcs[0].access).toBe('public')
    expect(fetchProjects.mock.calls.map(([source, options]) => [source, options?.token]))
      .toEqual([[hubA.url, 'expired-token'], [hubA.url, undefined]])
    expect(fetchGroups.mock.calls.map(([source, options]) => [source, options?.token]))
      .toEqual([[hubA.url, 'expired-token'], [hubA.url, undefined]])
  })

  it('still loads every DataHUB under StrictMode remounts', async () => {
    const fetchers = fetchersForHubs()
    const { result } = renderHook(() => useArcIndex(connections, fetchers), { reactStrictMode: true })
    await waitFor(() => expect(result.current.hubs.map(hub => hub.status)).toEqual(['loaded', 'loaded']))
    expect(result.current.arcs).toHaveLength(2)
  })

  it('keeps the other DataHUB visible while one reloads after login', async () => {
    const fetchers = fetchersForHubs({ fetchProjects: (_source, options) => options?.token
      ? new Promise(() => {}) : Promise.resolve(Success([gitLabProjectFull()])) })
    const { result, rerender } = renderHook(({ sessions }) => useArcIndex(sessions, fetchers),
      { initialProps: { sessions: connections } })
    await waitFor(() => expect(result.current.arcs).toHaveLength(2))
    rerender({ sessions: [{ hub: hubA }, { hub: hubB, token: 'beta-token' }] })
    expect(result.current.arcs.map(arc => arc.hubId)).toEqual(['a'])
    expect(result.current.hubs[1].status).toBe('loading')
    expect(result.current.loading).toBe(false)
  })
})
