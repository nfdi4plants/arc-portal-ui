import type {
  GitLabPage, GitLabProject, GitLabRequestOptions, ListProjectsOptions,
  SearchProjectsOptions, TopStarredProjectsOptions,
} from '../../types/gitlab.ts'
import { Failure, map, type Result } from '../../types/result.ts'
import { requestGitLab } from './client.ts'
import { listAllPages, requestPage, validIdentifier } from './page.ts'

export function isProject(data: unknown): data is GitLabProject {
  return typeof data === 'object' && data !== null
    && 'id' in data && typeof data.id === 'number'
    && 'name' in data && typeof data.name === 'string'
    && 'path_with_namespace' in data && typeof data.path_with_namespace === 'string'
    && 'web_url' in data && typeof data.web_url === 'string'
    && 'star_count' in data && typeof data.star_count === 'number'
    && 'description' in data && (data.description === null || typeof data.description === 'string')
}

export function listProjects(source: string, options: ListProjectsOptions = {}): Promise<Result<GitLabPage<GitLabProject>>> {
  const params = new URLSearchParams()
  if (options.search !== undefined) params.set('search', options.search)
  if (options.orderBy !== undefined) params.set('order_by', options.orderBy)
  if (options.sort !== undefined) params.set('sort', options.sort)
  if (options.visibility !== undefined) params.set('visibility', options.visibility)
  if (options.archived !== undefined) params.set('archived', String(options.archived))
  if (options.lastActivityAfter !== undefined) params.set('last_activity_after', options.lastActivityAfter)
  if (options.membership !== undefined) params.set('membership', String(options.membership))
  if (options.starred !== undefined) params.set('starred', String(options.starred))
  return requestPage(source, 'projects', params, options, isProject, 'project')
}

export async function getProject(source: string, idOrPath: number | string, options: GitLabRequestOptions = {}): Promise<Result<GitLabProject>> {
  if (!validIdentifier(idOrPath)) return Failure('A valid project ID or namespace path is required.')
  const response = await requestGitLab<GitLabProject>(
    source, `projects/${encodeURIComponent(String(idOrPath))}`, new URLSearchParams(), options,
  )
  if (response.success === true && !isProject(response.value.data)) return Failure('GitLab returned an invalid project.')
  return map(response, value => value.data)
}

export function getTopStarredProjects(source: string, options: TopStarredProjectsOptions = {}) {
  return listProjects(source, { perPage: 10, ...options, orderBy: 'star_count', sort: 'desc', visibility: 'public' })
}

export async function searchProjects(source: string, query: string, options: SearchProjectsOptions = {}): Promise<Result<GitLabPage<GitLabProject>>> {
  const search = query.trim()
  if (!search) return Failure('A non-empty search query is required.')
  return listProjects(source, { perPage: 10, ...options, search, visibility: options.token ? undefined : 'public' })
}

/** Loads every project the caller can see; anonymous callers only get public ones. */
export async function listAllProjects(source: string, options: GitLabRequestOptions = {}): Promise<Result<GitLabProject[]>> {
  const params = new URLSearchParams({ order_by: 'last_activity_at', sort: 'desc' })
  if (!options.token) params.set('visibility', 'public')
  return listAllPages(source, 'projects', params, isProject, 'project', options)
}

function isMemberProject(data: unknown): data is { id: number } {
  return typeof data === 'object' && data !== null && 'id' in data && typeof data.id === 'number'
}

/** Project ids the token can see (memberships); the response is a simple id list. */
export async function listMemberProjectIds(source: string, options: GitLabRequestOptions = {}): Promise<Result<number[]>> {
  const params = new URLSearchParams({ membership: 'true', simple: 'true' })
  const result = await listAllPages(source, 'projects', params, isMemberProject, 'project', options)
  return map(result, projects => projects.map(project => project.id))
}

/** Load the current user's stars without fetching full project details. */
export async function listStarredProjectIds(source: string, options: GitLabRequestOptions = {}): Promise<Result<number[]>> {
  if (!options.token) return Failure('Log in to see your starred repositories.')
  const params = new URLSearchParams({ starred: 'true', simple: 'true' })
  const result = await listAllPages(source, 'projects', params, isMemberProject, 'project', options)
  return map(result, projects => projects.map(project => project.id))
}

export async function setProjectStarred(source: string, projectId: number, starred: boolean,
  options: GitLabRequestOptions = {}): Promise<Result<GitLabProject>> {
  if (!options.token) return Failure('Log in to star repositories.')
  if (!validIdentifier(projectId)) return Failure('A valid project ID is required.')
  const response = await requestGitLab<GitLabProject>(source, `projects/${projectId}/${starred ? 'star' : 'unstar'}`,
    new URLSearchParams(), { ...options, method: 'POST' })
  if (response.success === true && !isProject(response.value.data)) return Failure('GitLab returned an invalid project.')
  return map(response, value => value.data)
}
