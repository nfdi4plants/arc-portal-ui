import type { GitLabRequestOptions } from '../../types/gitlab.ts'
import { Failure, Success, type Result } from '../../types/result.ts'

export const AUTH_FAILED_MESSAGE = 'Authentication failed: the token is invalid or expired.'

function apiUrl(source: string, resource: string, params: URLSearchParams) {
  const url = new URL(source)
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new TypeError('GitLab source must be an HTTP(S) instance URL without credentials, a query, or a fragment.')
  }
  url.pathname = `${url.pathname.replace(/\/+$/, '')}/api/v4/${resource}`
  url.search = params.toString()
  return url
}

function isCanceled(error: unknown, signal?: AbortSignal) {
  // DOMException can come from a different realm, so do not rely on instanceof.
  return !!signal?.aborted || (
    typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError'
  )
}

export async function requestGitLab<T>(
  source: string,
  resource: string,
  params: URLSearchParams,
  options: GitLabRequestOptions & { method?: 'POST' } = {},
): Promise<Result<{ data: T; headers: Headers }>> {
  let url: URL
  let headers: Headers
  try {
    url = apiUrl(source, resource, params)
    headers = new Headers({ Accept: 'application/json' })
    if (options.token) headers.set('Authorization', `Bearer ${options.token}`)
  } catch (error) {
    return Failure(error instanceof Error ? error.message : 'Invalid GitLab request options.')
  }

  let response: Response
  try {
    response = await (options.fetchCall ?? fetch)(url, {
      headers, signal: options.signal, credentials: 'omit', ...(options.method ? { method: options.method } : {}),
    })
  } catch (error) {
    return Failure(isCanceled(error, options.signal)
      ? 'GitLab request canceled.'
      : 'Unable to reach GitLab. Check your connection and the instance’s browser access settings.')
  }

  if (!response.ok) {
    let body: { message?: unknown; error?: unknown } | null = null
    try { body = await response.json() } catch (error) {
      if (isCanceled(error, options.signal)) return Failure('GitLab request canceled.')
    }
    if (response.status === 401) return Failure(AUTH_FAILED_MESSAGE)
    const detail = body?.message ?? body?.error
    return Failure(
      `GitLab request failed (${response.status})${typeof detail === 'string' ? `: ${detail}` : '.'}`,
    )
  }

  try {
    return Success({ data: await response.json() as T, headers: response.headers })
  } catch (error) {
    return Failure(isCanceled(error, options.signal) ? 'GitLab request canceled.' : 'GitLab returned an invalid JSON response.')
  }
}
