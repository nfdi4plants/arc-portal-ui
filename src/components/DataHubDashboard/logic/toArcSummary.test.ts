import { describe, expect, it } from 'vitest'
import { groupNamesFrom, toArcSummary } from './toArcSummary.ts'
import { gitLabProjectFull, plantdatahub } from '../../../test/helpers.tsx'

const hub = plantdatahub
const groups = new Map([['ceplas', 'CEPLAS']])

const nested = {
  id: 5, name: 'X', path_with_namespace: 'ceplas/sub/x', web_url: 'https://git.nfdi4plants.org/ceplas/sub/x',
  namespace: { id: 2, name: 'Sub', path: 'sub', kind: 'group' as const, full_path: 'ceplas/sub' },
}

describe('toArcSummary', () => {
  it('maps a nested group project to its top-level working group', () => {
    const arc = toArcSummary(gitLabProjectFull({ ...nested, default_branch: 'main' }), hub, groups, true)
    expect(arc.group).toEqual({ key: 'plantdatahub/ceplas', label: 'CEPLAS', hubId: 'plantdatahub', personal: false })
    expect(arc.key).toBe('git.nfdi4plants.org/ceplas/sub/x@main')
    expect(arc.projectId).toBe(5)
    expect(arc.title).toBe('X')
    expect(arc.url).toBe(nested.web_url)
  })

  it('falls back to the path when the group list lacks the group', () => {
    const arc = toArcSummary(gitLabProjectFull(nested), hub, new Map(), true)
    expect(arc.group.label).toBe('ceplas')
  })

  it('puts user namespaces into one Personal Sandbox group', () => {
    const arc = toArcSummary(gitLabProjectFull({
      namespace: { id: 9, name: 'Jane', path: 'jane', kind: 'user', full_path: 'jane' },
    }), hub, groups, true)
    expect(arc.group).toEqual({ key: 'plantdatahub/~personal', label: 'Personal Sandbox', hubId: 'plantdatahub', personal: true })
  })

  it('marks the ARC as a member only when its id is in the membership list', () => {
    const project = gitLabProjectFull({ id: 7 })
    expect(toArcSummary(project, hub, groups, true).member).toBe(false)
    expect(toArcSummary(project, hub, groups, true, new Set([7])).member).toBe(true)
    expect(toArcSummary(project, hub, groups, true, new Set([8])).member).toBe(false)
  })

  it.each([['public', 'public'], ['internal', 'private'], ['private', 'private']] as const)(
    'maps visibility %s to %s', (visibility, access) => {
      expect(toArcSummary(gitLabProjectFull({ visibility }), hub, groups, true).access).toBe(access)
    })

  it('infers access from the request when visibility is missing', () => {
    const project = gitLabProjectFull({ visibility: undefined })
    expect(toArcSummary(project, hub, groups, true).access).toBe('public')
    expect(toArcSummary(project, hub, groups, false).access).toBe('private')
  })

  it('omits the branch from the key when there is no default branch', () => {
    const arc = toArcSummary(gitLabProjectFull({ ...nested, default_branch: null }), hub, groups, true)
    expect(arc.key).toBe('git.nfdi4plants.org/ceplas/sub/x')
  })

  it('defaults a missing description, topics and dates', () => {
    const arc = toArcSummary(gitLabProjectFull({
      description: null, topics: undefined, last_activity_at: undefined, created_at: '2026-01-02T00:00:00Z',
    }), hub, groups, true)
    expect(arc.description).toBe('')
    expect(arc.topics).toEqual([])
    expect(arc.lastActivityAt).toBe('2026-01-02T00:00:00Z')
  })

  it('marks the ARC as a member only when its id is in the membership list', () => {
    const project = gitLabProjectFull({ id: 7 })
    expect(toArcSummary(project, hub, groups, true).member).toBe(false)
    expect(toArcSummary(project, hub, groups, true, new Set([7])).member).toBe(true)
    expect(toArcSummary(project, hub, groups, true, new Set([8])).member).toBe(false)
  })
})

describe('groupNamesFrom', () => {
  it('keeps only top-level groups', () => {
    const names = groupNamesFrom([
      { id: 1, name: 'CEPLAS', full_path: 'ceplas' },
      { id: 2, name: 'Sub', full_path: 'ceplas/sub' },
    ])
    expect([...names]).toEqual([['ceplas', 'CEPLAS']])
  })
})
