import { describe, expect, it, vi } from 'vitest'
import { getCurrentUser, getGroupProjects, listAllGroups, listGroups } from './index.ts'
import { Failure, Success } from '../../types/result.ts'
import { project, projectResponse } from '../../test/helpers.tsx'

const source = 'https://gitlab.example/gitlab'
const group = { id: 1, name: 'Plants', full_path: 'research/plants', visibility: 'public' }

describe('GitLab authentication and groups', () => {
  it('searches and sorts one group project page without additional lookups', async () => {
    const fetchCall = vi.fn<typeof fetch>().mockResolvedValue(projectResponse([project()], { 'X-Next-Page': '3' }))
    await getGroupProjects(source, 2, { page: 2, perPage: 25, search: 'plant',
      orderBy: 'last_activity_at', sort: 'desc', fetchCall })
    expect(Object.fromEntries(new URL(String(fetchCall.mock.calls[0][0])).searchParams)).toEqual({
      include_subgroups: 'true', with_shared: 'false', order_by: 'last_activity_at',
      sort: 'desc', search: 'plant', page: '2', per_page: '25',
    })
    expect(fetchCall).toHaveBeenCalledTimes(1)
  })
  it('validates a token through the current-user endpoint', async () => {
    const user = { id: 7, name: 'Jane Doe', username: 'jane' }
    const fetchCall = vi.fn<typeof fetch>().mockResolvedValue(Response.json(user))
    expect(await getCurrentUser(source, { token: 'runtime-token', fetchCall })).toEqual(Success(user))
    expect(String(fetchCall.mock.calls[0][0])).toBe(`${source}/api/v4/user`)
    expect(new Headers(fetchCall.mock.calls[0][1]?.headers).get('PRIVATE-TOKEN')).toBe('runtime-token')
    expect(fetchCall.mock.calls[0][1]?.credentials).toBe('omit')
  })

  it('reports rejected tokens and malformed user responses', async () => {
    const fetchCall = vi.fn<typeof fetch>().mockResolvedValue(Response.json({}, { status: 401 }))
    expect(await getCurrentUser(source, { token: 'expired', fetchCall })).toEqual(Failure('Authentication failed: the token is invalid or expired.'))
    fetchCall.mockResolvedValue(Response.json({}))
    expect(await getCurrentUser(source, { token: 'token', fetchCall })).toEqual(Failure('GitLab returned an invalid user.'))
  })

  it('discovers public groups separately from membership groups', async () => {
    const fetchCall = vi.fn<typeof fetch>().mockImplementation(async () => Response.json([group]))
    await listGroups(source, { visibility: 'public', fetchCall })
    let url = new URL(String(fetchCall.mock.calls[0][0]))
    expect(url.searchParams.get('visibility')).toBe('public')
    expect(new Headers(fetchCall.mock.calls[0][1]?.headers).has('PRIVATE-TOKEN')).toBe(false)
    await listGroups(source, { allAvailable: false, token: 'token', fetchCall })
    url = new URL(String(fetchCall.mock.calls[1][0]))
    expect(url.searchParams.get('all_available')).toBe('false')
    expect(url.searchParams.has('visibility')).toBe(false)
  })

  it('loads the complete organisation catalogue across pages', async () => {
    const fetchCall = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json([group], { headers: { 'X-Next-Page': '2' } }))
      .mockResolvedValueOnce(Response.json([{ ...group, id: 2, full_path: 'research/trees' }], { headers: { 'X-Next-Page': '' } }))
    expect(await listAllGroups(source, { fetchCall })).toEqual(Success([group, { ...group, id: 2, full_path: 'research/trees' }]))
    expect(fetchCall.mock.calls.map(call => new URL(String(call[0])).searchParams.get('page'))).toEqual(['1', '2'])
    expect(new URL(String(fetchCall.mock.calls[0][0])).searchParams.get('per_page')).toBe('100')
  })

  it('returns catalogue failures without silently presenting partial results', async () => {
    const fetchCall = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json([group], { headers: { 'X-Next-Page': '2' } }))
      .mockResolvedValueOnce(Response.json({}, { status: 500 }))
    expect(await listAllGroups(source, { fetchCall })).toEqual(Failure('GitLab request failed (500).'))
  })

  it('includes subgroup and archived repositories, excludes shared projects, and honors paging', async () => {
    const fetchCall = vi.fn<typeof fetch>().mockResolvedValue(projectResponse([project({ archived: true })]))
    const controller = new AbortController()
    const result = await getGroupProjects(source, 'research/plants', { page: 2, token: 'token', signal: controller.signal, fetchCall })
    expect(result).toMatchObject({ success: true, value: { items: [{ archived: true }], page: 2 } })
    const url = new URL(String(fetchCall.mock.calls[0][0]))
    expect(url.pathname).toBe('/gitlab/api/v4/groups/research%2Fplants/projects')
    expect(Object.fromEntries(url.searchParams)).toEqual({ include_subgroups: 'true', with_shared: 'false', order_by: 'name', sort: 'asc', page: '2', per_page: '10' })
    expect(fetchCall.mock.calls[0][1]?.signal).toBe(controller.signal)
  })
})
