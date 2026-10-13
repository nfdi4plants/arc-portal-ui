import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import '../../../test/nativeDialog'
import { crateJson, sampleCrateSource } from '../../../../tests/helpers/sampleCrate'
import { ArcProvider } from '../../../arc/ArcProvider'
import { createArcStore } from '../../../arc/arcStore'
import { renderWithTheme } from '../../../test/helpers'
import { TabbedDashboard } from './TabbedDashboard'

vi.mock('@nfdi4plants/arc-web-view', () => ({ WebViewer: () => <label>Search ARC files<input /></label> }))
async function openDashboard() {
  const store = createArcStore(sampleCrateSource())
  await store.load()
  renderWithTheme(<ArcProvider store={store}><TabbedDashboard arcJson={crateJson} /></ArcProvider>)
  await screen.findByRole('textbox', { name: 'Search ARC files' })
}

describe('TabbedDashboard', () => {
  it('starts in Webview and preserves file input and the comparison ratio when switching tabs', async () => {
    await openDashboard()
    const user = userEvent.setup()
    expect(screen.getByRole('tab', { name: 'Webview' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.queryByRole('region', { name: 'Provenance explorer' })).not.toBeInTheDocument()
    await user.type(screen.getByRole('textbox'), 'assays')
    await user.click(screen.getByRole('tab', { name: 'Graphview' }))
    expect(screen.getByRole('region', { name: 'Provenance explorer' })).toBeVisible()
    expect(screen.getByLabelText('Search ARC files')).not.toBeVisible()
    await user.click(screen.getByRole('tab', { name: 'Compare' }))
    expect(screen.getByRole('textbox')).toHaveValue('assays')
    const divider = screen.getByRole('separator')
    expect(divider).toHaveAttribute('aria-valuenow', '60')
    divider.focus()
    await user.keyboard('{ArrowDown}')
    await user.click(screen.getByRole('tab', { name: 'Webview' }))
    expect(screen.queryByRole('separator')).not.toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: 'Compare' }))
    expect(screen.getByRole('separator')).toHaveAttribute('aria-valuenow', '65')
  }, 15000)

  it('supports keyboard tab navigation', async () => {
    await openDashboard()
    const user = userEvent.setup()
    screen.getByRole('tab', { name: 'Webview' }).focus()
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'Graphview' })).toHaveFocus()
    expect(screen.getByRole('tab', { name: 'Graphview' })).toHaveAttribute('aria-selected', 'true')
    await user.keyboard('{End}')
    expect(screen.getByRole('tab', { name: 'Compare' })).toHaveFocus()
    await user.keyboard('{Home}')
    expect(screen.getByRole('tab', { name: 'Webview' })).toHaveFocus()
  }, 15000)

  it('opens investigation popup dashlets from the menu and returns focus to its trigger', async () => {
    await openDashboard()
    const user = userEvent.setup()
    const investigation = screen.getByRole('button', { name: 'Investigation' })
    await user.click(investigation)
    expect(screen.getAllByRole('menuitem')).toHaveLength(6)
    await user.click(screen.getByRole('menuitem', { name: 'Contacts' }))
    const popup = screen.getByRole('dialog', { name: 'Contacts' })
    expect(within(popup).getAllByRole('listitem')).toHaveLength(12)
    await user.click(within(popup).getByRole('button', { name: 'Shrink Contacts' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(investigation).toHaveFocus()
    await user.click(investigation)
    await user.click(screen.getByRole('menuitem', { name: 'Studies' }))
    expect(screen.getByRole('dialog', { name: 'Studies' })).toBeVisible()
  }, 15000)

  it('shows loading before the ARC is available', () => {
    const store = createArcStore(sampleCrateSource())
    renderWithTheme(<ArcProvider store={store}><TabbedDashboard arcJson={crateJson} /></ArcProvider>)
    expect(screen.getByRole('status')).toHaveTextContent('Loading ARC')
  })

  it('shows the ARC load failure', async () => {
    const source = sampleCrateSource()
    const store = createArcStore({ ...source, fetchROCrate: async () => { throw new Error('Unable to load RO-Crate (404).') } })
    await store.load()
    renderWithTheme(<ArcProvider store={store}><TabbedDashboard arcJson={crateJson} /></ArcProvider>)
    expect(screen.getByText('Could not load ARC')).toBeVisible()
    expect(screen.getByText('Unable to load RO-Crate (404).')).toBeVisible()
  })
})
