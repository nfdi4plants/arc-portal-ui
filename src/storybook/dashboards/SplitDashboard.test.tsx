import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import '../../test/nativeDialog'
import { crateJson, sampleCrateSource } from '../../../tests/helpers/sampleCrate'
import { ArcProvider } from '../../arc/ArcProvider'
import { createArcStore } from '../../arc/arcStore'
import { renderWithTheme } from '../../test/helpers'
import { ArcDashboardFrame } from '../../components/ArcDashboard/ArcDashboardFrame'
import story from './SplitDashboard.stories'
import scrollingStory from './ScrollingSplitDashboard.stories'
import { loadFileSizes } from '../../components/ArcDashboard/ArcViewer/fileSizes'
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

async function openDashboard(content = story.args.content) {
  const store = createArcStore(sampleCrateSource())
  await store.load()
  renderWithTheme(<ArcProvider store={store}><ArcDashboardFrame content={content} label={story.args.label} fillHeight={story.args.fillHeight} repository={{ source: 'https://gitlab.example', projectPath: 'research/talinum' }} token="test-token" arcJson={crateJson} /></ArcProvider>)
  await screen.findByRole('textbox', { name: 'Search ARC files' }, { timeout: 5000 })
}

describe.each([
  ['SplitDashboard', story.args.content],
  ['ScrollingSplitDashboard', scrollingStory.args.content],
])('%s', (_name, content) => {
  it('shows both viewers and opens investigation details from the compact toolbar', async () => {
    await openDashboard(content)
    expect(screen.getByRole('heading', { level: 1, name: 'Facultative CAM in Talinum triangulare' })).toBeVisible()
    expect(screen.getByRole('region', { name: 'Provenance explorer' })).toBeVisible()
    expect(screen.getByRole('separator')).toHaveAttribute('aria-valuenow', '40')
    expect(await screen.findByRole('link', { name: 'Download README.md from GitLab' })).toHaveAttribute('href', 'https://gitlab.example/research/talinum/-/raw/HEAD/README.md?inline=false')
    expect(await screen.findByRole('cell', { name: '2.0 KiB' })).toBeVisible()
    expect(loadFileSizes).toHaveBeenCalledWith('https://gitlab.example/research/talinum', expect.any(AbortSignal), 'test-token', expect.any(Function))
    expect(screen.getByRole('region', { name: 'ARCade' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Expand ARCade' })).toBeVisible()
    const toolbar = screen.getByRole('navigation', { name: 'Investigation dashlets' })
    expect(within(toolbar).getAllByRole('heading', { level: 2 }).map(heading => heading.textContent))
      .toEqual(['Description', 'Contacts (12)', 'Organizations (4)', 'Publications (2)', 'Assays (3)', 'Studies (2)', 'Runs (6)', 'Workflows (6)'])
    const user = userEvent.setup()
    await user.click(within(toolbar).getByRole('button', { name: 'Expand Contacts (12)' }))
    expect(within(screen.getByRole('dialog', { name: 'Contacts (12)' })).getAllByRole('listitem')).toHaveLength(12)
    await user.click(screen.getByRole('button', { name: 'Shrink Contacts (12)' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  }, 15000)

  it('collapses either viewer, preserves file input, and can open a popup from a collapsed viewer', async () => {
    await openDashboard(content)
    const user = userEvent.setup()
    await user.type(screen.getByRole('textbox', { name: 'Search ARC files' }), 'assays')
    await user.click(screen.getByRole('button', { name: 'Collapse Webview' }))
    expect(screen.getByLabelText('Search ARC files')).not.toBeVisible()
    expect(screen.getByRole('region', { name: 'Provenance explorer' })).toBeVisible()
    expect(screen.getByRole('separator')).toHaveAttribute('aria-disabled', 'true')
    await user.click(screen.getByRole('button', { name: 'Expand Webview' }))
    expect(within(screen.getByRole('dialog', { name: 'Webview' })).getByRole('textbox')).toHaveValue('assays')
    await user.click(screen.getByRole('button', { name: 'Shrink Webview' }))
    expect(screen.getByLabelText('Search ARC files')).not.toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Restore Webview' }))
    expect(screen.getByRole('textbox')).toHaveValue('assays')
    await user.click(screen.getByRole('button', { name: 'Collapse Graphview' }))
    expect(screen.getByRole('region', { name: 'Provenance explorer', hidden: true })).not.toBeVisible()
    expect(screen.getByRole('textbox')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Restore Graphview' }))
    expect(screen.getByRole('region', { name: 'Provenance explorer' })).toBeVisible()
    expect(screen.getByRole('separator')).not.toHaveAttribute('aria-disabled')
  }, 15000)

  it('resizes with the keyboard and restores the chosen ratio after collapsing a viewer', async () => {
    await openDashboard(content)
    const user = userEvent.setup()
    const divider = screen.getByRole('separator', { name: 'Resize Graphview and Webview' })
    divider.focus()
    await user.keyboard('{ArrowDown}{ArrowDown}')
    expect(divider).toHaveAttribute('aria-valuenow', '50')
    await user.click(screen.getByRole('button', { name: 'Collapse Webview' }))
    await user.click(screen.getByRole('button', { name: 'Restore Webview' }))
    expect(divider).toHaveAttribute('aria-valuenow', '50')
    divider.focus()
    await user.keyboard('{ArrowUp}')
    expect(divider).toHaveAttribute('aria-valuenow', '45')
  }, 15000)
})
