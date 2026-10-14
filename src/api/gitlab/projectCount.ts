import type { GitLabRequestOptions } from '../../types/gitlab.ts'
import { Failure, Success, type Result } from '../../types/result.ts'
import { requestGitLab } from './client.ts'
import { headerNumber, validIdentifier } from './page.ts'

const countLimit = 10_000

function isProjectId(data: unknown): data is { id: number } {
  return typeof data === 'object' && data !== null
    && 'id' in data && typeof data.id === 'number' && validIdentifier(data.id)
}

/**
 * Counts visible projects (public anonymously, accessible with a token), including
 * archives. Uses small REST requests and splits ID ranges when totals are omitted
 * above GitLab's count limit. If CORS hides pagination headers, counts simple
 * project pages using an ID cursor. Multiple requests are not an atomic snapshot.
 */
export async function getProjectCount(source: string, options: GitLabRequestOptions = {}): Promise<Result<number>> {
  const params = new URLSearchParams({ simple: 'true', order_by: 'id', sort: 'desc', per_page: '1' })
  if (!options.token) params.set('visibility', 'public')

  async function requestIds(query: URLSearchParams): Promise<Result<{ data: { id: number }[]; headers: Headers }>> {
    if (options.signal?.aborted) return Failure('GitLab request canceled.')
    const response = await requestGitLab<unknown>(source, 'projects', query, options)
    if (response.success === false) return Failure(response.error)
    const { data, headers } = response.value
    if (!Array.isArray(data) || !data.every(isProjectId)) return Failure('GitLab returned an invalid project list.')
    return Success({ data, headers })
  }

  async function countRange(after: number, before?: number): Promise<Result<number>> {
    const query = new URLSearchParams(params)
    if (after > 0) query.set('id_after', String(after))
    if (before !== undefined) query.set('id_before', String(before))
    const response = await requestIds(query)
    if (response.success === false) return response
    const { data, headers } = response.value
    const total = headerNumber(headers, 'x-total')
    // Treat the boundary conservatively, including instances returning a capped total.
    if (total !== null && total < countLimit) return Success(total)
    if (data.length === 0) return Success(0)
    if (headers.has('x-next-page') && !headers.get('x-next-page')?.trim()) return Success(data.length)

    const highestId = data[0].id
    if (highestId - after === 1) return Success(1)
    // No readable pagination headers usually means CORS, so splitting cannot help.
    // Also stop splitting small ranges if an instance omits totals there as well.
    if (highestId - after < countLimit
      || (!headers.has('x-total') && !headers.has('x-per-page') && !headers.has('x-next-page'))) {
      let count = data.length
      let cursor = highestId
      query.set('per_page', '100')
      while (true) {
        query.set('id_before', String(cursor))
        const page = await requestIds(query)
        if (page.success === false) return page
        const items = page.value.data
        count += items.length
        if (items.length < 100) return Success(count)
        cursor = items[items.length - 1].id
      }
    }

    const middle = after + Math.floor((highestId - after) / 2)
    // id_after/id_before are exclusive: the two ranges share no projects.
    const lower = await countRange(after, middle + 1)
    if (lower.success === false) return lower
    const upper = await countRange(middle, highestId + 1)
    if (upper.success === false) return upper
    return Success(lower.value + upper.value)
  }

  return countRange(0)
}
