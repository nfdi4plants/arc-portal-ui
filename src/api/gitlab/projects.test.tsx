import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GitLabApiError, getProject, getTopStarredProjects, listProjects, searchProjects } from './index.ts'
import { project, projectResponse } from '../../test/helpers.tsx'

const source = 'https://gitlab.example'
const fetchMock = vi.fn<typeof fetch>()

beforeEach(() => {
  fetchMock.mockReset()
  fetchMock.mockImplementation(async () => projectResponse())
})

function requestedUrl() {
  return new URL(String(fetchMock.mock.calls.at(-1)![0]))
}

describe('GitLab projects API', () => {
  it.each(['https://one.example/', 'https://two.example/gitlab///'])('uses the explicit source and preserves subpaths: %s', async instance => {
    await listProjects(instance, { fetchCall: fetchMock })
    expect(requestedUrl().href).toBe(`${instance.replace(/\/+$/, '')}/api/v4/projects?page=1&per_page=20`)
    expect(fetchMock.mock.calls[0][1]?.credentials).toBe('omit')
  })

  it('requests the top ten public projects in descending star order, including archives', async () => {
    await getTopStarredProjects(source, { fetchCall: fetchMock })
    expect(Object.fromEntries(requestedUrl().searchParams)).toEqual({
      page: '1', per_page: '10', order_by: 'star_count', sort: 'desc', visibility: 'public',
    })
  })

  it('encodes a trimmed server-side search without treating query characters as parameters', async () => {
    await searchProjects(source, '  plant & growth + α/#?  ', { fetchCall: fetchMock })
    expect(requestedUrl().pathname).toBe('/api/v4/projects')
    expect(requestedUrl().searchParams.get('search')).toBe('plant & growth + α/#?')
    expect(requestedUrl().searchParams.get('visibility')).toBe('public')
    expect(requestedUrl().searchParams.get('per_page')).toBe('10')
    expect(() => searchProjects(source, '   ', { fetchCall: fetchMock })).toThrow('non-empty')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('supports paging, ordering, explicit false filters, runtime auth and cancellation', async () => {
    const controller = new AbortController()
    await listProjects(source, { fetchCall: fetchMock,
      page: 3, perPage: 5, archived: false, visibility: 'private', orderBy: 'name', sort: 'asc',
      token: 'runtime-token', signal: controller.signal,
    })
    expect(Object.fromEntries(requestedUrl().searchParams)).toEqual({
      page: '3', per_page: '5', archived: 'false', visibility: 'private', order_by: 'name', sort: 'asc',
    })
    const options = fetchMock.mock.calls[0][1]!
    expect(new Headers(options.headers).get('PRIVATE-TOKEN')).toBe('runtime-token')
    expect(options.signal).toBe(controller.signal)
    expect(requestedUrl().href).not.toContain('runtime-token')
  })

  it('allows top-starred and search pagination/filter overrides', async () => {
    await getTopStarredProjects(source, { fetchCall: fetchMock, perPage: 4, page: 2, archived: true })
    expect(requestedUrl().searchParams.get('archived')).toBe('true')
    expect(requestedUrl().searchParams.get('per_page')).toBe('4')
    await searchProjects(source, 'plants', { fetchCall: fetchMock, page: 3, perPage: 7, sort: 'asc', orderBy: 'name' })
    expect(requestedUrl().searchParams.get('page')).toBe('3')
    expect(requestedUrl().searchParams.get('order_by')).toBe('name')
  })

  it.each([123, 'group/subgroup/project with spaces'])('gets a project by ID or encoded namespace: %s', async identifier => {
    fetchMock.mockResolvedValue(Response.json(project()))
    expect(await getProject(source, identifier, { fetchCall: fetchMock })).toEqual(project())
    expect(requestedUrl().pathname).toBe(`/api/v4/projects/${encodeURIComponent(String(identifier))}`)
  })

  it('uses exposed pagination headers and recognizes an explicit last page', async () => {
    fetchMock.mockResolvedValue(projectResponse([project()], {
      'X-Next-Page': '', 'X-Prev-Page': '2', 'X-Total': '21', 'X-Total-Pages': '3',
    }))
    expect(await listProjects(source, { fetchCall: fetchMock, page: 3, perPage: 1 })).toMatchObject({
      page: 3, perPage: 1, nextPage: null, previousPage: 2, total: 21, totalPages: 3,
    })
    fetchMock.mockResolvedValue(projectResponse([], { 'X-Next-Page': '4', 'X-Prev-Page': '2' }))
    expect(await listProjects(source, { fetchCall: fetchMock, page: 3 })).toMatchObject({ nextPage: 4, previousPage: 2 })
  })

  it('probes full pages when CORS hides headers and stops at a short or empty page', async () => {
    expect(await listProjects(source, { fetchCall: fetchMock, perPage: 1, page: 2 })).toMatchObject({ nextPage: 3, previousPage: 1, total: null })
    expect(await listProjects(source, { fetchCall: fetchMock, perPage: 10 })).toMatchObject({ nextPage: null, previousPage: null })
    fetchMock.mockResolvedValue(projectResponse([]))
    expect(await listProjects(source, { fetchCall: fetchMock, perPage: 10, page: 3 })).toMatchObject({ nextPage: null, previousPage: 2 })
  })

  it.each([401, 403, 404, 429, 500])('reports HTTP %s as a typed error', async status => {
    fetchMock.mockImplementation(async () => Response.json({ message: 'Request rejected' }, { status }))
    await expect(listProjects(source, { fetchCall: fetchMock })).rejects.toBeInstanceOf(GitLabApiError)
    await expect(listProjects(source, { fetchCall: fetchMock })).rejects.toMatchObject({ status, message: expect.stringContaining('Request rejected') })
  })

  it('handles non-JSON error bodies, malformed JSON and unexpected response shapes', async () => {
    fetchMock.mockResolvedValue(new Response('Gateway down', { status: 502 }))
    await expect(listProjects(source, { fetchCall: fetchMock })).rejects.toMatchObject({ status: 502 })
    fetchMock.mockResolvedValue(new Response('{'))
    await expect(listProjects(source, { fetchCall: fetchMock })).rejects.toMatchObject({ message: 'GitLab returned an invalid JSON response.' })
    fetchMock.mockResolvedValue(Response.json({ projects: [] }))
    await expect(listProjects(source, { fetchCall: fetchMock })).rejects.toMatchObject({ message: 'GitLab returned an invalid project list.' })
  })

  it('wraps network failures and preserves abort errors', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(listProjects(source, { fetchCall: fetchMock })).rejects.toMatchObject({ name: 'GitLabApiError', status: null })
    const controller = new AbortController()
    controller.abort()
    const abort = new DOMException('Canceled', 'AbortError')
    fetchMock.mockRejectedValue(abort)
    await expect(listProjects(source, { fetchCall: fetchMock, signal: controller.signal })).rejects.toBe(abort)
  })

  it.each([200, 500])('preserves cancellation while reading an HTTP %s response body', async status => {
    const abort = new DOMException('Canceled while reading', 'AbortError')
    fetchMock.mockImplementation(async () => new Response(new ReadableStream({
      start(controller) { controller.error(abort) },
    }), { status }))
    await expect(listProjects(source, { fetchCall: fetchMock })).rejects.toBe(abort)
  })

  it.each([{ page: 0 }, { page: 1.5 }, { perPage: 101 }, { perPage: 0 }])('rejects invalid pagination before fetching: %j', async options => {
    await expect(listProjects(source, { ...options, fetchCall: fetchMock })).rejects.toBeInstanceOf(RangeError)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each(['file:///repo', 'https://user:password@gitlab.example', 'https://gitlab.example?search=abc'])('rejects invalid instance URLs: %s', async instance => {
    await expect(listProjects(instance, { fetchCall: fetchMock })).rejects.toBeInstanceOf(TypeError)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects empty or invalid project identifiers', async () => {
    await expect(getProject(source, '', { fetchCall: fetchMock })).rejects.toBeInstanceOf(TypeError)
    await expect(getProject(source, 0, { fetchCall: fetchMock })).rejects.toBeInstanceOf(RangeError)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
