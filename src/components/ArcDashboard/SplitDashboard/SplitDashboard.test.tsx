import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import '../../../test/nativeDialog'
import { crateJson, sampleCrateSource } from '../../../../tests/helpers/sampleCrate'
import { ArcProvider } from '../../../arc/ArcProvider'
import { createArcStore } from '../../../arc/arcStore'
import { renderWithTheme } from '../../../test/helpers'
import { SplitDashboard } from './SplitDashboard'

vi.mock('@nfdi4plants/arc-web-view', () => ({ WebViewer: () => <label>Search ARC files<input /></label> }))

async function openDashboard() {
  const store = createArcStore(sampleCrateSource())
  await store.load()
  renderWithTheme(<ArcProvider store={store}><SplitDashboard arcJson={crateJson} /></ArcProvider>)
  await screen.findByRole('textbox', { name: 'Search ARC files' })
}

describe('SplitDashboard', () => {
  it('shows both viewers and opens investigation details from the compact toolbar', async () => {
    await openDashboard()
    expect(screen.getByRole('heading', { level: 1, name: 'Facultative CAM in Talinum triangulare' })).toBeVisible()
    expect(screen.getByRole('region', { name: 'Provenance explorer' })).toBeVisible()
    expect(screen.getByRole('separator')).toHaveAttribute('aria-valuenow', '60')
    const toolbar = screen.getByRole('navigation', { name: 'Investigation dashlets' })
    expect(within(toolbar).getAllByRole('heading', { level: 2 }).map(heading => heading.textContent))
      .toEqual(['Description', 'Contacts', 'Organizations', 'Publications', 'Assays', 'Studies'])
    const user = userEvent.setup()
    await user.click(within(toolbar).getByRole('button', { name: 'Expand Contacts' }))
    expect(within(screen.getByRole('dialog', { name: 'Contacts' })).getAllByRole('listitem')).toHaveLength(12)
    await user.click(screen.getByRole('button', { name: 'Shrink Contacts' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  }, 15000)

  it('collapses either viewer, preserves file input, and can open a popup from a collapsed viewer', async () => {
    await openDashboard()
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
    await openDashboard()
    const user = userEvent.setup()
    const divider = screen.getByRole('separator', { name: 'Resize Webview and Graphview' })
    divider.focus()
    await user.keyboard('{ArrowDown}{ArrowDown}')
    expect(divider).toHaveAttribute('aria-valuenow', '70')
    await user.click(screen.getByRole('button', { name: 'Collapse Webview' }))
    await user.click(screen.getByRole('button', { name: 'Restore Webview' }))
    expect(divider).toHaveAttribute('aria-valuenow', '70')
    divider.focus()
    await user.keyboard('{ArrowUp}')
    expect(divider).toHaveAttribute('aria-valuenow', '65')
  }, 15000)

  it('shows loading before the ARC is available', () => {
    const store = createArcStore(sampleCrateSource())
    renderWithTheme(<ArcProvider store={store}><SplitDashboard arcJson={crateJson} /></ArcProvider>)
    expect(screen.getByRole('status')).toHaveTextContent('Loading ARC')
    expect(screen.queryByRole('separator')).not.toBeInTheDocument()
  })

  it('shows the ARC load failure', async () => {
    const source = sampleCrateSource()
    const store = createArcStore({ ...source, fetchROCrate: async () => { throw new Error('Unable to load RO-Crate (404).') } })
    await store.load()
    renderWithTheme(<ArcProvider store={store}><SplitDashboard arcJson={crateJson} /></ArcProvider>)
    expect(screen.getByText('Could not load ARC')).toBeVisible()
    expect(screen.getByText('Unable to load RO-Crate (404).')).toBeVisible()
  })
})
