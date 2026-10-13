import { describe, expect, it, vi } from 'vitest'
import { getProjectCount } from './index.ts'
import { Failure, Success } from '../../types/result.ts'

const source = 'https://gitlab.example/gitlab/'

describe('getProjectCount', () => {
  it('gets the public count with one small request', async () => {
    const fetchCall = vi.fn<typeof fetch>().mockResolvedValue(Response.json([{ id: 900 }], { headers: { 'X-Total': '259' } }))
    expect(await getProjectCount(source, { fetchCall })).toEqual(Success(259))
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
    const fetchCall = vi.fn<typeof fetch>().mockResolvedValue(Response.json([{ id: 20 }], { headers: { 'X-Total': '2' } }))
    const controller = new AbortController()
    expect(await getProjectCount(source, { fetchCall, token: 'runtime-token', signal: controller.signal })).toEqual(Success(2))
    const [input, init] = fetchCall.mock.calls[0]
    expect(new URL(String(input)).searchParams.has('visibility')).toBe(false)
    expect(new Headers(init?.headers).get('PRIVATE-TOKEN')).toBe('runtime-token')
    expect(init?.signal).toBe(controller.signal)
    expect(String(input)).not.toContain('runtime-token')
  })

  it('returns a known zero for an empty hub without pagination headers', async () => {
    const fetchCall = vi.fn<typeof fetch>().mockResolvedValue(Response.json([]))
    expect(await getProjectCount(source, { fetchCall })).toEqual(Success(0))
    expect(fetchCall).toHaveBeenCalledTimes(1)
  })

  it('stops at the exposed count limit without splitting ID ranges', async () => {
    const fetchCall = vi.fn<typeof fetch>().mockResolvedValue(Response.json([{ id: 30000 }], { headers: { 'X-Total': '10000' } }))
    expect(await getProjectCount(source, { fetchCall })).toEqual(Success(10000))
    expect(fetchCall).toHaveBeenCalledTimes(1)
  })

  it('returns a capped count when GitLab omits X-Total above the limit', async () => {
    const fetchCall = vi.fn<typeof fetch>().mockResolvedValue(Response.json([{ id: 30000 }], {
      headers: { 'X-Per-Page': '1', 'X-Next-Page': '2' },
    }))
    expect(await getProjectCount(source, { fetchCall })).toEqual(Success(10000))
    expect(fetchCall).toHaveBeenCalledTimes(1)
  })

  it('leaves the count unknown when CORS hides every pagination header, without scanning projects', async () => {
    const fetchCall = vi.fn<typeof fetch>().mockResolvedValue(Response.json([{ id: 900 }]))
    expect(await getProjectCount(source, { fetchCall })).toEqual(Success(null))
    expect(fetchCall).toHaveBeenCalledTimes(1)
  })

  it('returns a failure for an unavailable hub instead of a zero', async () => {
    const fetchCall = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ message: 'Too many requests' }, { status: 429 }))
    expect(await getProjectCount(source, { fetchCall })).toEqual(Failure('GitLab request failed (429): Too many requests'))
    expect(fetchCall).toHaveBeenCalledTimes(1)
  })

  it('does not start a canceled request', async () => {
    const controller = new AbortController()
    controller.abort()
    const fetchCall = vi.fn<typeof fetch>()
    expect(await getProjectCount(source, { fetchCall, signal: controller.signal })).toEqual(Failure('GitLab request canceled.'))
    expect(fetchCall).not.toHaveBeenCalled()
  })

  it('rejects a malformed project list', async () => {
    const fetchCall = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ projects: 10 }))
    expect(await getProjectCount(source, { fetchCall })).toEqual(Failure('GitLab returned an invalid project list.'))
  })
})
