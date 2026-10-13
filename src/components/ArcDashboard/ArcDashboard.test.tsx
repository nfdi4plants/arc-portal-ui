import { act, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { deferred, renderWithTheme } from '../../test/helpers.tsx'
import ArcDashboard from './ArcDashboard.tsx'
import { crateJson } from '../../../tests/helpers/sampleCrate.ts'

vi.mock('./ArcViewer/ArcViewer.tsx', () => ({ default: () => <div>ARC viewer</div> }))

beforeEach(() => vi.spyOn(console, 'log').mockImplementation(() => {}))

describe('ArcDashboard', () => {
  it('shows loading followed by the loaded dashboard without a context provider', async () => {
    const pending = deferred<Response>()
    const onBack = vi.fn()
    const user = userEvent.setup()
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockReturnValue(pending.promise))
    renderWithTheme(<ArcDashboard name="Selected ARC" url="https://datahub.example/lab/arc"
      source="https://datahub.example" projectId={42} onBack={onBack} />)

    expect(screen.getByText('Loading…')).toBeVisible()
    expect(screen.queryByText(/Arc Dashboard: Selected ARC/)).not.toBeInTheDocument()
    expect(screen.queryByText('ARC viewer')).not.toBeInTheDocument()
    await act(async () => pending.resolve(new Response(crateJson)))
    expect(screen.getByText(/Arc Dashboard: Selected ARC/)).toBeVisible()
    expect(screen.getByRole('link', { name: 'Link' })).toHaveAttribute('href', 'https://datahub.example/lab/arc')
    expect(await screen.findByText('ARC viewer')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(onBack).toHaveBeenCalledOnce()
  })

  it('shows a simple error when the generated export is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(new Response('Not found', { status: 404 })))
    renderWithTheme(<ArcDashboard name="Selected ARC" url="https://datahub.example/lab/arc"
      source="https://datahub.example" projectId={42} onBack={vi.fn()} />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load ARC.')
    expect(screen.queryByText(/Arc Dashboard: Selected ARC/)).not.toBeInTheDocument()
    expect(screen.queryByText('ARC viewer')).not.toBeInTheDocument()
  })

  it('shows parsing errors without mounting the loaded dashboard', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(new Response('not json')))
    renderWithTheme(<ArcDashboard name="Selected ARC" url="https://datahub.example/lab/arc"
      source="https://datahub.example" projectId={42} onBack={vi.fn()} />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load ARC.')
    expect(screen.queryByText(/Arc Dashboard: Selected ARC/)).not.toBeInTheDocument()
    expect(screen.queryByText('ARC viewer')).not.toBeInTheDocument()
  })
})
