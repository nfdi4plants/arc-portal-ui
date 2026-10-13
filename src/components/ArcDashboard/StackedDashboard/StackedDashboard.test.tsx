import { screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { crateJson, sampleCrateSource } from '../../../../tests/helpers/sampleCrate'
import { ArcProvider } from '../../../arc/ArcProvider'
import { createArcStore } from '../../../arc/arcStore'
import { renderWithTheme } from '../../../test/helpers'
import { StackedDashboard } from './StackedDashboard'

vi.mock('@nfdi4plants/arc-web-view', () => ({ WebViewer: () => <p>ARC contents preview</p> }))

describe('StackedDashboard', () => {
  it('shows the ARC header, all seven card titles, and a separate interactive Graphview', async () => {
    const store = createArcStore(sampleCrateSource())
    await store.load()
    renderWithTheme(
      <ArcProvider store={store}>
        <StackedDashboard arcJson={crateJson} repository={{ source: 'https://gitlab.example', projectPath: 'research/talinum' }} />
      </ArcProvider>,
    )
    const dashboard = screen.getByRole('region', { name: 'StackedDashboard' })
    expect(within(dashboard).getByRole('heading', { level: 1, name: 'Facultative CAM in Talinum triangulare' })).toBeVisible()
    expect(within(dashboard).getByRole('link', { name: 'research/talinum' })).toHaveAttribute('href', 'https://gitlab.example/research/talinum')
    const cards = screen.getByRole('complementary', { name: 'Investigation dashlets' })
    const titles = ['Description', 'Contacts', 'Organizations', 'Publications', 'Assays', 'Studies', 'Webview']
    expect(within(cards).getAllByRole('heading', { level: 2 }).map(heading => heading.textContent)).toEqual(titles)
    for (const title of titles) expect(within(cards).getByRole('button', { name: `Expand ${title}` })).toBeVisible()
    expect(within(screen.getByRole('region', { name: 'Graphview' })).getByRole('region', { name: 'Provenance explorer' })).toBeVisible()
    expect(within(cards).queryByRole('region', { name: 'Graphview' })).not.toBeInTheDocument()
    expect(within(dashboard).queryByRole('tab', { name: 'Overview' })).not.toBeInTheDocument()
    expect(await screen.findByText('ARC contents preview', {}, { timeout: 5000 })).not.toBeVisible()
    expect(within(cards).getByRole('img', { name: 'Webview symbol' })).toBeVisible()
  })

  it('shows loading while an ARC is being opened', () => {
    const store = createArcStore(sampleCrateSource())
    renderWithTheme(<ArcProvider store={store}><StackedDashboard arcJson={crateJson} /></ArcProvider>)
    expect(screen.getByRole('status')).toHaveTextContent('Loading ARC')
    expect(screen.queryByRole('complementary', { name: 'Investigation dashlets' })).not.toBeInTheDocument()
  })

  it('shows a load error when the ARC export is unavailable', async () => {
    const source = sampleCrateSource()
    const store = createArcStore({ ...source, fetchROCrate: async () => { throw new Error('Unable to load RO-Crate (404).') } })
    await store.load()
    renderWithTheme(<ArcProvider store={store}><StackedDashboard arcJson={crateJson} /></ArcProvider>)
    expect(screen.getByText('Could not load ARC')).toBeVisible()
    expect(screen.getByText('Unable to load RO-Crate (404).')).toBeVisible()
    expect(screen.queryByRole('region', { name: 'Graphview' })).not.toBeInTheDocument()
  })
})
