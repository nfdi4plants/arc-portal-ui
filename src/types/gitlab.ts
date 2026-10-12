/** Public project fields used by the ARC portal; GitLab names stay intact. */
export interface GitLabProject {
  id: number
  name: string
  name_with_namespace?: string
  path_with_namespace: string
  web_url: string
  description: string | null
  star_count: number
  archived?: boolean
  topics?: string[]
  last_activity_at?: string
}

export interface GitLabRequestOptions {
  signal?: AbortSignal
  /** Explicit transport injection for callers and tests; defaults to native fetch. */
  fetchCall?: typeof fetch
  /** Supplied at runtime; never put a private token in browser build config. */
  token?: string
}

export interface ListProjectsOptions extends GitLabRequestOptions {
  page?: number
  perPage?: number
  search?: string
  orderBy?: 'id' | 'name' | 'path' | 'created_at' | 'updated_at' | 'star_count' | 'last_activity_at'
  sort?: 'asc' | 'desc'
  visibility?: 'public' | 'internal' | 'private'
  archived?: boolean
}

export interface GitLabPage<T> {
  items: T[]
  page: number
  perPage: number
  nextPage: number | null
  previousPage: number | null
  total: number | null
  totalPages: number | null
}

export type TopStarredProjectsOptions = Omit<ListProjectsOptions, 'search' | 'orderBy' | 'sort' | 'visibility'>
export type SearchProjectsOptions = Omit<ListProjectsOptions, 'search' | 'visibility'>
