import type { GitLabPage, GitLabProject } from './gitlab.ts'

export type ArcPage = GitLabPage<GitLabProject>
/** Defaults: page 1, 10 results per page. Honor signal when cancellation is supported. */
export interface ArcFetchOptions {
  page?: number
  perPage?: number
  signal?: AbortSignal
}

export type ArcSearchOptions = ArcFetchOptions

/** Return page data directly; mocks can resolve, delay, or reject the promise. */
export type FetchArcs = (options?: ArcFetchOptions) => Promise<ArcPage>
export type SearchArcs = (query: string, options?: ArcSearchOptions) => Promise<ArcPage>
