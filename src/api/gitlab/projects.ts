import type {
  GitLabPage, GitLabProject, GitLabRequestOptions, ListProjectsOptions,
  SearchProjectsOptions, TopStarredProjectsOptions,
} from '../../types/gitlab.ts'
import { Failure, map, Success, type Result } from '../../types/result.ts'
import { requestGitLab } from './client.ts'
import { requestPage, validIdentifier } from './page.ts'

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
  const projects: GitLabProject[] = []
  let page: number | null = 1
  while (page !== null) {
    if (options.signal?.aborted) return Failure('GitLab request canceled.')
    const result = await listProjects(source, {
      ...options, page, perPage: 100, orderBy: 'last_activity_at', sort: 'desc',
      visibility: options.token ? undefined : 'public',
    })
    if (result.success === false) return Failure(result.error)
    projects.push(...result.value.items)
    page = result.value.nextPage
  }
  return Success(projects)
}
