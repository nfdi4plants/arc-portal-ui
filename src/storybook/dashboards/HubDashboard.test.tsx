import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import '../../test/nativeDialog'
import { crateJson, sampleCrateSource } from '../../../tests/helpers/sampleCrate'
import { ArcProvider } from '../../arc/ArcProvider'
import { createArcStore } from '../../arc/arcStore'
import { renderWithTheme } from '../../test/helpers'
import { publicTalinumDataHubData, talinumRepository } from '../fixtures/talinumArc'
import { ArcDashboardFrame } from '../../components/ArcDashboard/ArcDashboardFrame'
import story from './HubDashboard.stories'

vi.mock('@nfdi4plants/arc-web-view', () => ({ WebViewer: () => <label>Search ARC files<input /></label> }))

async function openDashboard() {
  const store = createArcStore(sampleCrateSource())
  await store.load()
  renderWithTheme(<ArcProvider store={store}><ArcDashboardFrame content={story.args.content} label={story.args.label} fillHeight={story.args.fillHeight} arcJson={crateJson} repository={talinumRepository} dataHubData={publicTalinumDataHubData} /></ArcProvider>)
  await screen.findByRole('textbox', { name: 'Search ARC files' }, { timeout: 5000 })
}

describe('HubDashboard', () => {
  it('shows the ARC header, six metadata cards, and both viewers', async () => {
    await openDashboard()
    expect(screen.getByRole('heading', { level: 1, name: 'Facultative CAM in Talinum triangulare' })).toBeVisible()
    expect(screen.getByRole('navigation', { name: 'DataHub links' })).toBeVisible()
    expect(screen.getByRole('navigation', { name: 'ARC release' })).toBeVisible()
    expect(screen.getByRole('img', { name: 'Public ARC' })).toBeVisible()
    expect(screen.getByRole('complementary', { name: 'ARC ownership and visibility' })).toBeVisible()
    const left = screen.getByRole('navigation', { name: 'Description, contacts, and organizations' })
    const right = screen.getByRole('navigation', { name: 'Publications, assays, and studies' })
    expect(within(left).getAllByRole('heading', { level: 2 }).map(heading => heading.textContent)).toEqual(['Description', 'Contacts', 'Organizations'])
    expect(within(right).getAllByRole('heading', { level: 2 }).map(heading => heading.textContent)).toEqual(['Publications', 'Assays', 'Studies'])
    expect(screen.getByRole('region', { name: 'Provenance explorer' })).toBeVisible()
    expect(screen.getByRole('separator')).toHaveAttribute('aria-valuenow', '60')
    expect(screen.getByRole('region', { name: 'ARCade' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Expand ARCade' })).toBeVisible()
  })

  it('opens metadata and viewer popups without losing viewer input or the selected split', async () => {
    await openDashboard()
    const user = userEvent.setup()
    await user.type(screen.getByRole('textbox', { name: 'Search ARC files' }), 'assays')
    const divider = screen.getByRole('separator')
    divider.focus()
    await user.keyboard('{ArrowDown}')
    expect(divider).toHaveAttribute('aria-valuenow', '65')
    await user.click(screen.getByRole('button', { name: 'Expand Contacts' }))
    expect(within(screen.getByRole('dialog', { name: 'Contacts' })).getAllByRole('listitem')).toHaveLength(12)
    await user.click(screen.getByRole('button', { name: 'Shrink Contacts' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Expand Webview' }))
    expect(within(screen.getByRole('dialog', { name: 'Webview' })).getByRole('textbox')).toHaveValue('assays')
    await user.click(screen.getByRole('button', { name: 'Shrink Webview' }))
    await user.click(screen.getByRole('button', { name: 'Expand Graphview' }))
    expect(within(screen.getByRole('dialog', { name: 'Graphview' })).getByRole('region', { name: 'Provenance explorer' })).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Shrink Graphview' }))
    expect(screen.getByRole('textbox')).toHaveValue('assays')
    expect(divider).toHaveAttribute('aria-valuenow', '65')
  }, 15000)
})
