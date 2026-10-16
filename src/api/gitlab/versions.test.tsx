import { describe, expect, it, vi } from 'vitest'
import { getArcRepositoryOverview, getProjectVersions } from './index'
import { Failure, Success } from '../../types/result'
import { project } from '../../test/helpers'

const repository = { source: 'https://gitlab.example', projectPath: 'research/plant-arc' }
const commit = { id: '0123456789abcdef', committed_date: '2025-01-02T10:00:00Z' }

describe('ARC repository versions', () => {
  it.each([
    { owner: null, namespace: { name: 'ARC Research', web_url: 'https://gitlab.example/research' }, expected: { name: 'ARC Research', url: 'https://gitlab.example/research' } },
    { owner: { name: 'ARC Owner', web_url: 'https://gitlab.example/owner' }, namespace: { name: 'Research' }, expected: { name: 'ARC Owner', url: 'https://gitlab.example/owner' } },
  ])('reads project ownership from DataHub, falling back to its namespace', async ({ owner, namespace, expected }) => {
    const fetchCall = vi.fn<typeof fetch>().mockImplementation(async (input) => {
      const path = new URL(String(input)).pathname
      return Response.json(path.endsWith('/releases') || path.endsWith('/tags') ? [] : project({ owner, namespace, visibility: 'public' }))
    })
    expect(await getArcRepositoryOverview(repository, { fetchCall })).toMatchObject({
      success: true, value: { owner: expected, visibility: 'public', versions: [] },
    })
  })

  it('reads the downloadable release archive size without downloading the archive', async () => {
    const fetchCall = vi.fn<typeof fetch>().mockImplementation(async (input, init) => {
      const path = new URL(String(input)).pathname
      if (init?.method === 'HEAD') return new Response(null, {
        headers: { 'Content-Type': 'application/zip', 'Content-Length': '3072' },
      })
      return Response.json(path.endsWith('/releases')
        ? [{ tag_name: 'v1', name: 'First release', commit }]
        : [])
    })
    expect(await getArcRepositoryOverview(repository, { fetchCall })).toMatchObject({
      success: true, value: { versions: [{ tag: 'v1' }], latestReleaseArchiveSizeBytes: 3072 },
    })
    const archiveRequest = fetchCall.mock.calls.find(([, init]) => init?.method === 'HEAD')
    const archiveUrl = new URL(String(archiveRequest?.[0]))
    expect(archiveUrl.searchParams.get('sha')).toBe(commit.id)
    expect(archiveUrl.searchParams.get('include_lfs_blobs')).toBe('true')
  })

  it('keeps archive size unknown when GitLab reports zero for a generated archive', async () => {
    const fetchCall = vi.fn<typeof fetch>().mockImplementation(async (input, init) => {
      const path = new URL(String(input)).pathname
      if (init?.method === 'HEAD') return new Response(null, {
        headers: { 'Content-Type': 'application/zip', 'Content-Length': '0' },
      })
      return Response.json(path.endsWith('/releases') ? [{ tag_name: 'v1', name: 'First release', commit }] : [])
    })
    expect(await getArcRepositoryOverview(repository, { fetchCall })).toMatchObject({
      success: true, value: { versions: [{ tag: 'v1' }], latestReleaseArchiveSizeBytes: undefined },
    })
  })

  it('combines releases and tags without listing a released tag twice', async () => {
    const fetchCall = vi.fn<typeof fetch>().mockImplementation(async (input) => {
      const url = new URL(String(input))
      return Response.json(url.pathname.endsWith('/releases') ? [{
        tag_name: 'v2.0', name: 'Second release', description: 'Updated annotations',
        released_at: '2025-02-01T10:00:00Z', commit,
      }] : [
        { name: 'v2.0', commit },
        { name: 'draft/1', message: 'First draft', created_at: null, commit },
      ])
    })
    const controller = new AbortController()
    const result = await getProjectVersions(repository, { fetchCall, token: 'runtime-token', signal: controller.signal })

    expect(result).toEqual(Success([
      {
        tag: 'v2.0', name: 'Second release', kind: 'release', description: 'Updated annotations',
        date: '2025-02-01T10:00:00Z', commit: commit.id,
        url: 'https://gitlab.example/research/plant-arc/-/releases/v2.0',
      },
      {
        tag: 'draft/1', name: 'draft/1', kind: 'tag', description: 'First draft',
        date: commit.committed_date, commit: commit.id,
        url: 'https://gitlab.example/research/plant-arc/-/tags/draft%2F1',
      },
    ]))
    expect(fetchCall.mock.calls.map(([input]) => new URL(String(input)).pathname)).toEqual([
      '/api/v4/projects/research%2Fplant-arc/releases',
      '/api/v4/projects/research%2Fplant-arc/repository/tags',
    ])
    for (const [, init] of fetchCall.mock.calls) {
      expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer runtime-token')
      expect(init?.signal).toBe(controller.signal)
    }
  })

  it('includes versions beyond the first page', async () => {
    const fetchCall = vi.fn<typeof fetch>().mockImplementation(async (input) => {
      const url = new URL(String(input))
      if (url.pathname.endsWith('/releases')) return Response.json([])
      const firstPage = url.searchParams.get('page') === '1'
      return Response.json([{ name: firstPage ? 'v2' : 'v1', commit }], {
        headers: { 'X-Next-Page': firstPage ? '2' : '' },
      })
    })

    expect(await getProjectVersions(repository, { fetchCall })).toMatchObject({
      success: true, value: [{ tag: 'v2' }, { tag: 'v1' }],
    })
  })

  it('returns an empty version history for a repository with no releases or tags', async () => {
    const fetchCall = vi.fn<typeof fetch>().mockImplementation(async () => Response.json([]))
    expect(await getProjectVersions(repository, { fetchCall })).toEqual(Success([]))
  })

  it('reports an unavailable version history instead of returning incomplete results', async () => {
    const fetchCall = vi.fn<typeof fetch>().mockImplementation(async (input) =>
      new URL(String(input)).pathname.endsWith('/releases')
        ? Response.json({ message: 'Unavailable' }, { status: 503 })
        : Response.json([{ name: 'v1', commit }]))

    expect(await getProjectVersions(repository, { fetchCall })).toEqual(Failure('GitLab request failed (503): Unavailable'))
  })
})
