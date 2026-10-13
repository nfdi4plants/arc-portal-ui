import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useArcDetails } from './useArcDetails.ts'
import { deferred, fakeDataHubFetchers } from '../../../test/helpers.tsx'
import { Failure, Success } from '../../../types/result.ts'
import type { ArcSummary, DataHubConnection, DataHubFetchers } from '../../../types/dashboard.ts'
import type { GitLabCommit, GitLabContributor, GitLabInstance } from '../../../types/gitlab.ts'
import type { Result } from '../../../types/result.ts'

const hubA: GitLabInstance = { id: 'a', name: 'Alpha', url: 'https://a.example' }
const hubB: GitLabInstance = { id: 'b', name: 'Beta', url: 'https://b.example' }

function arc(id: number, hubId: string): ArcSummary {
  return {
    ...arcSummaryBase(),
    key: `${hubId}/arc-${id}`,
    projectId: id,
    hubId,
    title: `ARC ${id}`,
  }
}

function arcSummaryBase() {
  return {
    key: 'a/arc-0', projectId: 0, hubId: 'a', title: 'ARC', description: '', group: { key: 'a/g', label: 'G', hubId: 'a', personal: false },
    access: 'public' as const, member: false, createdAt: '', lastActivityAt: '', topics: [], stars: 0, url: '',
  }
}

const jane: GitLabContributor = { name: 'Jane Doe', email: 'jane@example.org', commits: 3 }
const commit: GitLabCommit = { author_name: 'Jane Doe', committed_date: '2026-10-01T00:00:00Z' }

const connection: DataHubConnection = { hub: hubA }

describe('useArcDetails', () => {
  it('routes contributor and commit lookups by DataHUB URL, project id and token', async () => {
    const fetchContributors = vi.fn<DataHubFetchers['fetchContributors']>(async () => Success([jane]))
    const fetchLatestCommit = vi.fn<DataHubFetchers['fetchLatestCommit']>(async () => Success(commit))
    const fetchers = fakeDataHubFetchers({ fetchContributors, fetchLatestCommit })
    const arcs = [arc(1, 'a'), arc(1, 'b')]
    const sessions = new Map([['a', connection], ['b', { hub: hubB, token: 'beta-token' }]])
    const { result } = renderHook(() => useArcDetails(arcs, sessions, fetchers))
    await waitFor(() => expect(result.current.details.size).toBe(2))
    for (const fetcher of [fetchContributors, fetchLatestCommit]) {
      expect(fetcher).toHaveBeenCalledWith(hubA.url, 1, { token: undefined, signal: expect.any(AbortSignal) })
      expect(fetcher).toHaveBeenCalledWith(hubB.url, 1, { token: 'beta-token', signal: expect.any(AbortSignal) })
    }
    expect(result.current.details.get('b/arc-1')).toEqual({
      people: [{ id: 'jane@example.org', name: 'Jane Doe' }], lastChangeBy: 'Jane Doe',
    })
  })

  it('keeps at most 4 lookups in flight and processes ARCs in order', async () => {
    const calls: number[] = []
    const pending: ReturnType<typeof deferred<Result<GitLabContributor[]>>>[] = []
    const fetchers = fakeDataHubFetchers({
      fetchContributors: (_source, projectId) => {
        calls.push(projectId)
        const gate = deferred<Result<GitLabContributor[]>>()
        pending.push(gate)
        return gate.promise
      },
      fetchLatestCommit: async () => Success(null),
    })
    const arcs = [1, 2, 3, 4, 5, 6].map(id => arc(id, 'a'))
    const { result } = renderHook(() => useArcDetails(arcs, new Map([['a', connection]]), fetchers))
    await waitFor(() => expect(pending).toHaveLength(4))
    expect(calls.slice(0, 4)).toEqual([1, 2, 3, 4])
    expect(result.current.details.size).toBe(0)
    await act(async () => {
      pending[0].resolve(Success([jane]))
      pending[1].resolve(Success([jane]))
    })
    await waitFor(() => expect(pending).toHaveLength(6))
    expect(calls.slice(4)).toEqual([5, 6])
  })

  it('stores results and marks a failing ARC unavailable while the queue continues', async () => {
    const fetchers = fakeDataHubFetchers({
      fetchContributors: async (_source, projectId) => projectId === 2 ? Failure('down') : Success([jane]),
      fetchLatestCommit: async () => Success(null),
    })
    const arcs = [arc(1, 'a'), arc(2, 'a')]
    const { result } = renderHook(() => useArcDetails(arcs, new Map([['a', connection]]), fetchers))
    await waitFor(() => expect(result.current.details.size).toBe(2))
    expect(result.current.details.get('a/arc-1')).toEqual({ people: [{ id: 'jane@example.org', name: 'Jane Doe' }], lastChangeBy: null })
    expect(result.current.details.get('a/arc-2')).toBe('unavailable')
  })

  it('aborts only the changed DataHUB, drops its stale result and fetches it again', async () => {
    const pendingB: ReturnType<typeof deferred<Result<GitLabContributor[]>>>[] = []
    const signalsB: AbortSignal[] = []
    const connA = connection
    const connB: DataHubConnection = { hub: hubB }
    const fetchers = fakeDataHubFetchers({
      fetchContributors: (source, _id, options) => {
        if (source === hubA.url) return Promise.resolve(Success([jane]))
        if (options?.token) return Promise.resolve(Success([{ name: 'New Person', email: 'new@example.org', commits: 1 }]))
        const gate = deferred<Result<GitLabContributor[]>>()
        pendingB.push(gate)
        signalsB.push(options!.signal!)
        return gate.promise
      },
      fetchLatestCommit: async () => Success(null),
    })
    const arcs = [arc(1, 'a'), arc(2, 'b')]
    const { result, rerender } = renderHook(
      ({ arcs, connections }) => useArcDetails(arcs, connections, fetchers),
      { initialProps: { arcs, connections: new Map([['a', connA], ['b', connB]]) } })
    await waitFor(() => expect(result.current.details.has('a/arc-1')).toBe(true))
    expect(pendingB).toHaveLength(1)
    const secondB = { hub: hubB, token: 'beta-token' }
    rerender({ arcs, connections: new Map([['a', connA], ['b', secondB]]) })
    expect(signalsB[0].aborted).toBe(true)
    await act(async () => { pendingB[0].resolve(Success([jane])) })
    await waitFor(() => expect(result.current.details.get('b/arc-2')).toEqual({ people: [{ id: 'new@example.org', name: 'New Person' }], lastChangeBy: null }))
    expect(result.current.details.has('a/arc-1')).toBe(true)
  })

  it('starts nothing for a new array holding the same ARCs', async () => {
    const contributors = vi.fn(async () => Success([jane]))
    const fetchers = fakeDataHubFetchers({ fetchContributors: contributors, fetchLatestCommit: async () => Success(null) })
    const arcs = [arc(1, 'a')]
    const { result, rerender } = renderHook(
      ({ arcs, connections }) => useArcDetails(arcs, connections, fetchers),
      { initialProps: { arcs, connections: new Map([['a', connection]]) } })
    await waitFor(() => expect(result.current.details.size).toBe(1))
    rerender({ arcs: [...arcs], connections: new Map([['a', connection]]) })
    await waitFor(() => expect(contributors).toHaveBeenCalledTimes(1))
  })

  it('queues only missing keys in the new order without refetching loaded ones', async () => {
    const calls: number[] = []
    const fetchers = fakeDataHubFetchers({
      fetchContributors: async (_source, projectId) => { calls.push(projectId); return Success([jane]) },
      fetchLatestCommit: async () => Success(null),
    })
    const initial = [arc(1, 'a'), arc(2, 'a')]
    const { result, rerender } = renderHook(
      ({ arcs, connections }) => useArcDetails(arcs, connections, fetchers),
      { initialProps: { arcs: initial, connections: new Map([['a', connection]]) } })
    await waitFor(() => expect(result.current.details.size).toBe(2))
    rerender({ arcs: [arc(3, 'a'), arc(1, 'a')], connections: new Map([['a', connection]]) })
    await waitFor(() => expect(calls).toEqual([1, 2, 3]))
    expect(result.current.details.has('a/arc-1')).toBe(true)
  })

  it('settles with one call per ARC despite batched state updates', async () => {
    const contributors = vi.fn(async () => Success([jane]))
    const fetchers = fakeDataHubFetchers({ fetchContributors: contributors, fetchLatestCommit: async () => Success(null) })
    const arcs = [1, 2, 3, 4, 5].map(id => arc(id, 'a'))
    const { result } = renderHook(() => useArcDetails(arcs, new Map([['a', connection]]), fetchers))
    await waitFor(() => expect(result.current.details.size).toBe(5))
    expect(contributors).toHaveBeenCalledTimes(5)
  })

  it('survives StrictMode remounts and aborts the first mount\'s lookups', async () => {
    const contributors = vi.fn<DataHubFetchers['fetchContributors']>(async () => Success([jane]))
    const fetchers = fakeDataHubFetchers({ fetchContributors: contributors, fetchLatestCommit: async () => Success(null) })
    const arcs = [arc(1, 'a')]
    const { result } = renderHook(() => useArcDetails(arcs, new Map([['a', connection]]), fetchers), { reactStrictMode: true })
    await waitFor(() => expect(result.current.details.size).toBe(1))
    const signals = contributors.mock.calls.map(call => call[2]!.signal!)
    expect(signals[0].aborted).toBe(true)
    expect(signals.filter(signal => !signal.aborted)).toHaveLength(1)
  })
})
