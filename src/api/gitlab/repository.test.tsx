import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getContributors, getLatestCommit } from './index.ts'
import { Failure, Success } from '../../types/result.ts'

const source = 'https://gitlab.example'
const fetchMock = vi.fn<typeof fetch>()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

const contributors = [
  { name: 'Jane Doe', email: 'jane@example.org', commits: 42 },
  { name: 'John Doe', email: 'john@example.org', commits: 7 },
]

describe('getContributors', () => {
  it('requests the contributors of a project and validates them', async () => {
    fetchMock.mockResolvedValue(Response.json(contributors, { headers: { 'X-Next-Page': '' } }))
    expect(await getContributors(source, 7, { fetchCall: fetchMock })).toEqual(Success(contributors))
    const url = new URL(String(fetchMock.mock.calls[0][0]))
    expect(url.pathname).toBe('/api/v4/projects/7/repository/contributors')
    expect(Object.fromEntries(url.searchParams)).toEqual({ per_page: '100', page: '1', order_by: 'commits', sort: 'desc' })
  })

  it('rejects an item without the contributor shape', async () => {
    fetchMock.mockResolvedValue(Response.json([{ name: 'Jane' }], { headers: { 'X-Next-Page': '' } }))
    expect(await getContributors(source, 7, { fetchCall: fetchMock })).toEqual(Failure('GitLab returned an invalid contributor list.'))
  })
})

describe('getLatestCommit', () => {
  it('requests one commit', async () => {
    fetchMock.mockResolvedValue(Response.json([{ author_name: 'Jane', committed_date: '2026-10-01T00:00:00Z' }]))
    expect(await getLatestCommit(source, 7, { fetchCall: fetchMock })).toEqual(
      Success({ author_name: 'Jane', committed_date: '2026-10-01T00:00:00Z' }))
    const url = new URL(String(fetchMock.mock.calls[0][0]))
    expect(url.pathname).toBe('/api/v4/projects/7/repository/commits')
    expect(url.searchParams.get('per_page')).toBe('1')
  })

  it('maps an empty list to no commit', async () => {
    fetchMock.mockResolvedValue(Response.json([]))
    expect(await getLatestCommit(source, 7, { fetchCall: fetchMock })).toEqual(Success(null))
  })

  it('maps a missing repository (404) to no commit', async () => {
    fetchMock.mockResolvedValue(Response.json({ message: 'Not Found' }, { status: 404 }))
    expect(await getLatestCommit(source, 7, { fetchCall: fetchMock })).toEqual(Success(null))
  })

  it('surfaces other failures', async () => {
    fetchMock.mockResolvedValue(Response.json({ message: 'Boom' }, { status: 500 }))
    expect(await getLatestCommit(source, 7, { fetchCall: fetchMock })).toEqual(Failure('GitLab request failed (500): Boom'))
  })
})