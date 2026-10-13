import type { GitLabPage, GitLabRequestOptions } from '../../types/gitlab.ts'
import { Failure, Success, type Result } from '../../types/result.ts'
import { requestGitLab } from './client.ts'

function headerNumber(headers: Headers, name: string): number | null {
  const value = headers.get(name)
  if (!value?.trim()) return null
  const number = Number(value)
  return Number.isSafeInteger(number) && number >= 0 ? number : null
}

export function validIdentifier(value: number | string) {
  return typeof value === 'number' ? Number.isSafeInteger(value) && value > 0 : !!value.trim()
}

/** Shared paging preserves the fallback when CORS hides pagination headers. */
export async function requestPage<T>(
  source: string,
  resource: string,
  params: URLSearchParams,
  options: GitLabRequestOptions & { page?: number; perPage?: number },
  isItem: (item: unknown) => item is T,
  label: string,
): Promise<Result<GitLabPage<T>>> {
  const page = options.page ?? 1
  const perPage = options.perPage ?? 20
  if (!Number.isSafeInteger(page) || page < 1) return Failure('page must be a positive integer.')
  if (!Number.isInteger(perPage) || perPage < 1 || perPage > 100) return Failure('perPage must be an integer between 1 and 100.')
  params.set('page', String(page))
  params.set('per_page', String(perPage))
  const response = await requestGitLab<unknown>(source, resource, params, options)
  if (response.success === false) return Failure(response.error)
  console.log(response)  
  const { data, headers } = response.value
  if (!Array.isArray(data) || !data.every(isItem)) return Failure(`GitLab returned an invalid ${label} list.`)
  return Success({
    items: data, page, perPage,
    nextPage: headers.has('x-next-page')
      ? headerNumber(headers, 'x-next-page') || null
      : data.length === perPage ? page + 1 : null,
    previousPage: headers.has('x-prev-page')
      ? headerNumber(headers, 'x-prev-page') || null
      : page > 1 ? page - 1 : null,
    total: headerNumber(headers, 'x-total'),
    totalPages: headerNumber(headers, 'x-total-pages'),
  })
}
