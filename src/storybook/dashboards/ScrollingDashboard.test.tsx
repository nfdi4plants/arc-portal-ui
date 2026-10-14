import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import '../../test/nativeDialog'
import { crateJson, sampleCrateSource } from '../../../tests/helpers/sampleCrate'
import { ArcProvider } from '../../arc/ArcProvider'
import { createArcStore } from '../../arc/arcStore'
import { renderWithTheme } from '../../test/helpers'
import { ArcDashboardFrame } from '../../components/ArcDashboard/ArcDashboardFrame'
import story from './ScrollingDashboard.stories'

vi.mock('@nfdi4plants/arc-web-view', () => ({ WebViewer: () => <label>Search ARC files<input /></label> }))

async function openDashboard() {
  const store = createArcStore(sampleCrateSource())
  await store.load()
  renderWithTheme(<ArcProvider store={store}><ArcDashboardFrame content={story.args.content} label={story.args.label} arcJson={crateJson} /></ArcProvider>)
  await screen.findByRole('textbox', { name: 'Search ARC files' }, { timeout: 5000 })
}

describe('ScrollingDashboard', () => {
  it('jumps and moves focus between the viewers while preserving file input', async () => {
    await openDashboard()
    const user = userEvent.setup()
    const webview = screen.getByRole('region', { name: 'Webview section' })
    const graphview = screen.getByRole('region', { name: 'Graphview section' })
    // jsdom has no scroll implementation; exercise the jump controls and their focus behavior.
    webview.scrollIntoView = vi.fn()
    graphview.scrollIntoView = vi.fn()
    await user.type(screen.getByRole('textbox'), 'assays')
    await user.click(screen.getByRole('button', { name: 'Jump to Graphview' }))
    expect(graphview.scrollIntoView).toHaveBeenCalledWith({ block: 'start', behavior: 'smooth' })
    expect(graphview).toHaveFocus()
    expect(within(graphview).getByRole('region', { name: 'Provenance explorer' })).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Jump to Webview' }))
    expect(webview.scrollIntoView).toHaveBeenCalledWith({ block: 'start', behavior: 'smooth' })
    expect(webview).toHaveFocus()
    expect(screen.getByRole('textbox')).toHaveValue('assays')
    expect(screen.getByRole('button', { name: 'Investigation' })).toBeVisible()
  }, 15000)

  it('expands each viewer and restores it with its contents intact', async () => {
    await openDashboard()
    const user = userEvent.setup()
    await user.type(screen.getByRole('textbox'), 'studies')
    await user.click(screen.getByRole('button', { name: 'Expand Webview' }))
    expect(within(screen.getByRole('dialog', { name: 'Webview' })).getByRole('textbox')).toHaveValue('studies')
    await user.click(screen.getByRole('button', { name: 'Shrink Webview' }))
    await user.click(screen.getByRole('button', { name: 'Expand Graphview' }))
    expect(within(screen.getByRole('dialog', { name: 'Graphview' })).getByRole('region', { name: 'Provenance explorer' })).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Shrink Graphview' }))
    expect(screen.getByRole('textbox')).toHaveValue('studies')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  }, 15000)
})
