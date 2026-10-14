import { act, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '../../test/nativeDialog.ts'
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

    expect(screen.getByRole('status')).toHaveTextContent('Loading ARC…')
    expect(screen.queryByText('Help me on my adventure!')).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'ARC-Dashboard' })).not.toBeInTheDocument()
    expect(screen.queryByText('ARC viewer')).not.toBeInTheDocument()
    await act(async () => pending.resolve(new Response(crateJson)))
    expect(screen.getByRole('heading', { level: 1, name: 'Facultative CAM in Talinum triangulare' })).toBeVisible()
    expect(screen.getByText('Help me on my adventure!')).toBeVisible()
    expect(screen.queryByText('Loading ARC…')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Expand Description' })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Selected ARC' })).toHaveAttribute('href', 'https://datahub.example/lab/arc')
    await user.click(screen.getByRole('button', { name: 'Expand Webview' }))
    expect(await screen.findByText('ARC viewer', {}, { timeout: 5000 })).toBeVisible()
    expect(viewer).toHaveBeenCalledWith({ jsonString: expect.stringContaining('Facultative CAM in Talinum triangulare'), embedded: true, repositoryUrl: "https://datahub.example/lab/arc", token: undefined })
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

  it('shows parsing errors without mounting the loaded dashboard', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(new Response('not json')))
    renderWithTheme(<ArcDashboard name="Selected ARC" url="https://datahub.example/lab/arc"
      source="https://datahub.example" projectId={42} onBack={vi.fn()} />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load ARC.')
    expect(screen.queryByRole('region', { name: 'ARC-Dashboard' })).not.toBeInTheDocument()
    expect(screen.queryByText('ARC viewer')).not.toBeInTheDocument()
  })

})
