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
    expect(screen.getByRole('list', { name: 'ARCs' })).toBeVisible()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
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
    await user.click(screen.getByRole('link', { name: 'Next Page' }))
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
    await user.click(screen.getByRole('link', { name: 'Next Page' }))
    await screen.findByRole('button', { name: 'Open Second ARC' })
    await user.selectOptions(screen.getByRole('combobox', { name: 'Sort by' }), 'title-ASC')
    await waitFor(() => expect(fetchProjects.mock.calls.at(-1)![1]).toMatchObject({ orderBy: 'name', sort: 'asc', page: 1 }))
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
    await user.click(screen.getByRole('link', { name: 'Next Page' }))
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
    await user.click(screen.getByRole('link', { name: 'Next Page' }))
    await screen.findByRole('button', { name: 'Open Second ARC' })
    await user.click(selector.getByRole('button', { name: 'Most Starred' }))
    await screen.findByRole('button', { name: 'Open First ARC' })
    expect(fetchProjects.mock.calls.at(-1)![1]).toMatchObject({
      membership: undefined, page: 1, search: 'plants', orderBy: 'star_count', sort: 'desc',
    })
    expect(selector.getAllByRole('button', { pressed: true })).toHaveLength(1)
    expect(selector.getByRole('button', { name: 'Most Starred' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByRole('combobox', { name: 'Sort by' })).not.toBeInTheDocument()
    expect(screen.getByText('Sorted by most starred')).toBeVisible()
    await user.click(selector.getByRole('button', { name: 'All' }))
    await screen.findByRole('button', { name: 'Open First ARC' })
    expect(fetchProjects.mock.calls.at(-1)![1]).toMatchObject({
      membership: undefined, page: 1, search: 'plants', orderBy: 'updated_at', sort: 'desc',
    })
    expect(selector.getAllByRole('button', { pressed: true })).toHaveLength(1)
    expect(selector.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true')
  })

  it.each(['Your', 'Starred', 'Most Starred'])('keeps %s repositories and organisation filtering mutually exclusive', async label => {
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
      membership: label === 'Your' ? true : undefined, starred: label === 'Starred' ? true : undefined,
      orderBy: label === 'Most Starred' ? 'star_count' : 'updated_at', page: 1,
    })
    await user.click(screen.getByRole('button', { name: 'Browse research/plants on PLANTdataHUB (official)' }))
    await screen.findByRole('button', { name: 'Open Second ARC' })
    await user.click(selector.getByRole('button', { name: 'All' }))
    await screen.findByRole('button', { name: 'Open First ARC' })
    expect(fetchProjects.mock.calls.at(-1)![1]).toMatchObject({ membership: undefined, orderBy: 'updated_at', sort: 'desc' })
    expect(screen.queryByRole('button', { name: 'Remove filter Group: research/plants' })).not.toBeInTheDocument()
  })

  it.each(['Your', 'Starred'])('requires login on the selected hub for %s repositories and lets users return to All', async label => {
    const fetchProjects = vi.fn<DashboardConfiguration['fetchProjects']>(async () => Success(arcPage([first])))
    const user = userEvent.setup()
    setup({ fetchProjects }, { [otherHub.id]: 'other-token' })
    await screen.findByRole('button', { name: 'Open First ARC' })
    await user.click(screen.getByRole('button', { name: label }))
    expect(await screen.findByText('Log in to PLANTdataHUB (official) to see your ' + (label === 'Starred' ? 'starred ' : '') + 'repositories.')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Open First ARC' })).not.toBeInTheDocument()
    expect(fetchProjects).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole('button', { name: 'Remove filter ' + label + ' repositories' }))
    await screen.findByRole('button', { name: 'Open First ARC' })
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true')
    expect(fetchProjects.mock.calls.at(-1)![1]).toMatchObject({ orderBy: 'updated_at', visibility: 'public' })
  })

  it.each(['Your', 'Starred'])('keeps an expired %s request from falling back to public repositories', async label => {
    const fetchProjects = vi.fn<DashboardConfiguration['fetchProjects']>(async (_source, options) =>
      options?.membership || options?.starred ? Failure(AUTH_FAILED_MESSAGE) : Success(arcPage([first])))
    const user = userEvent.setup()
    setup({ fetchProjects }, { [plantdatahub.id]: 'expired-token' })
    await screen.findByRole('button', { name: 'Open First ARC' })
    await user.click(screen.getByRole('button', { name: label }))
    expect(await screen.findByText(AUTH_FAILED_MESSAGE)).toBeVisible()
    expect(fetchProjects).toHaveBeenCalledTimes(2)
    expect(fetchProjects.mock.calls.at(-1)![1]).toMatchObject({
      membership: label === 'Your' ? true : undefined, starred: label === 'Starred' ? true : undefined, token: 'expired-token',
    })
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

  it('filters starred repositories on the server while preserving search and recent activity and resetting the page', async () => {
    const fetchProjects = vi.fn<DashboardConfiguration['fetchProjects']>(async (_source, options) =>
      Success(arcPage(options?.starred ? [second] : [first], {
        page: options?.page ?? 1, perPage: 25, nextPage: 2, total: 26,
      })))
    const user = userEvent.setup()
    setup({ fetchProjects }, { [plantdatahub.id]: 'runtime-token' })
    await screen.findByRole('button', { name: 'Open First ARC' })
    await user.type(screen.getByRole('searchbox', { name: 'Search ARCs' }), 'plants{Enter}')
    await screen.findByRole('button', { name: 'Open First ARC' })
    await user.click(screen.getByRole('button', { name: 'Only recently changed ARCs' }))
    await screen.findByRole('button', { name: 'Open First ARC' })
    await user.click(screen.getByRole('link', { name: 'Next Page' }))
    await screen.findByRole('button', { name: 'Open First ARC' })
    await user.click(screen.getByRole('button', { name: 'Starred' }))
    await screen.findByRole('button', { name: 'Open Second ARC' })
    expect(fetchProjects.mock.calls.at(-1)![1]).toMatchObject({
      starred: true, membership: undefined, page: 1, perPage: 25, search: 'plants',
      lastActivityAfter: '2026-09-14T12:00:00.000Z', orderBy: 'updated_at', sort: 'desc', token: 'runtime-token',
    })
    expect(screen.getByRole('button', { name: 'Starred' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByRole('button', { name: 'Open First ARC' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Clear all' }))
    await screen.findByRole('button', { name: 'Open First ARC' })
    expect(fetchProjects.mock.calls.at(-1)![1]).toMatchObject({ starred: undefined, search: undefined, lastActivityAfter: undefined })
  })

  it('stars and unstars with the selected hub’s account, updates the count and does not open the ARC', async () => {
    const pending = deferred<Result<GitLabProject>>()
    const setProjectStarred = vi.fn<DashboardConfiguration['setProjectStarred']>()
      .mockReturnValueOnce(pending.promise).mockResolvedValue(Success(gitLabProjectFull({ star_count: 42 })))
    const user = userEvent.setup()
    const { onArcClick } = setup({
      fetchProjects: async () => Success(arcPage([first])), setProjectStarred,
    }, { [plantdatahub.id]: 'runtime-token' })
    const star = await screen.findByRole('button', { name: 'Star First ARC (42 stars)' })
    await waitFor(() => expect(star).toBeEnabled())
    expect(star).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Open First ARC' })).not.toContainElement(star)
    await user.click(star)
    expect(star).toBeDisabled()
    expect(star).toHaveAttribute('aria-busy', 'true')
    expect(setProjectStarred).toHaveBeenCalledWith(plantdatahub.url, first.id, true,
      expect.objectContaining({ token: 'runtime-token', signal: expect.any(AbortSignal) }))
    await act(async () => pending.resolve(Success(gitLabProjectFull({ star_count: 43 }))))
    const unstar = await screen.findByRole('button', { name: 'Unstar First ARC (43 stars)' })
    expect(unstar).toHaveAttribute('aria-pressed', 'true')
    expect(unstar).toBeEnabled()
    await user.click(unstar)
    expect(await screen.findByRole('button', { name: 'Star First ARC (42 stars)' })).toHaveAttribute('aria-pressed', 'false')
    expect(setProjectStarred.mock.calls.at(-1)!.slice(0, 3)).toEqual([plantdatahub.url, first.id, false])
    expect(onArcClick).not.toHaveBeenCalled()
  })

  it('shows the signed-in user’s existing stars and keeps stars isolated when switching DataHUBs', async () => {
    const fetchStarredProjectIds = vi.fn<DashboardConfiguration['fetchStarredProjectIds']>(async source =>
      Success(source === plantdatahub.url ? [first.id] : []))
    const setProjectStarred = vi.fn<DashboardConfiguration['setProjectStarred']>(async () =>
      Success(gitLabProjectFull({ star_count: 43 })))
    const user = userEvent.setup()
    setup({ fetchProjects: async () => Success(arcPage([first])), fetchStarredProjectIds, setProjectStarred },
      { [plantdatahub.id]: 'official-token', [otherHub.id]: 'other-token' })
    expect(await screen.findByRole('button', { name: 'Unstar First ARC (42 stars)' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(screen.getByRole('button', { name: 'Other Hub: 3 ARCs' }))
    const star = await screen.findByRole('button', { name: 'Star First ARC (42 stars)' })
    await waitFor(() => expect(star).toBeEnabled())
    await user.click(star)
    expect(setProjectStarred).toHaveBeenCalledWith(otherHub.url, first.id, true, expect.objectContaining({ token: 'other-token' }))
    await user.click(screen.getByRole('button', { name: 'PLANTdataHUB (official): 3 ARCs' }))
    expect(await screen.findByRole('button', { name: 'Unstar First ARC (42 stars)' })).toBeEnabled()
  })

  it('disables stars when the selected hub has no signed-in user', async () => {
    const fetchStarredProjectIds = vi.fn<DashboardConfiguration['fetchStarredProjectIds']>(async () => Success([]))
    const setProjectStarred = vi.fn<DashboardConfiguration['setProjectStarred']>()
    const user = userEvent.setup()
    setup({ fetchProjects: async () => Success(arcPage([first])), fetchStarredProjectIds, setProjectStarred },
      { [otherHub.id]: 'other-token' })
    const star = await screen.findByRole('button', { name: 'Star First ARC (42 stars)' })
    expect(star).toBeDisabled()
    await user.click(star)
    expect(fetchStarredProjectIds).not.toHaveBeenCalled()
    expect(setProjectStarred).not.toHaveBeenCalled()
  })

  it('keeps the previous count and state after a failed star change and allows another attempt', async () => {
    const setProjectStarred = vi.fn<DashboardConfiguration['setProjectStarred']>()
      .mockResolvedValueOnce(Failure('GitLab request failed (403): Insufficient scope'))
      .mockResolvedValue(Success(gitLabProjectFull({ star_count: 43 })))
    const user = userEvent.setup()
    setup({ fetchProjects: async () => Success(arcPage([first])), setProjectStarred }, { [plantdatahub.id]: 'read-token' })
    const star = await screen.findByRole('button', { name: 'Star First ARC (42 stars)' })
    await waitFor(() => expect(star).toBeEnabled())
    await user.click(star)
    expect(await screen.findByRole('alert')).toHaveTextContent('Insufficient scope')
    expect(star).toHaveTextContent('42')
    expect(star).toHaveAttribute('aria-pressed', 'false')
    expect(star).toBeEnabled()
    await user.click(star)
    expect(await screen.findByRole('button', { name: 'Unstar First ARC (43 stars)' })).toBeEnabled()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('disables stars until their state loads and allows retry after a load failure', async () => {
    const pending = deferred<Result<number[]>>()
    const fetchStarredProjectIds = vi.fn<DashboardConfiguration['fetchStarredProjectIds']>()
      .mockReturnValueOnce(pending.promise).mockResolvedValue(Success([first.id]))
    const user = userEvent.setup()
    setup({ fetchProjects: async () => Success(arcPage([first])), fetchStarredProjectIds }, { [plantdatahub.id]: 'runtime-token' })
    expect(await screen.findByRole('button', { name: 'Star First ARC (42 stars)' })).toBeDisabled()
    await act(async () => pending.resolve(Failure('Offline')))
    expect(screen.getByRole('button', { name: 'Star First ARC (42 stars)' })).toBeDisabled()
    await user.click(await screen.findByRole('button', { name: 'Retry stars' }))
    expect(await screen.findByRole('button', { name: 'Unstar First ARC (42 stars)' })).toBeEnabled()
  })

  it.each(['All', 'Starred', 'Most Starred'])('keeps %s results in place after changing a star so it can be undone without refetching', async label => {
    const fetchProjects = vi.fn<DashboardConfiguration['fetchProjects']>(async () => Success(arcPage([first])))
    const fetchStarredProjectIds = vi.fn<DashboardConfiguration['fetchStarredProjectIds']>(async () => Success([first.id]))
    const setProjectStarred = vi.fn<DashboardConfiguration['setProjectStarred']>(async (_source, _id, starred) =>
      Success(gitLabProjectFull({ star_count: starred ? 42 : 41 })))
    const user = userEvent.setup()
    setup({ fetchProjects, fetchStarredProjectIds, setProjectStarred },
      { [plantdatahub.id]: 'runtime-token' })
    await screen.findByRole('button', { name: 'Open First ARC' })
    await user.click(screen.getByRole('button', { name: label }))
    await screen.findByRole('button', { name: 'Open First ARC' })
    const pageLoads = fetchProjects.mock.calls.length
    const starLoads = fetchStarredProjectIds.mock.calls.length
    await user.click(screen.getByRole('button', { name: 'Unstar First ARC (42 stars)' }))
    const star = await screen.findByRole('button', { name: 'Star First ARC (41 stars)' })
    expect(screen.getByRole('button', { name: 'Open First ARC' })).toBeVisible()
    await user.click(star)
    expect(await screen.findByRole('button', { name: 'Unstar First ARC (42 stars)' })).toBeEnabled()
    expect(fetchProjects).toHaveBeenCalledTimes(pageLoads)
    expect(fetchStarredProjectIds).toHaveBeenCalledTimes(starLoads)
    expect(setProjectStarred.mock.calls.map(call => call[2])).toEqual([false, true])
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
    const fetchProjects = vi.fn<DashboardConfiguration['fetchProjects']>(async (_source, options) =>
      Success(arcPage(options?.page === 2 ? [second] : [first], {
        page: options?.page ?? 1, perPage: 25, nextPage: options?.page === 2 ? null : 2,
        previousPage: options?.page === 2 ? 1 : null, total: null,
      })))
    const user = userEvent.setup()
    setup({ fetchProjects })
    await screen.findByRole('button', { name: 'Open First ARC' })
    expect(screen.getByRole('status')).toHaveTextContent('Showing 1 ARCs on this page')
    const pagination = within(screen.getByRole('navigation', { name: 'ARC pages' }))
    expect(pagination.getByRole('link', { name: 'Next Page' })).toBeVisible()
    expect(pagination.getByText('Previous')).toHaveAttribute('aria-disabled', 'true')
    expect(pagination.queryByRole('link', { name: 'Page 2' })).not.toBeInTheDocument()
    expect(fetchProjects).toHaveBeenCalledTimes(1)
    await user.click(pagination.getByRole('link', { name: 'Next Page' }))
    await screen.findByRole('button', { name: 'Open Second ARC' })
    const lastPage = within(screen.getByRole('navigation', { name: 'ARC pages' }))
    expect(lastPage.getByText('Next')).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByText('Page 2')).toBeVisible()
    await user.click(lastPage.getByRole('link', { name: 'Previous Page' }))
    await screen.findByRole('button', { name: 'Open First ARC' })
    expect(fetchProjects).toHaveBeenCalledTimes(3)
  })

  it('uses Primer numbered pages when the DataHUB supplies a page count', async () => {
    const fetchProjects = vi.fn<DashboardConfiguration['fetchProjects']>(async (_source, options) =>
      Success(arcPage(options?.page === 3 ? [second] : [first], {
        page: options?.page ?? 1, perPage: 25, total: 51, totalPages: 3,
        nextPage: options?.page === 3 ? null : (options?.page ?? 1) + 1,
        previousPage: (options?.page ?? 1) > 1 ? options!.page! - 1 : null,
      })))
    const user = userEvent.setup()
    setup({ fetchProjects })
    await screen.findByRole('button', { name: 'Open First ARC' })
    const pagination = within(screen.getByRole('navigation', { name: 'ARC pages' }))
    expect(pagination.getByRole('link', { name: 'Page 1' })).toHaveAttribute('aria-current', 'page')
    await user.click(pagination.getByRole('link', { name: 'Page 3' }))
    await screen.findByRole('button', { name: 'Open Second ARC' })
    const lastPage = within(screen.getByRole('navigation', { name: 'ARC pages' }))
    expect(lastPage.getByRole('link', { name: 'Page 3' })).toHaveAttribute('aria-current', 'page')
    expect(lastPage.getByText('Next')).toHaveAttribute('aria-disabled', 'true')
    expect(fetchProjects.mock.calls.at(-1)![1]).toMatchObject({ page: 3, perPage: 25 })
    expect(fetchProjects).toHaveBeenCalledTimes(2)
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

  it('opens the dashboard from list content and keeps external links in the actions menu', async () => {
    const user = userEvent.setup()
    const { onArcClick } = setup({ fetchProjects: async () => Success(arcPage([first])) })
    const open = await screen.findByRole('button', { name: 'Open First ARC' })
    expect(screen.queryByRole('menuitem', { name: 'View on PLANTdataHUB (official)' })).not.toBeInTheDocument()
    await user.click(within(open).getByText(first.description!))
    expect(onArcClick).toHaveBeenCalledWith(first.web_url, first.name, first.id, plantdatahub)
    onArcClick.mockClear()
    open.focus()
    await user.keyboard('{Enter}')
    expect(onArcClick).toHaveBeenCalledOnce()
    onArcClick.mockClear()
    await user.keyboard(' ')
    expect(onArcClick).toHaveBeenCalledOnce()
    onArcClick.mockClear()
    await user.click(screen.getByRole('button', { name: 'More actions for First ARC' }))
    const external = await screen.findByRole('menuitem', { name: 'View on PLANTdataHUB (official)' })
    expect(external).toHaveAttribute('href', first.web_url)
    expect(external).toHaveAttribute('target', '_blank')
    expect(external).toHaveAttribute('rel', 'noopener noreferrer')
    await user.click(external)
    expect(onArcClick).not.toHaveBeenCalled()
  })
})
