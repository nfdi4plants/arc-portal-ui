import type { GitLabRequestOptions } from '../../types/gitlab.ts'
import { Failure, Success, type Result } from '../../types/result.ts'
import { requestGitLab } from './client.ts'
import { headerNumber, validIdentifier } from './page.ts'

export const PROJECT_COUNT_LIMIT = 10_000

/**
 * One small request for the visible project count. Values at the limit are capped;
 * null means browser access settings hide the pagination headers. Never scans pages.
 */
export async function getProjectCount(source: string, options: GitLabRequestOptions = {}): Promise<Result<number | null>> {
  const params = new URLSearchParams({ simple: 'true', order_by: 'id', sort: 'desc', per_page: '1' })
  if (!options.token) params.set('visibility', 'public')
  return requestProjectCount(source, 'projects', params, options)
}

/** Counts accessible repositories, including subgroups and excluding shared projects. */
export function getGroupProjectCount(source: string, id: number, options: GitLabRequestOptions = {}): Promise<Result<number | null>> {
  if (!validIdentifier(id)) return Promise.resolve(Failure('A valid group ID is required.'))
  const params = new URLSearchParams({ simple: 'true', order_by: 'id', sort: 'desc', per_page: '1',
    include_subgroups: 'true', with_shared: 'false' })
  return requestProjectCount(source, 'groups/' + id + '/projects', params, options)
}

async function requestProjectCount(source: string, resource: string, params: URLSearchParams,
  options: GitLabRequestOptions): Promise<Result<number | null>> {
  if (options.signal?.aborted) return Failure('GitLab request canceled.')
  const response = await requestGitLab<unknown>(source, resource, params, options)
  if (response.success === false) return Failure(response.error)
  if (options.signal?.aborted) return Failure('GitLab request canceled.')
  const { data, headers } = response.value
  if (!Array.isArray(data) || !data.every(item => typeof item === 'object' && item !== null
    && 'id' in item && typeof item.id === 'number' && validIdentifier(item.id))) {
    return Failure('GitLab returned an invalid project list.')
  }
  const total = headerNumber(headers, 'x-total')
  if (total !== null) return Success(Math.min(total, PROJECT_COUNT_LIMIT))
  if (data.length === 0) return Success(0)
  if (headers.has('x-next-page') && !headers.get('x-next-page')?.trim()) return Success(data.length)
  // GitLab omits X-Total above 10,000. Require readable pagination metadata so
  // a server hiding all headers through CORS is not mistaken for a large hub.
  return Success(headers.has('x-per-page') || headers.has('x-next-page') ? PROJECT_COUNT_LIMIT : null)
}
