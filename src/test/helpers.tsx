import type { ReactElement } from 'react'
import { render } from '@testing-library/react'
import { BaseStyles } from '@primer/react'
import { ThemeProvider } from '@primer/react/next'
import type { GitLabProject } from '../types/gitlab.ts'
import type { ArcPage } from '../types/arc.ts'
import type { ArcSummary, DataHubConnection } from '../types/dashboard.ts'
import { dataHubs } from '../config/gitlab.ts'
import { Success } from '../types/result.ts'

export function renderWithTheme(element: ReactElement, strictMode = false) {
  return render(element, {
    reactStrictMode: strictMode,
    wrapper: ({ children }) => <ThemeProvider><BaseStyles>{children}</BaseStyles></ThemeProvider>,
  })
}

export function project(overrides: Partial<GitLabProject> = {}): GitLabProject {
  return {
    id: 1,
    name: 'Arabidopsis study',
    path_with_namespace: 'research/arabidopsis',
    web_url: 'https://gitlab.example/research/arabidopsis',
    description: 'A study of plant growth.',
    star_count: 42,
    ...overrides,
  }
}

export function projectResponse(items: GitLabProject[] = [project()], headers: HeadersInit = {}) {
  return Response.json(items, { headers })
}

export function arcPage(items: GitLabProject[] = [project()], overrides: Partial<ArcPage> = {}): ArcPage {
  return {
    items, page: 1, perPage: 10, nextPage: null, previousPage: null, total: null, totalPages: null,
    ...overrides,
  }
}

export function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

export function arcResult(items: GitLabProject[] = [project()], overrides: Partial<ArcPage> = {}) {
  return Success(arcPage(items, overrides))
}

export function arcSummary(overrides: Partial<ArcSummary> = {}): ArcSummary {
  return {
    key: 'git.nfdi4plants.org/ceplas/arabidopsis@main',
    projectId: 1,
    hubId: 'nfdi4plants',
    title: 'Arabidopsis study',
    description: 'A study of plant growth.',
    group: { key: 'nfdi4plants/ceplas', label: 'CEPLAS', hubId: 'nfdi4plants', personal: false },
    access: 'public',
    createdAt: '2026-03-01T10:00:00Z',
    lastActivityAt: '2026-10-10T10:00:00Z',
    topics: [],
    stars: 0,
    url: 'https://git.nfdi4plants.org/ceplas/arabidopsis',
    ...overrides,
  }
}

export function gitLabProjectFull(overrides: Partial<GitLabProject> = {}): GitLabProject {
  return project({
    visibility: 'public',
    namespace: { id: 2, name: 'CEPLAS', path: 'ceplas', kind: 'group', full_path: 'ceplas' },
    created_at: '2026-03-01T10:00:00Z',
    last_activity_at: '2026-10-10T10:00:00Z',
    topics: [],
    default_branch: 'main',
    ...overrides,
  })
}

/** Every callback resolves with an empty success unless overridden. */
export function fakeConnection(overrides: Partial<DataHubConnection> = {}): DataHubConnection {
  return {
    hub: dataHubs[0],
    includesPrivate: false,
    fetchProjects: async () => Success([]),
    fetchGroups: async () => Success([]),
    fetchContributors: async () => Success([]),
    fetchLatestCommit: async () => Success(null),
    ...overrides,
  }
}
