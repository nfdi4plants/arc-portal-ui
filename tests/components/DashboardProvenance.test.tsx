import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { ArcProvider } from '../../src/arc/ArcProvider'
import { createArcStore } from '../../src/arc/arcStore'
import { Dashboard } from '../../src/components/ArcDashboard/Dashboard'
import { renderWithTheme } from '../../src/test/helpers'
import { crateJson, sampleCrateSource } from '../helpers/sampleCrate'

vi.mock('@nfdi4plants/arc-web-view', () => ({ WebViewer: () => <p>ARC contents preview</p> }))

const repository = { source: 'https://gitlab.example', projectPath: 'research/talinum' }

it('keeps the place in the provenance dashlet when the dashboard renders again', async () => {
  const store = createArcStore(sampleCrateSource())
  await store.load()
  const dashboard = (props: { arcJson: string }) => (
    <ArcProvider store={store}>
      <Dashboard repository={repository} {...props} />
    </ArcProvider>
  )
  const user = userEvent.setup()
  const { rerender } = renderWithTheme(dashboard({ arcJson: crateJson }))
  const explorer = within(screen.getByRole('region', { name: 'Provenance explorer' }))
  await user.click(await explorer.findByRole('button', { name: (name) => name.startsWith('GCqTOF_targets,') }))
  const crumbs = () => within(explorer.getByRole('navigation', { name: 'Breadcrumb' })).getAllByRole('listitem')
  expect(crumbs()).toHaveLength(2)

  // New props make the dashboard render again with the same ARC.
  rerender(dashboard({ arcJson: `${crateJson}` }))

  expect(crumbs()).toHaveLength(2)
})

it('offers the ARCade run for the loaded ARC on the dashboard', async () => {
  const store = createArcStore(sampleCrateSource())
  await store.load()
  renderWithTheme(
    <ArcProvider store={store}>
      <Dashboard repository={repository} arcJson={crateJson} />
    </ArcProvider>,
  )
  // The test window has no fine pointer, so the dashlet shows the planned path with the keyboard notice.
  const game = within(await screen.findByRole('region', { name: 'ARCade' }))
  const steps = within(await game.findByRole('region', { name: 'Annotations per step' })).getAllByRole('listitem')
  expect(steps.length).toBeGreaterThan(0)
})
