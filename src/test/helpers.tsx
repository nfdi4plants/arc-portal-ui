import type { ReactElement } from 'react'
import { render, screen, within } from '@testing-library/react'
import type userEvent from '@testing-library/user-event'
import { BaseStyles } from '@primer/react'
import { ThemeProvider } from '@primer/react/next'
import { vi } from 'vitest'
import type { GitLabInstance, GitLabProject } from '../types/gitlab.ts'
import type { ArcPage } from '../types/arc.ts'
import type { ArcSummary, DataHubConnection } from '../types/dashboard.ts'
import { Success } from '../types/result.ts'

export function renderWithTheme(element: ReactElement, strictMode = false) {
  return render(element, {
    reactStrictMode: strictMode,
    wrapper: ({ children }) => <ThemeProvider><BaseStyles>{children}</BaseStyles></ThemeProvider>,
  })
}

export async function openAccountMenu(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Account menu' }))
  return within(await screen.findByRole('dialog', { name: 'Signed-in accounts' }))
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

export const plantdatahub: GitLabInstance = {
  id: 'plantdatahub', name: 'PLANTdataHUB (official)', url: 'https://git.nfdi4plants.org',
}

export function arcSummary(overrides: Partial<ArcSummary> = {}): ArcSummary {
  return {
    key: 'git.nfdi4plants.org/ceplas/arabidopsis@main',
    projectId: 1,
    hubId: 'plantdatahub',
    title: 'Arabidopsis study',
    description: 'A study of plant growth.',
    group: { key: 'plantdatahub/ceplas', label: 'CEPLAS', hubId: 'plantdatahub', personal: false },
    access: 'public',
    member: false,
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
    hub: plantdatahub,
    includesPrivate: false,
    fetchProjects: async () => Success([]),
    fetchGroups: async () => Success([]),
    fetchMemberProjectIds: async () => Success([]),
    fetchContributors: async () => Success([]),
    fetchLatestCommit: async () => Success(null),
    ...overrides,
  }
}

type GitLabFetchHandler = (url: URL, init?: RequestInit) => Response | Promise<Response>

/**
 * A fetch stub that routes GitLab requests by host, so each configured DataHUB can
 * answer (or fail) independently. `overrides` replace the handler for one host.
 */
export function stubGitLabFetch(handler: GitLabFetchHandler, overrides: Record<string, GitLabFetchHandler> = {}) {
  return vi.fn<typeof fetch>(async (input, init) => {
    const url = new URL(String(input))
    const respond = overrides[url.host] ?? handler
    return respond(url, init)
  })
}
