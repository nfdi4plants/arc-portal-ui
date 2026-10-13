import type { GitLabGroup, GitLabPage, GitLabProject, GroupProjectsOptions, ListGroupsOptions } from '../../types/gitlab.ts'
import { Failure, Success, type Result } from '../../types/result.ts'
import { requestPage, validIdentifier } from './page.ts'
import { isProject } from './projects.ts'

function isGroup(data: unknown): data is GitLabGroup {
  return typeof data === 'object' && data !== null
    && 'id' in data && typeof data.id === 'number'
    && 'name' in data && typeof data.name === 'string'
    && 'full_path' in data && typeof data.full_path === 'string'
}

export function listGroups(source: string, options: ListGroupsOptions = {}): Promise<Result<GitLabPage<GitLabGroup>>> {
  const params = new URLSearchParams({ order_by: 'name', sort: 'asc' })
  if (options.allAvailable !== undefined) params.set('all_available', String(options.allAvailable))
  if (options.visibility !== undefined) params.set('visibility', options.visibility)
  return requestPage(source, 'groups', params, options, isGroup, 'group')
}

export async function listAllGroups(source: string, options: Omit<ListGroupsOptions, 'page' | 'perPage'> = {}): Promise<Result<GitLabGroup[]>> {
  const groups: GitLabGroup[] = []
  let page: number | null = 1
  while (page !== null) {
    if (options.signal?.aborted) return Failure('GitLab request canceled.')
    const result = await listGroups(source, { ...options, page, perPage: 100 })
    if (result.success === false) return Failure(result.error)
    groups.push(...result.value.items)
    page = result.value.nextPage
  }
  return Success(groups)
}

export async function getGroupProjects(source: string, idOrPath: number | string, options: GroupProjectsOptions = {}): Promise<Result<GitLabPage<GitLabProject>>> {
  if (!validIdentifier(idOrPath)) return Failure('A valid group ID or path is required.')
  const params = new URLSearchParams({ include_subgroups: 'true', with_shared: 'false', order_by: 'name', sort: 'asc' })
  return requestPage(source, `groups/${encodeURIComponent(String(idOrPath))}/projects`, params,
    { perPage: 10, ...options }, isProject, 'project')
}
