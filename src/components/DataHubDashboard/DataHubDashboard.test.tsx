import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import DataHubDashboard from './DataHubDashboard.tsx'
import { arcPage, dashboardWrapper, deferred, fakeDashboardConfiguration, gitLabProjectFull, plantdatahub } from '../../test/helpers.tsx'
import { Failure, Success, type Result } from '../../types/result.ts'
import type { DashboardConfiguration } from './configuration.ts'
import type { GitLabPage, GitLabProject } from '../../types/gitlab.ts'
import { AUTH_FAILED_MESSAGE } from '../../api/gitlab/client.ts'

const otherHub = { id: 'other', name: 'Other Hub', url: 'https://other.example' }
const now = () => new Date('2026-10-14T12:00:00Z')
const first = gitLabProjectFull({ name: 'First ARC' })
const second = gitLabProjectFull({ id: 2, name: 'Second ARC', path_with_namespace: 'plants/second' })

beforeEach(() => localStorage.clear())

function setup(overrides: Partial<DashboardConfiguration> = {}, tokens: Record<string, string> = {}, strictMode = false) {
  const configuration = fakeDashboardConfiguration({ dataHubs: [plantdatahub, otherHub], ...overrides })
  const onArcClick = vi.fn()
  const rendered = render(<DataHubDashboard onArcClick={onArcClick} now={now} />, {
    wrapper: dashboardWrapper(configuration, tokens), reactStrictMode: strictMode,
  })
  return { configuration, onArcClick, ...rendered }
}

describe('paged dashboard', () => {
  it.each([false, true])('loads counts independently and only the selected project page (StrictMode: %s)', async strictMode => {
    const page = deferred<Result<GitLabPage<GitLabProject>>>()
    const fetchProjects = vi.fn<DashboardConfiguration['fetchProjects']>(() => page.promise)
    const fetchProjectCount = vi.fn<DashboardConfiguration['fetchProjectCount']>(async source => Success(source === plantdatahub.url ? 10_000 : null))
    setup({ fetchProjects, fetchProjectCount }, {}, strictMode)
    expect(await screen.findByRole('button', { name: 'PLANTdataHUB (official): 10,000+ ARCs' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Other Hub: Count unavailable' })).not.toHaveAttribute('aria-busy')
    expect(screen.getByRole('region', { name: 'ARCs' })).toHaveAttribute('aria-busy', 'true')
    expect(fetchProjects.mock.calls.every(([source]) => source === plantdatahub.url)).toBe(true)
    expect(fetchProjects).toHaveBeenCalledTimes(strictMode ? 2 : 1)
    await act(async () => page.resolve(Success(arcPage([first], { perPage: 25, nextPage: 2, total: 26 }))))
    expect(await screen.findByRole('button', { name: 'Open First ARC' })).toBeVisible()
    expect(screen.queryByRole('columnheader', { name: 'People' })).not.toBeInTheDocument()
    expect(fetchProjects).toHaveBeenCalledTimes(strictMode ? 2 : 1)
  })

  it('requests pages on navigation and resets paging for search, sort, recent activity and hub selection', async () => {
    const fetchProjects = vi.fn<DashboardConfiguration['fetchProjects']>(async (_source, options) => Success(arcPage(
      options?.page === 2 ? [second] : [first],
      { page: options?.page ?? 1, perPage: 25, nextPage: options?.page === 2 ? null : 2,
        previousPage: options?.page === 2 ? 1 : null, total: 26 },
    )))
    const user = userEvent.setup()
    setup({ fetchProjects })
    await screen.findByRole('button', { name: 'Open First ARC' })
    expect(fetchProjects.mock.calls[0][1]).toMatchObject({ page: 1, perPage: 25, orderBy: 'updated_at', sort: 'desc', visibility: 'public' })
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await screen.findByRole('button', { name: 'Open Second ARC' })
    expect(fetchProjects).toHaveBeenCalledTimes(2)
    await user.type(screen.getByRole('searchbox', { name: 'Search ARCs' }), 'plant')
    expect(fetchProjects).toHaveBeenCalledTimes(2)
    await user.click(screen.getByRole('button', { name: 'Search' }))
    await screen.findByRole('button', { name: 'Open First ARC' })
    expect(fetchProjects.mock.calls.at(-1)![1]).toMatchObject({ search: 'plant', page: 1 })
    await user.click(screen.getByRole('button', { name: 'Only recently changed ARCs' }))
    await waitFor(() => expect(fetchProjects.mock.calls.at(-1)![1]?.lastActivityAfter).toBe('2026-09-14T12:00:00.000Z'))
    await screen.findByRole('button', { name: 'Open First ARC' })
    await user.click(within(screen.getByRole('columnheader', { name: /Title/ })).getByRole('button'))
    await waitFor(() => expect(fetchProjects.mock.calls.at(-1)![1]).toMatchObject({ orderBy: 'name', page: 1 }))
    await screen.findByRole('button', { name: 'Open First ARC' })
    await user.click(screen.getByRole('button', { name: 'Other Hub: 3 ARCs' }))
    await waitFor(() => expect(fetchProjects.mock.calls.at(-1)![0]).toBe(otherHub.url))
    expect(fetchProjects.mock.calls.at(-1)![1]?.page).toBe(1)
  })

  it('selects exactly one repository option and resets paging while preserving search', async () => {
    const fetchProjects = vi.fn<DashboardConfiguration['fetchProjects']>(async (_source, options) => Success(arcPage(
      options?.page === 2 ? [second] : [first],
      { page: options?.page ?? 1, perPage: 25, nextPage: 2, previousPage: options?.page === 2 ? 1 : null, total: 26 },
    )))
    const user = userEvent.setup()
    setup({ fetchProjects }, { [plantdatahub.id]: 'runtime-token' })
    await screen.findByRole('button', { name: 'Open First ARC' })
    const selector = within(screen.getByRole('list', { name: 'Repositories' }))
    expect(selector.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await screen.findByRole('button', { name: 'Open Second ARC' })
    await user.click(selector.getByRole('button', { name: 'Your' }))
    await screen.findByRole('button', { name: 'Open First ARC' })
    expect(fetchProjects.mock.calls.at(-1)![1]).toMatchObject({
      membership: true, token: 'runtime-token', page: 1, perPage: 25, orderBy: 'updated_at', sort: 'desc',
    })
    expect(selector.getAllByRole('button', { pressed: true })).toHaveLength(1)
    expect(selector.getByRole('button', { name: 'Your' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(selector.getByRole('button', { name: 'Your' }))
    expect(selector.getByRole('button', { name: 'Your' })).toHaveAttribute('aria-pressed', 'true')
    await user.type(screen.getByRole('searchbox', { name: 'Search ARCs' }), 'plants')
    await user.click(screen.getByRole('button', { name: 'Search' }))
    await screen.findByRole('button', { name: 'Open First ARC' })
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await screen.findByRole('button', { name: 'Open Second ARC' })
    await user.click(selector.getByRole('button', { name: 'Most Starred' }))
    await screen.findByRole('button', { name: 'Open First ARC' })
    expect(fetchProjects.mock.calls.at(-1)![1]).toMatchObject({
      membership: undefined, page: 1, search: 'plants', orderBy: 'star_count', sort: 'desc',
    })
    expect(selector.getAllByRole('button', { pressed: true })).toHaveLength(1)
    expect(selector.getByRole('button', { name: 'Most Starred' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(screen.getByRole('columnheader', { name: 'Title' })).queryByRole('button')).not.toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: /Last activity/ })?.getAttribute('aria-sort')).toBeNull()
    await user.click(selector.getByRole('button', { name: 'All' }))
    await screen.findByRole('button', { name: 'Open First ARC' })
    expect(fetchProjects.mock.calls.at(-1)![1]).toMatchObject({
      membership: undefined, page: 1, search: 'plants', orderBy: 'updated_at', sort: 'desc',
    })
    expect(selector.getAllByRole('button', { pressed: true })).toHaveLength(1)
    expect(selector.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true')
  })

  it.each(['Your', 'Most Starred'])('keeps %s repositories and organisation filtering mutually exclusive', async label => {
    const group = { id: 2, name: 'Plants', full_path: 'research/plants' }
    const fetchProjects = vi.fn<DashboardConfiguration['fetchProjects']>(async () => Success(arcPage([first])))
    const fetchGroupProjects = vi.fn<DashboardConfiguration['fetchGroupProjects']>(async () => Success(arcPage([second])))
    const user = userEvent.setup()
    setup({ fetchProjects, fetchGroupProjects,
      fetchGroups: async source => Success(source === plantdatahub.url ? [group] : []),
    }, { [plantdatahub.id]: 'runtime-token' })
    await screen.findByRole('button', { name: 'Open First ARC' })
    const selector = within(screen.getByRole('list', { name: 'Repositories' }))
    await user.click(selector.getByRole('button', { name: label }))
    await screen.findByRole('button', { name: 'Open First ARC' })
    await user.click(await screen.findByRole('button', { name: 'Browse research/plants on PLANTdataHUB (official)' }))
    await screen.findByRole('button', { name: 'Open Second ARC' })
    expect(selector.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByRole('button', { name: `Remove filter ${label} repositories` })).not.toBeInTheDocument()
    expect(fetchGroupProjects.mock.calls.at(-1)![2]).toMatchObject({ orderBy: 'last_activity_at', page: 1 })
    expect(fetchGroupProjects.mock.calls.at(-1)![2]).not.toHaveProperty('membership')
    await user.click(selector.getByRole('button', { name: label }))
    await screen.findByRole('button', { name: 'Open First ARC' })
    expect(screen.queryByRole('button', { name: 'Remove filter Group: research/plants' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Browse research/plants on PLANTdataHUB (official)' })).toHaveAttribute('aria-pressed', 'false')
    expect(fetchProjects.mock.calls.at(-1)![1]).toMatchObject({
      membership: label === 'Your' ? true : undefined, orderBy: label === 'Your' ? 'updated_at' : 'star_count', page: 1,
    })
    await user.click(screen.getByRole('button', { name: 'Browse research/plants on PLANTdataHUB (official)' }))
    await screen.findByRole('button', { name: 'Open Second ARC' })
    await user.click(selector.getByRole('button', { name: 'All' }))
    await screen.findByRole('button', { name: 'Open First ARC' })
    expect(fetchProjects.mock.calls.at(-1)![1]).toMatchObject({ membership: undefined, orderBy: 'updated_at', sort: 'desc' })
    expect(screen.queryByRole('button', { name: 'Remove filter Group: research/plants' })).not.toBeInTheDocument()
  })

  it('requires login on the selected hub for Your repositories and lets users return to All', async () => {
    const fetchProjects = vi.fn<DashboardConfiguration['fetchProjects']>(async () => Success(arcPage([first])))
    const user = userEvent.setup()
    setup({ fetchProjects }, { [otherHub.id]: 'other-token' })
    await screen.findByRole('button', { name: 'Open First ARC' })
    await user.click(screen.getByRole('button', { name: 'Your' }))
    expect(await screen.findByText('Log in to PLANTdataHUB (official) to see your repositories.')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Open First ARC' })).not.toBeInTheDocument()
    expect(fetchProjects).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole('button', { name: 'Remove filter Your repositories' }))
    await screen.findByRole('button', { name: 'Open First ARC' })
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true')
    expect(fetchProjects.mock.calls.at(-1)![1]).toMatchObject({ orderBy: 'updated_at', visibility: 'public' })
  })

  it('keeps an expired membership request from falling back to public repositories', async () => {
    const fetchProjects = vi.fn<DashboardConfiguration['fetchProjects']>(async (_source, options) =>
      options?.membership ? Failure(AUTH_FAILED_MESSAGE) : Success(arcPage([first])))
    const user = userEvent.setup()
    setup({ fetchProjects }, { [plantdatahub.id]: 'expired-token' })
    await screen.findByRole('button', { name: 'Open First ARC' })
    await user.click(screen.getByRole('button', { name: 'Your' }))
    expect(await screen.findByText(AUTH_FAILED_MESSAGE)).toBeVisible()
    expect(fetchProjects).toHaveBeenCalledTimes(2)
    expect(fetchProjects.mock.calls.at(-1)![1]).toMatchObject({ membership: true, token: 'expired-token' })
    expect(screen.queryByRole('button', { name: 'Open First ARC' })).not.toBeInTheDocument()
  })

  it('clears the repository option with the other filters', async () => {
    const fetchProjects = vi.fn<DashboardConfiguration['fetchProjects']>(async () => Success(arcPage([first])))
    const user = userEvent.setup()
    setup({ fetchProjects })
    await screen.findByRole('button', { name: 'Open First ARC' })
    await user.click(screen.getByRole('button', { name: 'Most Starred' }))
    await screen.findByRole('button', { name: 'Open First ARC' })
    await user.click(screen.getByRole('button', { name: 'Clear all' }))
    await screen.findByRole('button', { name: 'Open First ARC' })
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true')
    expect(fetchProjects.mock.calls.at(-1)![1]).toMatchObject({ membership: undefined, orderBy: 'updated_at', sort: 'desc' })
  })

  it('browses subgroups with one project-page request and removes the unsupported recent filter', async () => {
    const group = { id: 2, name: 'Plants', full_path: 'research/plants' }
    const fetchGroupProjects = vi.fn<DashboardConfiguration['fetchGroupProjects']>(async () =>
      Success(arcPage([second], { perPage: 25 })))
    const fetchProjects = vi.fn<DashboardConfiguration['fetchProjects']>(async () => Success(arcPage([first])))
    const user = userEvent.setup()
    setup({ fetchProjects, fetchGroupProjects, fetchGroups: async source => Success(source === otherHub.url ? [group] : []) })
    await screen.findByRole('button', { name: 'Open First ARC' })
    await user.click(screen.getByRole('button', { name: 'Only recently changed ARCs' }))
    await screen.findByRole('button', { name: 'Open First ARC' })
    await user.click(await screen.findByRole('button', { name: 'Browse research/plants on Other Hub' }))
    await screen.findByRole('button', { name: 'Open Second ARC' })
    expect(fetchGroupProjects).toHaveBeenCalledTimes(1)
    expect(fetchGroupProjects).toHaveBeenCalledWith(otherHub.url, 2, expect.objectContaining({
      page: 1, perPage: 25, orderBy: 'last_activity_at', sort: 'desc',
    }))
    expect(screen.queryByRole('button', { name: 'Only recently changed ARCs' })).not.toBeInTheDocument()
    expect(fetchProjects).toHaveBeenCalledTimes(2)
  })

  it('keeps missing totals unknown and uses next-page metadata without scanning', async () => {
    const fetchProjects = vi.fn<DashboardConfiguration['fetchProjects']>(async () =>
      Success(arcPage([first], { perPage: 25, nextPage: 2, total: null })))
    setup({ fetchProjects })
    await screen.findByRole('button', { name: 'Open First ARC' })
    expect(screen.getByRole('status')).toHaveTextContent('Showing 1 ARCs on this page')
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled()
    expect(fetchProjects).toHaveBeenCalledTimes(1)
  })

  it('retries failures and refreshes loaded resources on Update', async () => {
    const fetchProjects = vi.fn<DashboardConfiguration['fetchProjects']>()
      .mockResolvedValueOnce(Failure('Offline')).mockResolvedValue(Success(arcPage([first])))
    const fetchProjectCount = vi.fn<DashboardConfiguration['fetchProjectCount']>(async () => Success(3))
    const fetchGroups = vi.fn<DashboardConfiguration['fetchGroups']>(async () => Success([]))
    const user = userEvent.setup()
    setup({ fetchProjects, fetchProjectCount, fetchGroups })
    await user.click(await screen.findByRole('button', { name: 'Retry ARCs' }))
    await screen.findByRole('button', { name: 'Open First ARC' })
    await user.click(screen.getByRole('button', { name: 'Update' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Update' })).toBeEnabled())
    expect(fetchProjects).toHaveBeenCalledTimes(3)
    expect(fetchProjectCount).toHaveBeenCalledTimes(4)
    expect(fetchGroups).toHaveBeenCalledTimes(4)
  })

  it('preserves opening and external-link actions', async () => {
    const user = userEvent.setup()
    const { onArcClick } = setup({ fetchProjects: async () => Success(arcPage([first])) })
    const external = await screen.findByRole('link', { name: 'View First ARC on PLANTdataHUB (official)' })
    expect(external).toHaveAttribute('href', first.web_url)
    expect(external).toHaveAttribute('target', '_blank')
    await user.click(screen.getByRole('button', { name: 'Open First ARC' }))
    expect(onArcClick).toHaveBeenCalledWith(first.web_url, first.name, first.id, plantdatahub)
  })
})
