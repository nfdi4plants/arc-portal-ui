import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ArcPage, FetchArcs } from '../../types/arc.ts'
import { arcPage, deferred, project, renderWithTheme } from '../../test/helpers.tsx'
import { TopStarredArcs } from './TopStarredArcs.tsx'

const fetchCall = vi.fn<FetchArcs>()

beforeEach(() => {
  fetchCall.mockReset()
  fetchCall.mockImplementation(async () => arcPage())
})

describe('TopStarredArcs', () => {
  it('announces loading and displays ARC data provided by its fetch callback', async () => {
    const pending = deferred<ArcPage>()
    fetchCall.mockReturnValue(pending.promise)
    renderWithTheme(<TopStarredArcs fetchCall={fetchCall} />)
    expect(screen.getByRole('status')).toHaveTextContent('Loading most-starred ARCs')
    const arcs = Array.from({ length: 10 }, (_, index) => project({
      id: index + 1, name: `Study ${index + 1}`, star_count: 10 - index, archived: index === 0,
    }))
    await act(async () => pending.resolve(arcPage(arcs)))
    const list = await screen.findByRole('list', { name: 'Most-starred ARCs' })
    expect(within(list).getAllByRole('listitem')).toHaveLength(10)
    expect(within(list).getAllByRole('link').map(link => link.textContent)).toEqual(arcs.map(arc => arc.name))
    expect(fetchCall).toHaveBeenCalledTimes(1)
    expect(fetchCall.mock.calls[0][0].aborted).toBe(false)
  })

  it('announces an empty result', async () => {
    fetchCall.mockResolvedValue(arcPage([]))
    renderWithTheme(<TopStarredArcs fetchCall={fetchCall} />)
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('No public ARCs found.'))
  })

  it('displays failures and retries the supplied callback', async () => {
    fetchCall.mockRejectedValueOnce(new Error('Service unavailable')).mockResolvedValueOnce(arcPage())
    const user = userEvent.setup()
    renderWithTheme(<TopStarredArcs fetchCall={fetchCall} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Service unavailable')
    await user.click(screen.getByRole('button', { name: 'Retry most-starred ARCs' }))
    expect(await screen.findByRole('link', { name: 'Arabidopsis study' })).toBeVisible()
    expect(fetchCall).toHaveBeenCalledTimes(2)
  })

  it('aborts a replaced fetch callback and ignores its late response', async () => {
    const oldRequest = deferred<ArcPage>()
    fetchCall.mockReturnValue(oldRequest.promise)
    const replacement = vi.fn<FetchArcs>().mockResolvedValue(arcPage([project({ name: 'Current ARC' })]))
    const view = renderWithTheme(<TopStarredArcs fetchCall={fetchCall} />)
    const oldSignal = fetchCall.mock.calls[0][0]
    view.rerender(<TopStarredArcs fetchCall={replacement} />)
    expect(oldSignal.aborted).toBe(true)
    expect(await screen.findByRole('link', { name: 'Current ARC' })).toBeVisible()
    await act(async () => oldRequest.resolve(arcPage([project({ name: 'Stale ARC' })])))
    expect(screen.queryByRole('link', { name: 'Stale ARC' })).not.toBeInTheDocument()
    expect(replacement).toHaveBeenCalledTimes(1)
  })

  it('aborts on unmount', () => {
    fetchCall.mockReturnValue(deferred<ArcPage>().promise)
    const view = renderWithTheme(<TopStarredArcs fetchCall={fetchCall} />)
    const signal = fetchCall.mock.calls[0][0]
    view.unmount()
    expect(signal.aborted).toBe(true)
  })

  it('survives StrictMode retiring its initial request', async () => {
    fetchCall.mockReturnValueOnce(deferred<ArcPage>().promise).mockResolvedValueOnce(arcPage())
    renderWithTheme(<TopStarredArcs fetchCall={fetchCall} />, true)
    expect(await screen.findByRole('link', { name: 'Arabidopsis study' })).toBeVisible()
    expect(fetchCall.mock.calls[0][0].aborted).toBe(true)
  })
})
