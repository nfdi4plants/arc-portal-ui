import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import '../../test/nativeDialog'
import { crateJson, sampleCrateSource } from '../../../tests/helpers/sampleCrate'
import { ArcProvider } from '../../arc/ArcProvider'
import { createArcStore } from '../../arc/arcStore'
import { renderWithTheme } from '../../test/helpers'
import { ArcDashboardFrame } from '../../components/ArcDashboard/ArcDashboardFrame'
import story from './CombinedDashboard.stories'

vi.mock('@nfdi4plants/arc-web-view', () => ({ WebViewer: () => <p>ARC files</p> }))

describe('CombinedDashboard', () => {
  it('groups the six cards into the requested rows and keeps both viewers interactive with popup controls', async () => {
    const store = createArcStore(sampleCrateSource())
    await store.load()
    renderWithTheme(<ArcProvider store={store}><ArcDashboardFrame content={story.args.content} label={story.args.label} fillHeight={story.args.fillHeight} arcJson={crateJson} /></ArcProvider>)
    expect(screen.getByRole('heading', { level: 1, name: 'Facultative CAM in Talinum triangulare' })).toBeVisible()
    const rows = [
      { name: 'Description, contacts, and organizations', titles: ['Description', 'Contacts', 'Organizations'] },
      { name: 'Publications, assays, and studies', titles: ['Publications', 'Assays', 'Studies'] },
    ]
    for (const { name, titles } of rows) {
      const row = screen.getByRole('region', { name })
      expect(within(row).getAllByRole('heading', { level: 2 }).map(heading => heading.textContent)).toEqual(titles)
      for (const title of titles) {
        expect(within(row).getByRole('img', { name: `${title} symbol` })).toBeVisible()
        expect(within(row).getByRole('button', { name: `Expand ${title}` })).toBeVisible()
      }
    }
    expect(await screen.findByText('ARC files', {}, { timeout: 5000 })).toBeVisible()
    expect(screen.getByRole('region', { name: 'Provenance explorer' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Expand Webview' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Expand Graphview' })).toBeVisible()
    expect(screen.getByRole('region', { name: 'ARCade' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Expand ARCade' })).toBeVisible()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Expand Contacts' }))
    const contacts = screen.getByRole('dialog', { name: 'Contacts' })
    expect(within(contacts).getAllByRole('listitem')).toHaveLength(12)
    await user.click(within(contacts).getByRole('button', { name: 'Shrink Contacts' }))
    expect(screen.getByRole('img', { name: 'Contacts symbol' })).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Expand Webview' }))
    expect(within(screen.getByRole('dialog', { name: 'Webview' })).getByText('ARC files')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Shrink Webview' }))
    expect(screen.getByText('ARC files')).toBeVisible()
  }, 15000)
})
