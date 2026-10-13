import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { getTopStarredProjects, searchProjects } from './api/gitlab/index.ts'
import { referenceGitLab } from './config/gitlab.ts'
import { arcResult, project } from './test/helpers.tsx'
import App from './App.tsx'

vi.mock('./api/gitlab/index.ts', () => ({
  getTopStarredProjects: vi.fn(),
  searchProjects: vi.fn(),
  listAllGroups: vi.fn(async () => ({ success: true, value: [] })),
  getCurrentUser: vi.fn(),
  getGroupProjects: vi.fn(),
}))

beforeEach(() => localStorage.clear())

it('wires dashboard callbacks to the reference GitLab APIs with request options', async () => {
  vi.mocked(getTopStarredProjects).mockResolvedValue(arcResult([project({ name: 'Featured ARC' })]))
  vi.mocked(searchProjects).mockResolvedValue(arcResult([project({ name: 'Matching ARC' })]))
  const user = userEvent.setup()
  const view = render(<App />)
  expect(await screen.findByRole('link', { name: 'Featured ARC' })).toBeVisible()
  expect(getTopStarredProjects).toHaveBeenCalledWith(referenceGitLab.source, {
    page: 1, perPage: 10, signal: expect.any(AbortSignal), token: undefined,
  })
  expect(searchProjects).not.toHaveBeenCalled()
  await user.type(screen.getByRole('textbox'), 'plants{Enter}')
  expect(await screen.findByRole('link', { name: 'Matching ARC' })).toBeVisible()
  expect(searchProjects).toHaveBeenCalledWith(referenceGitLab.source, 'plants', {
    page: 1, perPage: 10, signal: expect.any(AbortSignal), token: undefined,
  })
  view.rerender(<App />)
  expect(getTopStarredProjects).toHaveBeenCalledTimes(1)
  expect(searchProjects).toHaveBeenCalledTimes(1)
})
