import type { ReactElement } from 'react'
import { render } from '@testing-library/react'
import { BaseStyles } from '@primer/react'
import { ThemeProvider } from '@primer/react/next'
import type { GitLabProject } from '../types/gitlab.ts'
import type { ArcPage } from '../types/arc.ts'
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
