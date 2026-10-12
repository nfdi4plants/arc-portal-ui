import type { GitLabRequestOptions } from '../../types/gitlab.ts'

export class GitLabApiError extends Error {
  readonly status: number | null

  constructor(message: string, status: number | null, cause?: unknown) {
    super(message, { cause })
    this.name = 'GitLabApiError'
    this.status = status
  }
}

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
  options: GitLabRequestOptions,
): Promise<{ data: T; headers: Headers }> {
  const url = apiUrl(source, resource, params)
  const headers = new Headers({ Accept: 'application/json' })
  if (options.token) headers.set('PRIVATE-TOKEN', options.token)

  let response: Response
  try {
    response = await (options.fetchCall ?? fetch)(url, { headers, signal: options.signal, credentials: 'omit' })
  } catch (error) {
    if (isCanceled(error, options.signal)) throw error
    throw new GitLabApiError('Unable to reach GitLab. Check your connection and the instance’s browser access settings.', null, error)
  }

  if (!response.ok) {
    const body = await response.json().catch(error => {
      if (isCanceled(error, options.signal)) throw error
      return null
    }) as { message?: unknown; error?: unknown } | null
    const detail = body?.message ?? body?.error
    throw new GitLabApiError(
      `GitLab request failed (${response.status})${typeof detail === 'string' ? `: ${detail}` : '.'}`,
      response.status,
    )
  }

  try {
    return { data: await response.json() as T, headers: response.headers }
  } catch (error) {
    if (isCanceled(error, options.signal)) throw error
    throw new GitLabApiError('GitLab returned an invalid JSON response.', response.status, error)
  }
}
