import { screen, within } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import ArcDashboard from '../../src/components/ArcDashboard/ArcDashboard'
import { renderWithTheme } from '../../src/test/helpers'
import { crateJson } from '../helpers/sampleCrate'

vi.mock('../../src/components/ArcDashboard/ArcViewer/ArcViewer.tsx', () => ({ default: () => <div>ARC viewer</div> }))

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(new Response(crateJson)))
})

it('shows the provenance of the loaded ARC on the ARC dashboard', async () => {
  renderWithTheme(
    <ArcDashboard name="Selected ARC" url="https://datahub.example/lab/arc" source="https://datahub.example" projectId={42} onBack={vi.fn()} />,
  )

  const explorer = within(await screen.findByRole('region', { name: 'Provenance explorer' }))
  expect(await explorer.findByRole('button', { name: (name) => name.startsWith('GCqTOF_targets,') })).toBeInTheDocument()
})
