import { screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { crateJson, sampleCrateSource } from '../../../tests/helpers/sampleCrate'
import { ArcProvider } from '../../arc/ArcProvider'
import { createArcStore } from '../../arc/arcStore'
import { renderWithTheme } from '../../test/helpers'
import { ArcDashboardFrame } from '../../components/ArcDashboard/ArcDashboardFrame'
import story from './StackedDashboard.stories'

vi.mock('@nfdi4plants/arc-web-view', () => ({ WebViewer: () => <p>ARC contents preview</p> }))

describe('StackedDashboard', () => {
  it('shows the ARC header, all seven card titles, and a separate interactive Graphview', async () => {
    const store = createArcStore(sampleCrateSource())
    await store.load()
    renderWithTheme(
      <ArcProvider store={store}>
        <ArcDashboardFrame content={story.args.content} label={story.args.label} fillHeight={story.args.fillHeight} arcJson={crateJson} repository={{ source: 'https://gitlab.example', projectPath: 'research/talinum' }} />
      </ArcProvider>,
    )
    const dashboard = screen.getByRole('region', { name: 'StackedDashboard' })
    expect(within(dashboard).getByRole('heading', { level: 1, name: 'Facultative CAM in Talinum triangulare' })).toBeVisible()
    expect(within(dashboard).getByRole('link', { name: 'research/talinum' })).toHaveAttribute('href', 'https://gitlab.example/research/talinum')
    const cards = screen.getByRole('complementary', { name: 'Investigation dashlets' })
    const titles = ['Description', 'Contacts', 'Organizations', 'Publications', 'Assays', 'Studies', 'Webview', 'ARCade']
    expect(within(cards).getAllByRole('heading', { level: 2 }).map(heading => heading.textContent)).toEqual(titles)
    for (const title of titles) expect(within(cards).getByRole('button', { name: `Expand ${title}` })).toBeVisible()
    expect(within(screen.getByRole('region', { name: 'Graphview' })).getByRole('region', { name: 'Provenance explorer' })).toBeVisible()
    expect(within(cards).queryByRole('region', { name: 'Graphview' })).not.toBeInTheDocument()
    expect(within(dashboard).queryByRole('tab', { name: 'Overview' })).not.toBeInTheDocument()
    expect(await screen.findByText('ARC contents preview', {}, { timeout: 5000 })).not.toBeVisible()
    expect(within(cards).getByRole('img', { name: 'Webview symbol' })).toBeVisible()
    expect(within(cards).getByRole('region', { name: 'ARCade' })).toBeInTheDocument()
  })
})
