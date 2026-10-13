import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useROCrate } from '../../src/arc/hooks.ts'
import { deferred } from '../../src/test/helpers.tsx'
import { crateJson } from '../helpers/sampleCrate.ts'

describe('useROCrate', () => {
  it('starts up, loads the generated package and returns a stable parsed ARC without a provider', async () => {
    const pending = deferred<Response>()
    const fetchCall = vi.fn<typeof fetch>().mockReturnValue(pending.promise)
    vi.stubGlobal('fetch', fetchCall)
    const { result, rerender } = renderHook(
      ({ source, projectId }: { source: string | null; projectId: number | null }) => useROCrate(source, projectId),
      { initialProps: { source: null as string | null, projectId: null as number | null } },
    )

    expect(result.current).toEqual({ status: 'Startup' })
    expect(fetchCall).not.toHaveBeenCalled()
    rerender({ source: 'https://datahub.example/gitlab/', projectId: 42 })
    expect(result.current).toEqual({ status: 'Loading' })
    expect(fetchCall).toHaveBeenCalledWith(
      'https://datahub.example/gitlab/api/v4/projects/42/packages/generic/isa_arc_json/0.0.1/arc-ro-crate-metadata.json',
      { headers: expect.any(Headers), signal: expect.any(AbortSignal), credentials: 'omit' },
    )
    expect(new Headers(fetchCall.mock.calls[0][1]?.headers).has('PRIVATE-TOKEN')).toBe(false)

    await act(async () => pending.resolve(new Response(crateJson)))
    expect(result.current.status).toBe('Result')
    if (result.current.status !== 'Result') throw new Error('Expected a loaded ARC')
    const arc = result.current.arc
    expect(arc.Identifier).toBe('Facultative-CAM-in-Talinum')
    expect(arc.Title).toBe('Facultative CAM in Talinum triangulare')

    rerender({ source: 'https://datahub.example/gitlab/', projectId: 42 })
    expect(result.current).toEqual({ status: 'Result', arc })
    if (result.current.status === 'Result') expect(result.current.arc).toBe(arc)
    expect(fetchCall).toHaveBeenCalledOnce()
  })

  it.each([401, 403, 404, 500])('exposes HTTP %s as an Error', async status => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(new Response('Unavailable', { status })))
    const { result } = renderHook(() => useROCrate('https://datahub.example', 42))

    await waitFor(() => expect(result.current).toEqual({
      status: 'Error', error: new Error(`Unable to load RO-Crate (${status}).`),
    }))
  })

  it('preserves the exception when a download fails', async () => {
    const error = new TypeError('Failed to fetch')
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockRejectedValue(error))
    const { result } = renderHook(() => useROCrate('https://datahub.example', 42))

    await waitFor(() => expect(result.current).toEqual({ status: 'Error', error }))
    if (result.current.status === 'Error') expect(result.current.error).toBe(error)
  })

  it.each(['not json', '{}'])('reports invalid ARC metadata as an Error: %s', async json => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(new Response(json)))
    const { result } = renderHook(() => useROCrate('https://datahub.example', 42))

    await waitFor(() => expect(result.current.status).toBe('Error'))
    if (result.current.status === 'Error') expect(result.current.error).toBeInstanceOf(Error)
  })

  it('restarts loading after Strict Mode cancels the initial effect', async () => {
    const pending = deferred<Response>()
    const fetchCall = vi.fn<typeof fetch>()
      .mockReturnValueOnce(pending.promise)
      .mockImplementation(async () => new Response(crateJson))
    vi.stubGlobal('fetch', fetchCall)
    const { result } = renderHook(() => useROCrate('https://datahub.example', 42), { reactStrictMode: true })

    expect(fetchCall.mock.calls[0][1]?.signal?.aborted).toBe(true)
    await waitFor(() => expect(result.current.status).toBe('Result'))
    if (result.current.status !== 'Result') throw new Error('Expected a loaded ARC')
    expect(result.current.arc.Identifier).toBe('Facultative-CAM-in-Talinum')
    expect(fetchCall).toHaveBeenCalledTimes(2)
  })

  it('retires an authenticated download and refetches without the token after logout', async () => {
    const pending = deferred<Response>()
    const fetchCall = vi.fn<typeof fetch>()
      .mockReturnValueOnce(pending.promise)
      .mockResolvedValueOnce(new Response('Forbidden', { status: 403 }))
    vi.stubGlobal('fetch', fetchCall)
    const { result, rerender } = renderHook(
      ({ token }: { token: string | undefined }) => useROCrate('https://datahub.example', 42, token),
      { initialProps: { token: 'runtime-token' as string | undefined } },
    )
    expect(new Headers(fetchCall.mock.calls[0][1]?.headers).get('PRIVATE-TOKEN')).toBe('runtime-token')

    rerender({ token: undefined })
    expect(fetchCall.mock.calls[0][1]?.signal?.aborted).toBe(true)
    expect(new Headers(fetchCall.mock.calls[1][1]?.headers).has('PRIVATE-TOKEN')).toBe(false)
    await waitFor(() => expect(result.current.status).toBe('Error'))
    await act(async () => pending.resolve(new Response(crateJson)))
    expect(result.current.status).toBe('Error')
  })
})
