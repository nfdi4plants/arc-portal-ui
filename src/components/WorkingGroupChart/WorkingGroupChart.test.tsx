import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import DataHubDashboard from '../DataHubDashboard/DataHubDashboard.tsx'
import type { DashboardConfiguration } from '../DataHubDashboard/configuration.ts'
import { FAVORITE_GROUPS_KEY } from '../DataHubDashboard/hooks/useFavoriteGroups.ts'
import { dashboardWrapper, deferred, fakeDashboardConfiguration, plantdatahub } from '../../test/helpers.tsx'
import { Failure, Success, type Result } from '../../types/result.ts'

const otherHub = { id: 'other', name: 'Other Hub', url: 'https://other.example' }
const groups = [
  { id: 1, name: 'Alpha', full_path: 'research/alpha' },
  { id: 2, name: 'Beta', full_path: 'beta' },
  { id: 3, name: 'Gamma', full_path: 'gamma' },
]
const now = () => new Date('2026-10-14T12:00:00Z')

beforeEach(() => localStorage.clear())

function setup(overrides: Partial<DashboardConfiguration> = {}, tokens: Record<string, string> = {}) {
  const configuration = fakeDashboardConfiguration({
    fetchGroups: async (_source, options) => Success(options?.allAvailable ? groups : groups.slice(0, 2)), ...overrides,
  })
  const rendered = render(<DataHubDashboard onArcClick={vi.fn()} now={now} />, {
    wrapper: dashboardWrapper(configuration, tokens),
  })
  return { configuration, ...rendered }
}

describe('group lists', () => {
  it('searches groups and saves favorites without any group-count requests in All groups', async () => {
    const fetchGroupProjectCount = vi.fn<DashboardConfiguration['fetchGroupProjectCount']>(async () => Success(5))
    const fetchGroups = vi.fn<DashboardConfiguration['fetchGroups']>(async () => Success(groups))
    const user = userEvent.setup()
    const { unmount } = setup({ fetchGroupProjectCount, fetchGroups })
    const panel = within(await screen.findByRole('list', { name: 'All groups' }))
    await panel.findByRole('button', { name: 'Browse beta on PLANTdataHUB (official)' })
    expect(panel.getAllByRole('button', { name: /^Browse/ }).map(button => button.textContent))
      .toEqual(['Alpharesearch/alpha · PLANTdataHUB (official)', 'Betabeta · PLANTdataHUB (official)', 'Gammagamma · PLANTdataHUB (official)'])
    await user.click(panel.getByRole('button', { name: 'Favorite beta on PLANTdataHUB (official)' }))
    expect(panel.getAllByRole('button', { name: /^Browse/ })[0]).toHaveAccessibleName('Browse beta on PLANTdataHUB (official)')
    await user.type(screen.getByRole('searchbox', { name: 'Search groups' }), 'research')
    expect(panel.getAllByRole('button', { name: /^Browse/ })).toHaveLength(1)
    expect(fetchGroups).toHaveBeenCalledTimes(1)
    expect(fetchGroupProjectCount).not.toHaveBeenCalled()
    expect(JSON.parse(localStorage.getItem(FAVORITE_GROUPS_KEY)!)).toEqual(['plantdatahub/2'])
    await user.selectOptions(screen.getByRole('combobox', { name: 'Group lists' }), 'my')
    expect(screen.getByText('Log in to see your groups.')).toBeVisible()
    await user.selectOptions(screen.getByRole('combobox', { name: 'Group lists' }), 'all')
    expect(panel.getAllByRole('button', { name: /^Browse/ })).toHaveLength(1)
    unmount()
    setup({ fetchGroupProjectCount })
    const nextPanel = within(await screen.findByRole('list', { name: 'All groups' }))
    await nextPanel.findByRole('button', { name: 'Unfavorite beta on PLANTdataHUB (official)' })
    expect(nextPanel.getAllByRole('button', { name: /^Browse/ })[0]).toHaveAccessibleName('Browse beta on PLANTdataHUB (official)')
    expect(fetchGroupProjectCount).not.toHaveBeenCalled()
  })

  it('loads every member group count once and retains them through search, favorites and list switches', async () => {
    const fetchGroupProjectCount = vi.fn<DashboardConfiguration['fetchGroupProjectCount']>(async () => Success(5))
    const user = userEvent.setup()
    setup({ fetchGroupProjectCount }, { [plantdatahub.id]: 'token' })
    await waitFor(() => expect(fetchGroupProjectCount).toHaveBeenCalledTimes(2))
    const selector = screen.getByRole('combobox', { name: 'Group lists' })
    expect(selector).toHaveValue('my')
    expect(await screen.findByLabelText('research/alpha: 5 repositories')).toHaveTextContent('5')
    await user.type(screen.getByRole('searchbox', { name: 'Search groups' }), 'alpha')
    await user.clear(screen.getByRole('searchbox', { name: 'Search groups' }))
    await user.click(screen.getByRole('button', { name: 'Favorite beta on PLANTdataHUB (official)' }))
    await user.selectOptions(selector, 'all')
    expect(within(screen.getByRole('list', { name: 'All groups' })).queryByLabelText(/repositories/)).not.toBeInTheDocument()
    await user.selectOptions(selector, 'my')
    const mine = within(screen.getByRole('list', { name: 'My groups' }))
    expect(mine.getAllByRole('button', { name: /^Browse/ })[0]).toHaveAccessibleName('Browse beta on PLANTdataHUB (official)')
    expect(mine.getByLabelText('research/alpha: 5 repositories')).toHaveTextContent('5')
    expect(fetchGroupProjectCount).toHaveBeenCalledTimes(2)
    await user.click(screen.getByRole('button', { name: 'Update' }))
    await waitFor(() => expect(fetchGroupProjectCount).toHaveBeenCalledTimes(4))
  })

  it('shows loading, zero and capped counts without moving groups when counts arrive', async () => {
    const count = deferred<Result<number | null>>()
    const fetchGroupProjectCount = vi.fn<DashboardConfiguration['fetchGroupProjectCount']>(async (_source, id) =>
      id === 1 ? count.promise : Success(0))
    setup({ fetchGroupProjectCount }, { [plantdatahub.id]: 'token' })
    const loading = await screen.findByLabelText('research/alpha: Loading count')
    expect(loading).toHaveAttribute('aria-busy', 'true')
    expect(loading).toHaveTextContent('…')
    expect(await screen.findByLabelText('beta: 0 repositories')).toHaveTextContent('0')
    await act(async () => count.resolve(Success(10_000)))
    const capped = await screen.findByLabelText('research/alpha: 10,000+ repositories')
    expect(capped).toHaveTextContent('10,000+')
    expect(capped).not.toHaveAttribute('aria-busy')
    expect(within(screen.getByRole('list', { name: 'My groups' })).getAllByRole('button', { name: /^Browse/ })
      .map(button => button.getAttribute('aria-label'))).toEqual([
      'Browse research/alpha on PLANTdataHUB (official)', 'Browse beta on PLANTdataHUB (official)',
    ])
  })

  it('keeps duplicate group IDs on different hubs separate', async () => {
    const fetchGroupProjectCount = vi.fn<DashboardConfiguration['fetchGroupProjectCount']>(async () => Success(5))
    setup({ dataHubs: [plantdatahub, otherHub], fetchGroupProjectCount,
      fetchGroups: async () => Success([groups[0]]) }, { [plantdatahub.id]: 'token-a', other: 'token-b' })
    await waitFor(() => expect(fetchGroupProjectCount).toHaveBeenCalledTimes(2))
    expect(fetchGroupProjectCount).toHaveBeenCalledWith(plantdatahub.url, 1, expect.objectContaining({ token: 'token-a' }))
    expect(fetchGroupProjectCount).toHaveBeenCalledWith(otherHub.url, 1, expect.objectContaining({ token: 'token-b' }))
  })

  it('handles count failures with retry and shows unknown counts without loading forever', async () => {
    const fetchGroupProjectCount = vi.fn<DashboardConfiguration['fetchGroupProjectCount']>()
      .mockResolvedValueOnce(Failure('Offline')).mockResolvedValue(Success(null))
    const user = userEvent.setup()
    setup({ fetchGroupProjectCount, fetchGroups: async () => Success([groups[0]]) }, { [plantdatahub.id]: 'token' })
    await user.click(await screen.findByRole('button', { name: 'Retry count for research/alpha on PLANTdataHUB (official)' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: /Retry count/ })).not.toBeInTheDocument())
    expect(screen.getByLabelText('research/alpha: Count unavailable')).not.toHaveAttribute('aria-busy')
    expect(fetchGroupProjectCount).toHaveBeenCalledTimes(2)
  })

  it('pages All groups locally and leaves favorites usable when storage is unavailable', async () => {
    const catalogue = Array.from({ length: 55 }, (_, id) => ({ id: id + 1, name: 'Group ' + String(id).padStart(2, '0'), full_path: 'group-' + id }))
    const fetchGroups = vi.fn<DashboardConfiguration['fetchGroups']>(async () => Success(catalogue))
    const user = userEvent.setup()
    setup({ fetchGroups })
    const pagination = within(await screen.findByRole('navigation', { name: 'Group pages' }))
    expect(pagination.getByRole('link', { name: 'Page 1' })).toHaveAttribute('aria-current', 'page')
    expect(pagination.queryByRole('link', { name: 'Previous Page' })).not.toBeInTheDocument()
    await user.click(pagination.getByRole('link', { name: 'Next Page' }))
    expect(screen.getAllByRole('button', { name: /^Browse/ })).toHaveLength(25)
    expect(pagination.getByRole('link', { name: 'Page 2' })).toHaveAttribute('aria-current', 'page')
    await user.click(pagination.getByRole('link', { name: 'Page 3' }))
    expect(screen.getAllByRole('button', { name: /^Browse/ })).toHaveLength(5)
    expect(screen.getByRole('button', { name: 'Browse group-50 on PLANTdataHUB (official)' })).toBeVisible()
    expect(pagination.queryByRole('link', { name: 'Next Page' })).not.toBeInTheDocument()
    await user.click(pagination.getByRole('link', { name: 'Previous Page' }))
    expect(fetchGroups).toHaveBeenCalledTimes(1)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Blocked') })
    await user.click(screen.getByRole('button', { name: 'Favorite group-25 on PLANTdataHUB (official)' }))
    expect(screen.getByRole('button', { name: 'Unfavorite group-25 on PLANTdataHUB (official)' })).toBeVisible()
    expect(pagination.getByRole('link', { name: 'Page 1' })).toHaveAttribute('aria-current', 'page')
    await user.click(pagination.getByRole('link', { name: 'Page 3' }))
    await user.type(screen.getByRole('searchbox', { name: 'Search groups' }), 'group-54')
    expect(screen.getAllByRole('button', { name: /^Browse/ })).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Browse group-54 on PLANTdataHUB (official)' })).toBeVisible()
    expect(screen.queryByRole('navigation', { name: 'Group pages' })).not.toBeInTheDocument()
    expect(fetchGroups).toHaveBeenCalledTimes(1)
  })

  it('reports group catalogue failures and retries only the failing hub', async () => {
    const fetchGroups = vi.fn<DashboardConfiguration['fetchGroups']>()
      .mockResolvedValueOnce(Failure('Offline')).mockResolvedValue(Success(groups))
    const user = userEvent.setup()
    setup({ fetchGroups })
    await user.click(await screen.findByRole('button', { name: 'Retry groups for PLANTdataHUB (official)' }))
    expect(await screen.findByRole('button', { name: 'Browse beta on PLANTdataHUB (official)' })).toBeVisible()
    expect(fetchGroups).toHaveBeenCalledTimes(2)
  })
})
