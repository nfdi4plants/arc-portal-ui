import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ArcPage, SearchArcs } from '../../types/arc.ts'
import { arcPage, deferred, project, renderWithTheme } from '../../test/helpers.tsx'
import { ArcSearch } from './ArcSearch.tsx'

const fetchCall = vi.fn<SearchArcs>()

beforeEach(() => {
  fetchCall.mockReset()
  fetchCall.mockImplementation(async () => arcPage())
})

describe('ArcSearch', () => {
  it('starts idle, labels its controls and does not search while typing or on blank submissions', async () => {
    const user = userEvent.setup()
    renderWithTheme(<ArcSearch fetchCall={fetchCall} />)
    const input = screen.getByRole('textbox', { name: 'Search term' })
    expect(screen.getByRole('search', { name: 'Search ARCs' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Search' })).toBeDisabled()
    await user.type(input, '   {Enter}')
    expect(fetchCall).not.toHaveBeenCalled()
    await user.clear(input)
    await user.type(input, 'plants')
    expect(fetchCall).not.toHaveBeenCalled()
  })

  it.each(['Enter', 'button'])('passes the trimmed query to the callback via %s and displays its data', async method => {
    const user = userEvent.setup()
    renderWithTheme(<ArcSearch fetchCall={fetchCall} />)
    await user.type(screen.getByRole('textbox'), '  plant & growth  ')
    if (method === 'Enter') await user.keyboard('{Enter}')
    else await user.click(screen.getByRole('button', { name: 'Search' }))
    expect(await screen.findByRole('list', { name: 'ARC search results' })).toBeVisible()
    expect(screen.getByRole('status')).toHaveTextContent('1 results for “plant & growth” · Page 1')
    expect(fetchCall).toHaveBeenCalledWith('plant & growth', {
      page: 1, perPage: 10, signal: expect.any(AbortSignal),
    })
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
  })

  it('announces pending and empty search results', async () => {
    const pending = deferred<ArcPage>()
    fetchCall.mockReturnValue(pending.promise)
    const user = userEvent.setup()
    renderWithTheme(<ArcSearch fetchCall={fetchCall} />)
    await user.type(screen.getByRole('textbox'), 'missing{Enter}')
    expect(screen.getByRole('status')).toHaveTextContent('Searching ARCs')
    await act(async () => pending.resolve(arcPage([])))
    expect(screen.getByRole('status')).toHaveTextContent('No ARCs found for “missing” on page 1.')
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })

  it('shows callback failures and retries the submitted query, not the current draft', async () => {
    fetchCall.mockRejectedValueOnce(new Error('Offline')).mockResolvedValueOnce(arcPage())
    const user = userEvent.setup()
    renderWithTheme(<ArcSearch fetchCall={fetchCall} />)
    await user.type(screen.getByRole('textbox'), 'submitted{Enter}')
    expect(await screen.findByRole('alert')).toHaveTextContent('Offline')
    await user.clear(screen.getByRole('textbox'))
    await user.type(screen.getByRole('textbox'), 'draft')
    await user.click(screen.getByRole('button', { name: 'Retry search' }))
    expect(await screen.findByRole('list')).toBeVisible()
    expect(fetchCall.mock.calls.at(-1)![0]).toBe('submitted')
    expect(fetchCall).toHaveBeenCalledTimes(2)
  })

  it('paginates the submitted query and resets a new query to page one', async () => {
    fetchCall.mockImplementation(async (_query, { page }) => arcPage(
      [project({ name: `Page ${page} ARC` })],
      { page, nextPage: page === 1 ? 2 : null, previousPage: page === 1 ? null : 1 },
    ))
    const user = userEvent.setup()
    renderWithTheme(<ArcSearch fetchCall={fetchCall} />)
    await user.type(screen.getByRole('textbox'), 'plants{Enter}')
    expect(await screen.findByRole('link', { name: 'Page 1 ARC' })).toBeVisible()
    await user.clear(screen.getByRole('textbox'))
    await user.type(screen.getByRole('textbox'), 'new draft')
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(await screen.findByRole('link', { name: 'Page 2 ARC' })).toBeVisible()
    expect(fetchCall).toHaveBeenLastCalledWith('plants', {
      page: 2, perPage: 10, signal: expect.any(AbortSignal),
    })
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Previous' }))
    expect(await screen.findByRole('link', { name: 'Page 1 ARC' })).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(await screen.findByRole('link', { name: 'Page 2 ARC' })).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Search' }))
    expect(await screen.findByRole('link', { name: 'Page 1 ARC' })).toBeVisible()
    expect(fetchCall).toHaveBeenLastCalledWith('new draft', {
      page: 1, perPage: 10, signal: expect.any(AbortSignal),
    })
  })

  it('can return from an empty page using callback pagination metadata', async () => {
    const fullPage = Array.from({ length: 10 }, (_, index) => project({ id: index + 1, name: `Study ${index}` }))
    fetchCall.mockResolvedValueOnce(arcPage(fullPage, { nextPage: 2 }))
      .mockResolvedValueOnce(arcPage([], { page: 2, previousPage: 1 }))
      .mockResolvedValueOnce(arcPage(fullPage, { nextPage: 2 }))
    const user = userEvent.setup()
    renderWithTheme(<ArcSearch fetchCall={fetchCall} />)
    await user.type(screen.getByRole('textbox'), 'plants{Enter}')
    await screen.findByRole('list')
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('on page 2'))
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Previous' }))
    expect(await screen.findByRole('list')).toBeVisible()
    expect(fetchCall.mock.calls.at(-1)![1].page).toBe(1)
  })

  it('ignores a late response from an earlier submission', async () => {
    const oldRequest = deferred<ArcPage>()
    fetchCall.mockReturnValueOnce(oldRequest.promise).mockResolvedValueOnce(arcPage([project({ name: 'Latest ARC' })]))
    const user = userEvent.setup()
    renderWithTheme(<ArcSearch fetchCall={fetchCall} />)
    await user.type(screen.getByRole('textbox'), 'old{Enter}')
    const oldSignal = fetchCall.mock.calls[0][1].signal
    await user.clear(screen.getByRole('textbox'))
    await user.type(screen.getByRole('textbox'), 'latest{Enter}')
    expect(await screen.findByRole('link', { name: 'Latest ARC' })).toBeVisible()
    expect(oldSignal.aborted).toBe(true)
    await act(async () => oldRequest.resolve(arcPage([project({ name: 'Old ARC' })])))
    expect(screen.queryByRole('link', { name: 'Old ARC' })).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('“latest”')
  })

  it('retires a replaced callback and submits against its replacement', async () => {
    const oldRequest = deferred<ArcPage>()
    fetchCall.mockReturnValue(oldRequest.promise)
    const replacement = vi.fn<SearchArcs>().mockResolvedValue(arcPage([project({ name: 'Replacement ARC' })]))
    const user = userEvent.setup()
    const view = renderWithTheme(<ArcSearch fetchCall={fetchCall} />)
    await user.type(screen.getByRole('textbox'), 'plants{Enter}')
    const oldSignal = fetchCall.mock.calls[0][1].signal
    view.rerender(<ArcSearch fetchCall={replacement} />)
    expect(oldSignal.aborted).toBe(true)
    expect(screen.getByText('Enter a term to discover ARCs.')).toBeVisible()
    await act(async () => oldRequest.resolve(arcPage([project({ name: 'Old ARC' })])))
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Search' }))
    expect(await screen.findByRole('link', { name: 'Replacement ARC' })).toBeVisible()
    expect(replacement).toHaveBeenCalledWith('plants', {
      page: 1, perPage: 10, signal: expect.any(AbortSignal),
    })
  })

  it('cancels on unmount without presenting cancellation as an error', async () => {
    const pending = deferred<ArcPage>()
    fetchCall.mockReturnValue(pending.promise)
    const user = userEvent.setup()
    const view = renderWithTheme(<ArcSearch fetchCall={fetchCall} />)
    await user.type(screen.getByRole('textbox'), 'plants{Enter}')
    const signal = fetchCall.mock.calls[0][1].signal
    view.unmount()
    expect(signal.aborted).toBe(true)
    await act(async () => pending.reject(new DOMException('Canceled', 'AbortError')))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
