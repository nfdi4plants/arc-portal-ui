import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Failure, Success } from '../../types/result.ts'
import type { FetchGroupArcs, FetchGroups } from '../../types/organisation.ts'
import { arcResult, project, renderWithTheme } from '../../test/helpers.tsx'
import { OrganisationBrowser } from './OrganisationBrowser.tsx'

const groups = [
  { id: 1, name: 'Plants', full_path: 'research/plants' },
  { id: 2, name: 'Trees', full_path: 'research/trees' },
]

describe('organisation browsing', () => {
  it('paginates repositories, resets pages on selection, and displays empty results', async () => {
    const fetchPublicGroups = vi.fn<FetchGroups>().mockResolvedValue(Success(groups))
    const fetchGroupProjects = vi.fn<FetchGroupArcs>().mockImplementation(async (id, { page = 1 } = {}) => arcResult(
      id === 1 ? [project({ name: `Plants page ${page}` })] : [],
      { page, nextPage: id === 1 && page === 1 ? 2 : null, previousPage: page > 1 ? page - 1 : null },
    ))
    const user = userEvent.setup()
    renderWithTheme(<OrganisationBrowser fetchPublicGroups={fetchPublicGroups} fetchMembershipGroups={null} fetchGroupProjects={fetchGroupProjects} />)
    await screen.findByRole('option', { name: 'research/plants' })
    expect(fetchGroupProjects).not.toHaveBeenCalled()
    await user.selectOptions(screen.getByRole('combobox'), '1')
    expect(await screen.findByRole('link', { name: 'Plants page 1' })).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(await screen.findByRole('link', { name: 'Plants page 2' })).toBeVisible()
    expect(fetchGroupProjects).toHaveBeenLastCalledWith(1, { page: 2, perPage: 10, signal: expect.any(AbortSignal) })
    await user.selectOptions(screen.getByRole('combobox'), '2')
    expect(await screen.findByText('No repositories found on this page.')).toBeVisible()
    expect(fetchGroupProjects).toHaveBeenLastCalledWith(2, { page: 1, perPage: 10, signal: expect.any(AbortSignal) })
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled()
    expect(fetchPublicGroups).toHaveBeenCalledTimes(1)
  })

  it('keeps public groups available when membership discovery fails and retries membership independently', async () => {
    const fetchPublicGroups = vi.fn<FetchGroups>().mockResolvedValue(Success(groups))
    const fetchMembershipGroups = vi.fn<FetchGroups>().mockResolvedValueOnce(Failure('Membership unavailable'))
      .mockResolvedValueOnce(Success([groups[0]]))
    const fetchGroupProjects = vi.fn<FetchGroupArcs>().mockResolvedValue(arcResult())
    const user = userEvent.setup()
    renderWithTheme(<OrganisationBrowser {...{ fetchPublicGroups, fetchMembershipGroups, fetchGroupProjects }} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Membership unavailable')
    const selector = screen.getByRole('combobox')
    expect(within(selector).getByRole('group', { name: 'Public organisations' })).toHaveTextContent('research/plants')
    await user.selectOptions(selector, '2')
    expect(await screen.findByRole('list', { name: 'Organisation repositories' })).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Retry your organisations' }))
    expect(await within(selector).findByRole('group', { name: 'Your organisations' })).toHaveTextContent('research/plants')
    expect(within(selector).getByRole('group', { name: 'Other public organisations' })).toHaveTextContent('research/trees')
    expect(within(selector).getAllByRole('option', { name: 'research/plants' })).toHaveLength(1)
    expect(fetchPublicGroups).toHaveBeenCalledTimes(1)
  })

  it('retries public discovery and repository failures and announces an empty catalogue', async () => {
    const fetchPublicGroups = vi.fn<FetchGroups>().mockResolvedValueOnce(Failure('Offline')).mockResolvedValueOnce(Success(groups))
    const fetchGroupProjects = vi.fn<FetchGroupArcs>().mockResolvedValueOnce(Failure('Repositories unavailable')).mockResolvedValueOnce(arcResult())
    const user = userEvent.setup()
    const view = renderWithTheme(<OrganisationBrowser fetchPublicGroups={fetchPublicGroups} fetchMembershipGroups={null} fetchGroupProjects={fetchGroupProjects} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Offline')
    await user.click(screen.getByRole('button', { name: 'Retry public organisations' }))
    await screen.findByRole('option', { name: 'research/plants' })
    await user.selectOptions(screen.getByRole('combobox'), '1')
    expect(await screen.findByRole('alert')).toHaveTextContent('Repositories unavailable')
    await user.click(screen.getByRole('button', { name: 'Retry organisation repositories' }))
    expect(await screen.findByRole('list', { name: 'Organisation repositories' })).toBeVisible()
    view.unmount()
    renderWithTheme(<OrganisationBrowser fetchPublicGroups={async () => Success([])} fetchMembershipGroups={null} fetchGroupProjects={fetchGroupProjects} />)
    expect(await screen.findByText('No organisations found.')).toBeVisible()
    expect(screen.getByRole('combobox')).toBeDisabled()
  })
})
