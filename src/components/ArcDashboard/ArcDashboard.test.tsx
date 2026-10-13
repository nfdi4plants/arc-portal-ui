import { act, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { deferred, renderWithTheme } from '../../test/helpers.tsx'
import ArcDashboard from './ArcDashboard.tsx'
import { crateJson } from '../../../tests/helpers/sampleCrate.ts'

// The loaded dashboard now includes the asynchronous viewer and provenance graph.
vi.setConfig({ testTimeout: 15000 })

const viewer = vi.hoisted(() => vi.fn())
vi.mock('./ArcViewer/ArcViewer.tsx', () => ({ default: (props: { jsonString?: string; embedded?: boolean }) => {
  viewer(props)
  return <div>ARC viewer</div>
} }))

beforeEach(() => viewer.mockClear())

describe('ArcDashboard', () => {
  it('shows loading followed by the loaded dashboard without a context provider', async () => {
    const pending = deferred<Response>()
    const onBack = vi.fn()
    const user = userEvent.setup()
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockReturnValue(pending.promise))
    renderWithTheme(<ArcDashboard name="Selected ARC" url="https://datahub.example/lab/arc"
      source="https://datahub.example" projectId={42} onBack={onBack} />)

    expect(screen.getByText('Loading…')).toBeVisible()
    expect(screen.queryByRole('region', { name: 'ARC-Dashboard' })).not.toBeInTheDocument()
    expect(screen.queryByText('ARC viewer')).not.toBeInTheDocument()
    await act(async () => pending.resolve(new Response(crateJson)))
    expect(screen.getByRole('heading', { level: 1, name: 'Facultative CAM in Talinum triangulare' })).toBeVisible()
    expect(screen.getByRole('region', { name: 'Investigation details' })).toBeVisible()
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('link', { name: 'Selected ARC' })).toHaveAttribute('href', 'https://datahub.example/lab/arc')
    expect(await screen.findByText('ARC viewer', {}, { timeout: 5000 })).toBeVisible()
    expect(viewer).toHaveBeenCalledWith({ jsonString: expect.stringContaining('Facultative CAM in Talinum triangulare'), embedded: true })
    expect(fetch).toHaveBeenCalledOnce()
    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(onBack).toHaveBeenCalledOnce()
  })

  it('shows a simple error when the generated export is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(new Response('Not found', { status: 404 })))
    renderWithTheme(<ArcDashboard name="Selected ARC" url="https://datahub.example/lab/arc"
      source="https://datahub.example" projectId={42} onBack={vi.fn()} />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load ARC.')
    expect(screen.queryByRole('region', { name: 'ARC-Dashboard' })).not.toBeInTheDocument()
    expect(screen.queryByText('ARC viewer')).not.toBeInTheDocument()
  })

  it('opens NewDashboard and returns to the classic layout without reloading the ARC', async () => {
    const user = userEvent.setup()
    const onBack = vi.fn()
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(new Response(crateJson)))
    renderWithTheme(<ArcDashboard name="Selected ARC" url="https://datahub.example/lab/arc"
      source="https://datahub.example" projectId={42} onBack={onBack} />)

    await user.click(await screen.findByRole('button', { name: 'NewDashboard' }))
    expect(screen.getByRole('region', { name: 'Contacts dashlet' })).toBeVisible()
    expect(screen.getByRole('region', { name: 'Publications dashlet' })).toBeVisible()
    expect(screen.queryByRole('tab', { name: 'Overview' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Selected ARC' })).toHaveAttribute('href', 'https://datahub.example/lab/arc')
    expect(screen.getByRole('button', { name: 'Classic dashboard' })).toHaveAttribute('aria-pressed', 'true')

    await user.click(screen.getByRole('button', { name: 'Classic dashboard' }))
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true')
    expect(fetch).toHaveBeenCalledOnce()
    await user.click(screen.getByRole('button', { name: 'NewDashboard' }))
    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(onBack).toHaveBeenCalledOnce()
  })

  it('shows parsing errors without mounting the loaded dashboard', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(new Response('not json')))
    renderWithTheme(<ArcDashboard name="Selected ARC" url="https://datahub.example/lab/arc"
      source="https://datahub.example" projectId={42} onBack={vi.fn()} />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load ARC.')
    expect(screen.queryByRole('region', { name: 'ARC-Dashboard' })).not.toBeInTheDocument()
    expect(screen.queryByText('ARC viewer')).not.toBeInTheDocument()
  })

  it.each(['Stacked dashboard', 'Combined dashboard', 'Split dashboard'])('opens %s and switches back without fetching the ARC again', async (layout) => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(new Response(crateJson)))
    renderWithTheme(<ArcDashboard name="Selected ARC" url="https://datahub.example/lab/arc"
      source="https://datahub.example" projectId={42} onBack={vi.fn()} />)
    await user.click(await screen.findByRole('button', { name: layout }))
    if (layout === 'Stacked dashboard') expect(screen.getByRole('complementary', { name: 'Investigation dashlets' })).toBeVisible()
    else if (layout === 'Combined dashboard') expect(screen.getByRole('region', { name: 'Description, contacts, and organizations' })).toBeVisible()
    else expect(screen.getByRole('separator', { name: 'Resize Webview and Graphview' })).toBeVisible()
    expect(screen.getByRole('region', { name: 'Graphview' })).toBeVisible()
    expect(screen.getByRole('button', { name: layout })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('link', { name: 'Selected ARC' })).toHaveAttribute('href', 'https://datahub.example/lab/arc')
    await user.click(screen.getByRole('button', { name: 'Classic dashboard' }))
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true')
    expect(fetch).toHaveBeenCalledOnce()
  })
})
