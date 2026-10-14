import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import DataHubDashboard from '../DataHubDashboard/DataHubDashboard.tsx'
import type { DashboardConfiguration } from '../DataHubDashboard/configuration.ts'
import { FAVORITE_GROUPS_KEY } from '../DataHubDashboard/hooks/useFavoriteGroups.ts'
import { dashboardWrapper, fakeDashboardConfiguration, plantdatahub } from '../../test/helpers.tsx'
import { Failure, Success } from '../../types/result.ts'

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
  it('searches alphabetically and saves favorites without any group-count requests in All groups', async () => {
    const fetchGroupProjectCount = vi.fn<DashboardConfiguration['fetchGroupProjectCount']>(async () => Success(5))
    const fetchGroups = vi.fn<DashboardConfiguration['fetchGroups']>(async () => Success(groups))
    const user = userEvent.setup()
    const { unmount } = setup({ fetchGroupProjectCount, fetchGroups })
    const panel = within(await screen.findByRole('tabpanel', { name: 'All groups' }))
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
    unmount()
    setup({ fetchGroupProjectCount })
    const nextPanel = within(await screen.findByRole('tabpanel', { name: 'All groups' }))
    await nextPanel.findByRole('button', { name: 'Unfavorite beta on PLANTdataHUB (official)' })
    expect(nextPanel.getAllByRole('button', { name: /^Browse/ })[0]).toHaveAccessibleName('Browse beta on PLANTdataHUB (official)')
    expect(fetchGroupProjectCount).not.toHaveBeenCalled()
  })

  it('loads every member group count once and retains them through search, favorites and tab switches', async () => {
    const fetchGroupProjectCount = vi.fn<DashboardConfiguration['fetchGroupProjectCount']>(async () => Success(5))
    const user = userEvent.setup()
    setup({ fetchGroupProjectCount }, { [plantdatahub.id]: 'token' })
    await waitFor(() => expect(fetchGroupProjectCount).toHaveBeenCalledTimes(2))
    expect(screen.getByRole('tab', { name: 'My groups' })).toHaveAttribute('aria-selected', 'true')
    await user.type(screen.getByRole('searchbox', { name: 'Search groups' }), 'alpha')
    await user.clear(screen.getByRole('searchbox', { name: 'Search groups' }))
    await user.click(screen.getByRole('button', { name: 'Favorite beta on PLANTdataHUB (official)' }))
    await user.click(screen.getByRole('tab', { name: 'All groups' }))
    expect(within(screen.getByRole('tabpanel', { name: 'All groups' })).queryByLabelText(/repositories/)).not.toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: 'My groups' }))
    expect(fetchGroupProjectCount).toHaveBeenCalledTimes(2)
    await user.click(screen.getByRole('button', { name: 'Update' }))
    await waitFor(() => expect(fetchGroupProjectCount).toHaveBeenCalledTimes(4))
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
    const catalogue = Array.from({ length: 30 }, (_, id) => ({ id: id + 1, name: 'Group ' + String(id).padStart(2, '0'), full_path: 'group-' + id }))
    const fetchGroups = vi.fn<DashboardConfiguration['fetchGroups']>(async () => Success(catalogue))
    const user = userEvent.setup()
    setup({ fetchGroups })
    await screen.findByRole('button', { name: 'Next groups' })
    await user.click(screen.getByRole('button', { name: 'Next groups' }))
    expect(screen.getAllByRole('button', { name: /^Browse/ })).toHaveLength(5)
    expect(fetchGroups).toHaveBeenCalledTimes(1)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Blocked') })
    await user.click(screen.getByRole('button', { name: 'Favorite group-25 on PLANTdataHUB (official)' }))
    expect(screen.getByRole('button', { name: 'Unfavorite group-25 on PLANTdataHUB (official)' })).toBeVisible()
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
