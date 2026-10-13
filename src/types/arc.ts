import type { GitLabPage, GitLabProject } from './gitlab.ts'
import type { Result } from './result.ts'

export type ArcPage = GitLabPage<GitLabProject>
/** Defaults: page 1, 10 results per page. Honor signal when cancellation is supported. */
export interface ArcFetchOptions {
  page?: number
  perPage?: number
  signal?: AbortSignal
}

export type ArcSearchOptions = ArcFetchOptions

/** Expected failures resolve to a Result, including transport failures. */
export type FetchArcs = (options?: ArcFetchOptions) => Promise<Result<ArcPage>>
export type SearchArcs = (query: string, options?: ArcSearchOptions) => Promise<Result<ArcPage>>
