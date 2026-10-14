import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '../../src/test/nativeDialog'
import { beforeEach, expect, it, vi } from 'vitest'
import ArcDashboard from '../../src/components/ArcDashboard/ArcDashboard'
import { renderWithTheme } from '../../src/test/helpers'
import { crateJson } from '../helpers/sampleCrate'

vi.mock('../../src/components/ArcDashboard/ArcViewer/ArcViewer.tsx', () => ({ default: () => <div>ARC viewer</div> }))

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(new Response(crateJson)))
})

it('renders the New Dashboard tiles with ARCade, Graphview and the Back button', async () => {
  const onBack = vi.fn()
  const user = userEvent.setup()
  renderWithTheme(<ArcDashboard name="Selected ARC" url="https://datahub.example/lab/arc" source="https://datahub.example" projectId={42} onBack={onBack} />)

  const dashboard = await screen.findByRole('region', { name: 'ARC-Dashboard' })
  await within(dashboard).findByRole('heading', { level: 1, name: 'Facultative CAM in Talinum triangulare' })
  for (const name of ['Description', 'Contacts', 'Organizations', 'Publications', 'Assays', 'Studies', 'Webview', 'Graphview', 'ARCade']) {
    expect(within(dashboard).getByRole('button', { name: `Expand ${name}` })).toBeVisible()
  }
  await user.click(within(dashboard).getByRole('button', { name: 'Back' }))
  expect(onBack).toHaveBeenCalledOnce()
})
