import type {
  GitLabPage, GitLabProject, GitLabRequestOptions, ListProjectsOptions,
  SearchProjectsOptions, TopStarredProjectsOptions,
} from '../../types/gitlab.ts'
import { GitLabApiError, requestGitLab } from './client.ts'

function positiveInteger(value: number, name: string, max = Number.MAX_SAFE_INTEGER) {
  if (!Number.isInteger(value) || value < 1 || value > max) {
    throw new RangeError(`${name} must be an integer between 1 and ${max}.`)
  }
  return value
}

function headerNumber(headers: Headers, name: string): number | null {
  const value = headers.get(name)
  if (!value?.trim()) return null
  const number = Number(value)
  return Number.isSafeInteger(number) && number >= 0 ? number : null
}

export async function listProjects(source: string, options: ListProjectsOptions = {}): Promise<GitLabPage<GitLabProject>> {
  const page = positiveInteger(options.page ?? 1, 'page')
  const perPage = positiveInteger(options.perPage ?? 20, 'perPage', 100)
  const params = new URLSearchParams({ page: String(page), per_page: String(perPage) })
  if (options.search !== undefined) params.set('search', options.search)
  if (options.orderBy !== undefined) params.set('order_by', options.orderBy)
  if (options.sort !== undefined) params.set('sort', options.sort)
  if (options.visibility !== undefined) params.set('visibility', options.visibility)
  if (options.archived !== undefined) params.set('archived', String(options.archived))

  const { data, headers } = await requestGitLab<GitLabProject[]>(source, 'projects', params, options)
  if (!Array.isArray(data)) throw new GitLabApiError('GitLab returned an invalid project list.', 200)
  return {
    items: data, page, perPage,
    // An exposed empty X-Next-Page marks the end; missing headers use a full-page probe.
    nextPage: headers.has('x-next-page')
      ? headerNumber(headers, 'x-next-page') || null
      : data.length === perPage ? page + 1 : null,
    previousPage: headers.has('x-prev-page')
      ? headerNumber(headers, 'x-prev-page') || null
      : page > 1 ? page - 1 : null,
    total: headerNumber(headers, 'x-total'),
    totalPages: headerNumber(headers, 'x-total-pages'),
  }
}

export async function getProject(source: string, idOrPath: number | string, options: GitLabRequestOptions = {}): Promise<GitLabProject> {
  if (typeof idOrPath === 'number') positiveInteger(idOrPath, 'project ID')
  if (!String(idOrPath).trim()) throw new TypeError('A project ID or namespace path is required.')
  const { data } = await requestGitLab<GitLabProject>(
    source, `projects/${encodeURIComponent(String(idOrPath))}`, new URLSearchParams(), options,
  )
  return data
}

export function getTopStarredProjects(source: string, options: TopStarredProjectsOptions = {}) {
  return listProjects(source, { perPage: 10, ...options, orderBy: 'star_count', sort: 'desc', visibility: 'public' })
}

export function searchProjects(source: string, query: string, options: SearchProjectsOptions = {}) {
  const search = query.trim()
  if (!search) throw new TypeError('A non-empty search query is required.')
  return listProjects(source, { perPage: 10, ...options, search, visibility: 'public' })
}
