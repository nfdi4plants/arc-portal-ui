import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getProject, getTopStarredProjects, listAllProjects, listMemberProjectIds, listProjects, searchProjects } from './index.ts'
import { Success, Failure } from '../../types/result.ts'
import { project, projectResponse } from '../../test/helpers.tsx'

const source = 'https://gitlab.example'
const fetchMock = vi.fn<typeof fetch>()

beforeEach(() => {
  fetchMock.mockReset()
  fetchMock.mockImplementation(async () => projectResponse())
})

function requestedUrl() { return new URL(String(fetchMock.mock.calls.at(-1)![0])) }

describe('GitLab projects API', () => {
  it('requests one recent-activity search page without following pagination', async () => {
    fetchMock.mockResolvedValue(projectResponse([project()], { 'X-Next-Page': '3' }))
    await listProjects(source, { fetchCall: fetchMock, page: 2, perPage: 25,
      search: 'plants', lastActivityAfter: '2026-09-14T12:00:00.000Z', orderBy: 'last_activity_at', sort: 'desc' })
    expect(Object.fromEntries(requestedUrl().searchParams)).toEqual({
      page: '2', per_page: '25', search: 'plants', last_activity_after: '2026-09-14T12:00:00.000Z',
      order_by: 'last_activity_at', sort: 'desc',
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
  it.each(['https://one.example/', 'https://two.example/gitlab///'])('uses the explicit source and preserves subpaths: %s', async instance => {
    await listProjects(instance, { fetchCall: fetchMock })
    expect(requestedUrl().href).toBe(`${instance.replace(/\/+$/, '')}/api/v4/projects?page=1&per_page=20`)
    expect(fetchMock.mock.calls[0][1]?.credentials).toBe('omit')
    expect(new Headers(fetchMock.mock.calls[0][1]?.headers).has('PRIVATE-TOKEN')).toBe(false)
  })

  it('requests public projects in descending star order, including archives, even after login', async () => {
    await getTopStarredProjects(source, { fetchCall: fetchMock, token: 'runtime-token' })
    expect(Object.fromEntries(requestedUrl().searchParams)).toEqual({
      page: '1', per_page: '10', order_by: 'star_count', sort: 'desc', visibility: 'public',
    })
  })

  it('encodes trimmed public search and includes accessible projects after login', async () => {
    await searchProjects(source, '  plant & growth + α/#?  ', { fetchCall: fetchMock })
    expect(requestedUrl().searchParams.get('search')).toBe('plant & growth + α/#?')
    expect(requestedUrl().searchParams.get('visibility')).toBe('public')
    await searchProjects(source, 'plants', { fetchCall: fetchMock, token: 'runtime-token' })
    expect(requestedUrl().searchParams.has('visibility')).toBe(false)
    expect(new Headers(fetchMock.mock.calls.at(-1)![1]?.headers).get('PRIVATE-TOKEN')).toBe('runtime-token')
    expect(requestedUrl().href).not.toContain('runtime-token')
  })

  it('supports paging, ordering, filters, runtime authentication and cancellation', async () => {
    const controller = new AbortController()
    await listProjects(source, { fetchCall: fetchMock,
      page: 3, perPage: 5, archived: false, visibility: 'private', orderBy: 'name', sort: 'asc',
      token: 'runtime-token', signal: controller.signal,
    })
    expect(Object.fromEntries(requestedUrl().searchParams)).toEqual({
      page: '3', per_page: '5', archived: 'false', visibility: 'private', order_by: 'name', sort: 'asc',
    })
    expect(fetchMock.mock.calls[0][1]?.signal).toBe(controller.signal)
  })

  it('allows top-starred and search pagination overrides', async () => {
    await getTopStarredProjects(source, { fetchCall: fetchMock, perPage: 4, page: 2, archived: true })
    expect(requestedUrl().searchParams.get('archived')).toBe('true')
    expect(requestedUrl().searchParams.get('per_page')).toBe('4')
    await searchProjects(source, 'plants', { fetchCall: fetchMock, page: 3, perPage: 7, sort: 'asc', orderBy: 'name' })
    expect(requestedUrl().searchParams.get('page')).toBe('3')
    expect(requestedUrl().searchParams.get('order_by')).toBe('name')
  })

  it.each([123, 'group/subgroup/project with spaces'])('returns a project Result by ID or encoded namespace: %s', async identifier => {
    fetchMock.mockResolvedValue(Response.json(project()))
    expect(await getProject(source, identifier, { fetchCall: fetchMock })).toEqual(Success(project()))
    expect(requestedUrl().pathname).toBe(`/api/v4/projects/${encodeURIComponent(String(identifier))}`)
  })

  it('uses exposed pagination headers and recognizes an explicit last page', async () => {
    fetchMock.mockResolvedValue(projectResponse([project()], {
      'X-Next-Page': '', 'X-Prev-Page': '2', 'X-Total': '21', 'X-Total-Pages': '3',
    }))
    expect(await listProjects(source, { fetchCall: fetchMock, page: 3, perPage: 1 })).toMatchObject({
      success: true, value: { page: 3, perPage: 1, nextPage: null, previousPage: 2, total: 21, totalPages: 3 },
    })
    fetchMock.mockResolvedValue(projectResponse([], { 'X-Next-Page': '4', 'X-Prev-Page': '2' }))
    expect(await listProjects(source, { fetchCall: fetchMock, page: 3 })).toMatchObject({ success: true, value: { nextPage: 4, previousPage: 2 } })
  })

  it('probes full pages when CORS hides headers and stops at a short or empty page', async () => {
    expect(await listProjects(source, { fetchCall: fetchMock, perPage: 1, page: 2 })).toMatchObject({ success: true, value: { nextPage: 3, previousPage: 1, total: null } })
    expect(await listProjects(source, { fetchCall: fetchMock, perPage: 10 })).toMatchObject({ success: true, value: { nextPage: null, previousPage: null } })
    fetchMock.mockResolvedValue(projectResponse([]))
    expect(await listProjects(source, { fetchCall: fetchMock, perPage: 10, page: 3 })).toMatchObject({ success: true, value: { nextPage: null, previousPage: 2 } })
  })

  it.each([403, 404, 429, 500])('returns HTTP %s as a readable failure', async status => {
    fetchMock.mockImplementation(async () => Response.json({ message: 'Request rejected' }, { status }))
    expect(await listProjects(source, { fetchCall: fetchMock })).toEqual(Failure(`GitLab request failed (${status}): Request rejected`))
  })

  it('returns useful failures for invalid tokens and network errors', async () => {
    fetchMock.mockResolvedValue(Response.json({ message: 'Unauthorized' }, { status: 401 }))
    expect(await listProjects(source, { fetchCall: fetchMock })).toEqual(Failure('Authentication failed: the token is invalid or expired.'))
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    expect(await listProjects(source, { fetchCall: fetchMock })).toMatchObject({ success: false, error: expect.stringContaining('Unable to reach GitLab') })
  })

  it('handles non-JSON error bodies, malformed JSON and unexpected response shapes', async () => {
    fetchMock.mockResolvedValue(new Response('Gateway down', { status: 502 }))
    expect(await listProjects(source, { fetchCall: fetchMock })).toEqual(Failure('GitLab request failed (502).'))
    fetchMock.mockResolvedValue(new Response('{'))
    expect(await listProjects(source, { fetchCall: fetchMock })).toEqual(Failure('GitLab returned an invalid JSON response.'))
    fetchMock.mockResolvedValue(Response.json({ projects: [] }))
    expect(await listProjects(source, { fetchCall: fetchMock })).toEqual(Failure('GitLab returned an invalid project list.'))
  })

  it('returns cancellation as a Result', async () => {
    const controller = new AbortController()
    const pending = listProjects(source, { fetchCall: fetchMock.mockImplementation(async () => {
      controller.abort()
      throw new DOMException('Canceled', 'AbortError')
    }), signal: controller.signal })
    expect(await pending).toEqual(Failure('GitLab request canceled.'))
  })

  describe('listAllProjects', () => {
    it('requests public projects by recent activity without a token', async () => {
      await listAllProjects(source, { fetchCall: fetchMock })
      expect(Object.fromEntries(requestedUrl().searchParams)).toEqual({
        visibility: 'public', order_by: 'last_activity_at', sort: 'desc', per_page: '100', page: '1',
      })
    })

    it('sends the token and no visibility filter after login', async () => {
      await listAllProjects(source, { fetchCall: fetchMock, token: 'runtime-token' })
      expect(requestedUrl().searchParams.has('visibility')).toBe(false)
      expect(new Headers(fetchMock.mock.calls[0][1]?.headers).get('PRIVATE-TOKEN')).toBe('runtime-token')
    })

    it('follows the next page and concatenates the items', async () => {
      fetchMock.mockImplementation(async input => new URL(String(input)).searchParams.get('page') === '1'
        ? projectResponse([project({ id: 1 })], { 'X-Next-Page': '2' })
        : projectResponse([project({ id: 2 })], { 'X-Next-Page': '' }))
      const result = await listAllProjects(source, { fetchCall: fetchMock })
      expect(result.success && result.value.map(item => item.id)).toEqual([1, 2])
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it('fails the whole load when a later page fails', async () => {
      fetchMock.mockImplementation(async input => new URL(String(input)).searchParams.get('page') === '1'
        ? projectResponse([project()], { 'X-Next-Page': '2' })
        : Response.json({ message: 'Boom' }, { status: 500 }))
      expect(await listAllProjects(source, { fetchCall: fetchMock })).toEqual(Failure('GitLab request failed (500): Boom'))
    })
  })

  describe('listMemberProjectIds', () => {
    it('requests the membership id list with the token', async () => {
      fetchMock.mockResolvedValue(Response.json([{ id: 7 }, { id: 8 }], { headers: { 'X-Next-Page': '' } }))
      const result = await listMemberProjectIds(source, { fetchCall: fetchMock, token: 'runtime-token' })
      expect(result).toEqual(Success([7, 8]))
      const url = requestedUrl()
      expect(url.pathname).toBe('/api/v4/projects')
      expect(Object.fromEntries(url.searchParams)).toEqual({
        membership: 'true', simple: 'true', per_page: '100', page: '1',
      })
      expect(new Headers(fetchMock.mock.calls[0][1]?.headers).get('PRIVATE-TOKEN')).toBe('runtime-token')
    })

    it('follows the next page and concatenates the ids', async () => {
      fetchMock.mockImplementation(async input => new URL(String(input)).searchParams.get('page') === '1'
        ? Response.json([{ id: 1 }], { headers: { 'X-Next-Page': '2' } })
        : Response.json([{ id: 2 }], { headers: { 'X-Next-Page': '' } }))
      expect(await listMemberProjectIds(source, { fetchCall: fetchMock })).toEqual(Success([1, 2]))
    })

    it('fails when an item lacks a numeric id', async () => {
      fetchMock.mockResolvedValue(Response.json([{ id: 7 }, { name: 'no id' }], { headers: { 'X-Next-Page': '' } }))
      expect(await listMemberProjectIds(source, { fetchCall: fetchMock })).toEqual(Failure('GitLab returned an invalid project list.'))
    })
  })
})
