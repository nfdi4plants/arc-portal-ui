import { Failure } from '../../types/result.ts'
import { act, fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { arcResult, project, renderWithTheme } from '../../test/helpers.tsx'
import DataHubDashboard, { type DataHubDashboardProps } from './DataHubDashboard.tsx'
import { defaultDataHub } from '../../config/gitlab.ts'

afterEach(() => vi.useRealTimers())

describe('DataHubDashboard', () => {
  it('lets each callback control its data and loading duration independently', async () => {
    vi.useFakeTimers()
    const fetchTopStarred = vi.fn<DataHubDashboardProps['fetchTopStarred']>().mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 5_000))
      return arcResult([project({ name: 'Top ARC' })])
    })
    const fetchSearch = vi.fn<DataHubDashboardProps['fetchSearch']>().mockImplementation(async (_source, _query, { page = 1 } = {}) => {
      await new Promise(resolve => setTimeout(resolve, 1_000))
      return arcResult([project({ name: `Search page ${page} ARC` })], {
        page, nextPage: page === 1 ? 2 : null, previousPage: page === 1 ? null : 1,
      })
    })
    renderWithTheme(<DataHubDashboard fetchTopStarred={fetchTopStarred} fetchSearch={fetchSearch} />)
    expect(screen.getByText('Loading most-starred ARCs…')).toBeVisible()
    expect(fetchSearch).not.toHaveBeenCalled()
    fireEvent.change(screen.getByRole('textbox', { name: 'Search term' }), { target: { value: '  plants  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Search' }))
    expect(screen.getByText('Searching ARCs…')).toBeVisible()
    expect(fetchTopStarred).toHaveBeenCalledWith(defaultDataHub.url, { page: 1, perPage: 10, signal: expect.any(AbortSignal), token: undefined })
    expect(fetchSearch).toHaveBeenCalledWith(defaultDataHub.url, 'plants', { page: 1, perPage: 10, signal: expect.any(AbortSignal), token: undefined })

    await act(async () => vi.advanceTimersByTimeAsync(1_000))
    expect(within(screen.getByRole('list', { name: 'ARC search results' })).getByRole('link', { name: 'Search page 1 ARC' })).toBeVisible()
    expect(screen.getByText('Loading most-starred ARCs…')).toBeVisible()
    await act(async () => vi.advanceTimersByTimeAsync(4_000))
    expect(within(screen.getByRole('list', { name: 'Most-starred ARCs' })).getByRole('link', { name: 'Top ARC' })).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(fetchSearch).toHaveBeenLastCalledWith(defaultDataHub.url, 'plants', { page: 2, perPage: 10, signal: expect.any(AbortSignal), token: undefined })
    expect(fetchTopStarred).toHaveBeenCalledTimes(1)
    await act(async () => vi.advanceTimersByTimeAsync(1_000))
    expect(screen.getByRole('link', { name: 'Search page 2 ARC' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
  })

  it('retries a failed callback without refetching the other section', async () => {
    const fetchTopStarred = vi.fn<DataHubDashboardProps['fetchTopStarred']>().mockResolvedValueOnce(Failure('Top service unavailable'))
      .mockResolvedValueOnce(arcResult([project({ name: 'Recovered ARC' })]))
    const fetchSearch = vi.fn<DataHubDashboardProps['fetchSearch']>().mockResolvedValue(arcResult([project({ name: 'Found ARC' })]))
    const user = userEvent.setup()
    renderWithTheme(<DataHubDashboard fetchTopStarred={fetchTopStarred} fetchSearch={fetchSearch} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Top service unavailable')
    await user.type(screen.getByRole('textbox'), 'plants{Enter}')
    expect(await screen.findByRole('link', { name: 'Found ARC' })).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Retry most-starred ARCs' }))
    expect(await screen.findByRole('link', { name: 'Recovered ARC' })).toBeVisible()
    expect(fetchTopStarred).toHaveBeenCalledTimes(2)
    expect(fetchSearch).toHaveBeenCalledTimes(1)
  })
})
