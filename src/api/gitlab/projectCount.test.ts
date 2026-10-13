import { describe, expect, it, vi } from 'vitest'
import { getProjectCount } from './index.ts'
import { Failure, Success } from '../../types/result.ts'

const source = 'https://gitlab.example/gitlab/'

/** A stable visible catalogue with exclusive ID filters and GitLab's count limit. */
function catalogue(ids: number[], mode: 'normal' | 'hidden' | 'no-total' = 'normal') {
  const descending = [...ids].sort((a, b) => b - a)
  return vi.fn<typeof fetch>(async input => {
    const params = new URL(String(input)).searchParams
    const after = Number(params.get('id_after') ?? 0)
    const before = Number(params.get('id_before') ?? Infinity)
    const matching = descending.filter(id => id > after && id < before)
    const perPage = Number(params.get('per_page'))
    const headers: Record<string, string> = mode === 'hidden' ? {} : {
      'X-Per-Page': String(perPage), 'X-Next-Page': matching.length > perPage ? '2' : '',
    }
    if (mode !== 'hidden' && mode !== 'no-total') {
      if (matching.length <= 10_000) headers['X-Total'] = String(matching.length)
    }
    return Response.json(matching.slice(0, perPage).map(id => ({ id })), { headers })
  })
}

describe('getProjectCount', () => {
  it('counts public projects including archives with one small anonymous request', async () => {
    const fetchCall = catalogue([7, 90, 103])
    expect(await getProjectCount(source, { fetchCall })).toEqual(Success(3))
    expect(fetchCall).toHaveBeenCalledTimes(1)
    const [input, init] = fetchCall.mock.calls[0]
    const url = new URL(String(input))
    expect(url.pathname).toBe('/gitlab/api/v4/projects')
    expect(Object.fromEntries(url.searchParams)).toEqual({
      simple: 'true', order_by: 'id', sort: 'desc', per_page: '1', visibility: 'public',
    })
    expect(init?.credentials).toBe('omit')
    expect(new Headers(init?.headers).has('PRIVATE-TOKEN')).toBe(false)
  })

  it('counts accessible projects with a runtime token and forwards cancellation', async () => {
    const fetchCall = catalogue([12, 20])
    const controller = new AbortController()
    expect(await getProjectCount(source, { fetchCall, token: 'runtime-token', signal: controller.signal })).toEqual(Success(2))
    const [input, init] = fetchCall.mock.calls[0]
    expect(new URL(String(input)).searchParams.has('visibility')).toBe(false)
    expect(new Headers(init?.headers).get('PRIVATE-TOKEN')).toBe('runtime-token')
    expect(init?.signal).toBe(controller.signal)
    expect(String(input)).not.toContain('runtime-token')
  })

  it('returns zero for an empty visible catalogue even without headers', async () => {
    const fetchCall = catalogue([], 'hidden')
    expect(await getProjectCount(source, { fetchCall })).toEqual(Success(0))
    expect(fetchCall).toHaveBeenCalledTimes(1)
  })

  it.each([10_000, 10_001])('resolves counts at and above the total-header limit for %s projects', async count => {
    const fetchCall = catalogue(Array.from({ length: count }, (_, index) => index + 1))
    expect(await getProjectCount(source, { fetchCall })).toEqual(Success(count))
    expect(fetchCall).toHaveBeenCalledTimes(3)
  })

  it('counts beyond the offset limit using disjoint ranges despite gaps in project IDs', async () => {
    const fetchCall = catalogue(Array.from({ length: 50_001 }, (_, index) => index * 2 + 2))
    expect(await getProjectCount(source, { fetchCall })).toEqual(Success(50_001))
    expect(fetchCall).toHaveBeenCalledTimes(15)
    for (const [input] of fetchCall.mock.calls) {
      const params = new URL(String(input)).searchParams
      expect(params.get('per_page')).toBe('1')
      expect(params.has('page')).toBe(false)
    }
  })

  it('counts with ID cursors when CORS hides all pagination headers', async () => {
    const fetchCall = catalogue(Array.from({ length: 202 }, (_, index) => 1_000_000 + index * 3), 'hidden')
    expect(await getProjectCount(source, { fetchCall })).toEqual(Success(202))
    expect(fetchCall).toHaveBeenCalledTimes(4)
    const pages = fetchCall.mock.calls.slice(1).map(([input]) => new URL(String(input)).searchParams)
    expect(pages.map(params => params.get('id_before'))).toEqual(['1000603', '1000303', '1000003'])
    expect(pages.every(params => params.get('per_page') === '100' && !params.has('page'))).toBe(true)
  })

  it('uses pages instead of splitting into single IDs when small ranges omit totals', async () => {
    const fetchCall = catalogue(Array.from({ length: 202 }, (_, index) => index + 1), 'no-total')
    expect(await getProjectCount(source, { fetchCall })).toEqual(Success(202))
    expect(fetchCall).toHaveBeenCalledTimes(4)
  })

  it('returns a failure instead of a partial count when a range request fails', async () => {
    const fetchCall = catalogue(Array.from({ length: 10_001 }, (_, index) => index + 1))
    const transport = fetchCall.getMockImplementation()!
    fetchCall.mockImplementation(async (input, init) => new URL(String(input)).searchParams.has('id_after')
      ? Response.json({ message: 'Too many requests' }, { status: 429 })
      : transport(input, init))
    expect(await getProjectCount(source, { fetchCall })).toEqual(Failure('GitLab request failed (429): Too many requests'))
    expect(fetchCall).toHaveBeenCalledTimes(3)
  })

  it('stops before requesting another range when canceled', async () => {
    const controller = new AbortController()
    const fetchCall = catalogue(Array.from({ length: 10_001 }, (_, index) => index + 1))
    const transport = fetchCall.getMockImplementation()!
    fetchCall.mockImplementation(async (input, init) => {
      const response = await transport(input, init)
      controller.abort()
      return response
    })
    expect(await getProjectCount(source, { fetchCall, signal: controller.signal })).toEqual(Failure('GitLab request canceled.'))
    expect(fetchCall).toHaveBeenCalledTimes(1)
  })

  it('rejects a malformed project list', async () => {
    const fetchCall = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ projects: 10 }))
    expect(await getProjectCount(source, { fetchCall })).toEqual(Failure('GitLab returned an invalid project list.'))
  })
})
