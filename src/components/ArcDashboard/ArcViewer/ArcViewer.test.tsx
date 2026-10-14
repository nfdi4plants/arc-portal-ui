import { act, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { deferred, renderWithTheme } from '../../../test/helpers.tsx'
import { crateJson } from '../../../../tests/helpers/sampleCrate.ts'
import ArcViewer from './ArcViewer.tsx'

// The real viewer is large; these tests cover ArcViewer's own loading states.
vi.mock('@nfdi4plants/arc-web-view', () => ({ WebViewer: () => <div>Web viewer</div> }))
vi.mock('./gitlabDownloads', () => ({ attachGitlabDownloads: vi.fn() }))

beforeEach(() => {
  if (!window.matchMedia) vi.stubGlobal('matchMedia', (query: string) => ({ matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn() }))
})
afterEach(() => vi.unstubAllGlobals())

describe('ArcViewer', () => {
  it('shows the ARC mage while the bundled ARC loads, then the viewer', async () => {
    const pending = deferred<Response>()
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockReturnValue(pending.promise))
    renderWithTheme(<ArcViewer />)

    expect(screen.getByRole('status')).toHaveTextContent('Loading ARC…')
    expect(screen.queryByRole('heading', { name: 'Loading ARC…' })).not.toBeInTheDocument()
    await act(async () => pending.resolve(new Response(crateJson)))
    expect(await screen.findByText('Web viewer')).toBeVisible()
    expect(screen.queryByText('Loading ARC…')).not.toBeInTheDocument()
  })

  it('replaces the ARC mage with an error when the bundled ARC is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(new Response('Not found', { status: 404 })))
    renderWithTheme(<ArcViewer />)

    expect(await screen.findByRole('alert')).toHaveTextContent('HTTP 404')
    expect(screen.getByRole('heading', { name: 'ARC unavailable' })).toBeVisible()
    expect(screen.queryByText('Loading ARC…')).not.toBeInTheDocument()
  })
})
