import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import '../../test/nativeDialog'
import { crateJson, sampleCrateSource } from '../../../tests/helpers/sampleCrate'
import { ArcProvider } from '../../arc/ArcProvider'
import { createArcStore } from '../../arc/arcStore'
import { renderWithTheme } from '../../test/helpers'
import { ArcDashboardFrame } from '../../components/ArcDashboard/ArcDashboardFrame'
import story from './TabbedDashboard.stories'
import type * as FileSizesModule from '../../components/ArcDashboard/ArcViewer/fileSizes'

vi.mock('../../components/ArcDashboard/ArcViewer/fileSizes', async (importOriginal) => ({
  ...await importOriginal<typeof FileSizesModule>(),
  loadFileSizes: vi.fn(async () => new Map([['README.md', 2048]])),
}))
vi.mock('@nfdi4plants/arc-web-view', () => ({ WebViewer: () => <>
  <label>Search ARC files<input /></label>
  <table>
    <thead><tr><th>Name</th><th>Path</th><th>File Size</th><th>Download</th></tr></thead>
    <tbody><tr><th><span aria-label="File" />README.md</th><td>README.md</td><td /><td /></tr></tbody>
  </table>
</> }))
async function openDashboard() {
  const store = createArcStore(sampleCrateSource())
  await store.load()
  renderWithTheme(<ArcProvider store={store}><ArcDashboardFrame content={story.args.content} label={story.args.label} fillHeight={story.args.fillHeight} repository={{ source: 'https://gitlab.example', projectPath: 'research/talinum' }} arcJson={crateJson} /></ArcProvider>)
  await screen.findByRole('region', { name: 'Provenance explorer' }, { timeout: 5000 })
}

describe('TabbedDashboard', () => {
  it('starts in Graphview and preserves file input and the comparison ratio when switching tabs', async () => {
    await openDashboard()
    const user = userEvent.setup()
    expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual(['Graphview', 'Webview', 'Compare'])
    expect(screen.getByRole('tab', { name: 'Graphview' })).toHaveAttribute('aria-selected', 'true')
    await user.click(screen.getByRole('tab', { name: 'Webview' }))
    const search = await screen.findByRole('textbox', { name: 'Search ARC files' }, { timeout: 5000 })
    expect(await screen.findByRole('link', { name: 'Download README.md from GitLab' })).toHaveAttribute('href', 'https://gitlab.example/research/talinum/-/raw/HEAD/README.md?inline=false')
    expect(await screen.findByRole('cell', { name: '2.0 KiB' })).toBeVisible()
    await user.type(search, 'assays')
    await user.click(screen.getByRole('tab', { name: 'Graphview' }))
    expect(screen.getByRole('region', { name: 'Provenance explorer' })).toBeVisible()
    expect(screen.getByLabelText('Search ARC files')).not.toBeVisible()
    await user.click(screen.getByRole('tab', { name: 'Compare' }))
    expect(screen.getByRole('textbox')).toHaveValue('assays')
    const divider = screen.getByRole('separator')
    expect(divider).toHaveAttribute('aria-valuenow', '40')
    divider.focus()
    await user.keyboard('{ArrowDown}')
    await user.click(screen.getByRole('tab', { name: 'Webview' }))
    expect(screen.queryByRole('separator')).not.toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: 'Compare' }))
    expect(screen.getByRole('separator')).toHaveAttribute('aria-valuenow', '45')
  }, 15000)

  it('supports keyboard tab navigation', async () => {
    await openDashboard()
    const user = userEvent.setup()
    screen.getByRole('tab', { name: 'Graphview' }).focus()
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'Webview' })).toHaveFocus()
    expect(screen.getByRole('tab', { name: 'Webview' })).toHaveAttribute('aria-selected', 'true')
    await user.keyboard('{End}')
    expect(screen.getByRole('tab', { name: 'Compare' })).toHaveFocus()
    await user.keyboard('{Home}')
    expect(screen.getByRole('tab', { name: 'Graphview' })).toHaveFocus()
  }, 15000)

})
