import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '../../test/nativeDialog'
import { describe, expect, it, vi } from 'vitest'
import { crateJson, sampleCrateSource } from '../../../tests/helpers/sampleCrate'
import { ArcProvider } from '../../arc/ArcProvider'
import { createArcStore } from '../../arc/arcStore'
import { renderWithTheme } from '../../test/helpers'
import { ArcDashboardFrame } from '../../components/ArcDashboard/ArcDashboardFrame'
import story from './CircularDashboard.stories'

vi.mock('@nfdi4plants/arc-web-view', () => ({ WebViewer: () => <p>ARC contents preview</p> }))

describe('CircularDashboard', () => {
  it('shows the complete header in the hub and every investigation section without tab switching', async () => {
    const user = userEvent.setup()
    const store = createArcStore(sampleCrateSource())
    await store.load()
    renderWithTheme(
      <ArcProvider store={store}>
        <ArcDashboardFrame content={story.args.content} label={story.args.label} fillHeight={story.args.fillHeight}
          arcJson={crateJson}
          repository={{ source: 'https://gitlab.example', projectPath: 'research/talinum' }}
          dataHubData={{
            visibility: 'public',
            owner: { name: 'ARC owner', url: 'https://gitlab.example/owner' },
            versions: [{
              kind: 'release', tag: 'v1.0', name: 'Release', commit: 'abc',
              url: 'https://gitlab.example/releases/v1.0', archiveSizeBytes: 2048,
            }],
          }}
        />
      </ArcProvider>,
    )

    const dashboard = screen.getByRole('region', { name: 'CircularDashboard' })
    const title = within(dashboard).getByRole('heading', { level: 1, name: 'Facultative CAM in Talinum triangulare' })
    const hub = title.closest('.new-dashboard-hub')! as HTMLElement
    expect(within(hub).getByRole('link', { name: 'research/talinum' })).toHaveAttribute('href', 'https://gitlab.example/research/talinum')
    expect(within(hub).getByRole('link', { name: 'v1.0' })).toHaveAttribute('href', 'https://gitlab.example/releases/v1.0')
    expect(within(hub).getByRole('link', { name: 'ARC owner' })).toBeVisible()
    expect(within(hub).getByRole('img', { name: 'Public ARC' })).toBeVisible()
    expect(within(hub).getByText('ARC size: 2 KiB')).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Expand Description' }))
    expect(within(screen.getByRole('dialog', { name: 'Description' })).getByText(/^Drought tolerance/)).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Shrink Description' }))
    for (const [name, count] of [['Contacts (12)', 12], ['Organizations (4)', 4], ['Publications (2)', 2], ['Assays (3)', 3], ['Studies (2)', 2], ['Runs (6)', 6], ['Workflows (6)', 6]] as const) {
      const dashlet = screen.getByRole('region', { name: `${name} dashlet` })
      expect(dashlet).toBeVisible()
      expect(within(dashlet).getByRole('img', { name: `${name} symbol` })).toBeVisible()
      await user.click(within(dashlet).getByRole('button', { name: `Expand ${name}` }))
      expect(within(screen.getByRole('dialog', { name })).getAllByRole('listitem')).toHaveLength(count)
      if (name === 'Publications (2)') expect(screen.getByRole('link', { name: /^Reversible Burst/ })).toHaveAttribute('href', 'https://doi.org/10.1104/pp.15.01076')
      await user.click(screen.getByRole('button', { name: `Shrink ${name}` }))
    }
    expect(within(dashboard).queryByRole('tab')).not.toBeInTheDocument()
    expect(within(dashboard).queryByRole('region', { name: 'ARC overview' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Expand Webview' }))
    expect(await screen.findByText('ARC contents preview', {}, { timeout: 5000 })).toBeVisible()
    expect(within(screen.getByRole('dialog', { name: 'Webview' })).getByRole('region', { name: 'ARC contents' })).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Shrink Webview' }))
    await user.click(screen.getByRole('button', { name: 'Expand Graphview' }))
    expect(within(screen.getByRole('dialog', { name: 'Graphview' })).getByRole('region', { name: 'Provenance explorer' })).toBeVisible()
  }, 25000)
})
