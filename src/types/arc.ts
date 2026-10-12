import type { GitLabPage, GitLabProject } from './gitlab.ts'

export type ArcPage = GitLabPage<GitLabProject>
export type FetchArcs = (signal: AbortSignal) => Promise<ArcPage>

export interface ArcSearchOptions {
  page: number
  perPage: number
  signal: AbortSignal
}

export type SearchArcs = (query: string, options: ArcSearchOptions) => Promise<ArcPage>
