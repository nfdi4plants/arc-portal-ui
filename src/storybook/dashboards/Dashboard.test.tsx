import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import '../../test/nativeDialog'
import { sampleCrateSource } from '../../../tests/helpers/sampleCrate'
import { ArcProvider } from '../../arc/ArcProvider'
import { createArcStore } from '../../arc/arcStore'
import { renderWithTheme } from '../../test/helpers'
import story from './Dashboard.stories'

vi.mock('@nfdi4plants/arc-web-view', () => ({ WebViewer: () => <p>ARC files</p> }))

describe('Dashboard main story', () => {
  it('offers every design in the requested order and switches layouts using the same ARC', async () => {
    const source = sampleCrateSource()
    const fetchROCrate = vi.fn(source.fetchROCrate)
    const store = createArcStore({ ...source, fetchROCrate })
    await store.load()
    const Designs = story.component
    renderWithTheme(<ArcProvider store={store}><Designs {...story.args} /></ArcProvider>)
    const user = userEvent.setup()
    const navigation = within(screen.getByRole('navigation', { name: 'Dashboard designs' }))
    expect(navigation.getAllByRole('button').map(button => button.textContent)).toEqual([
      'ScrollingDashboard', 'SplitDashboard', 'TabbedDashboard', 'ScrollingSplitDashboard', 'HubDashboard',
      'CombinedDashboard', 'StackedDashboard', 'CircularDashboard', 'ClassicDashboard',
    ])
    expect(screen.getByRole('region', { name: 'ScrollingDashboard' })).toBeVisible()
    await user.click(navigation.getByRole('button', { name: 'TabbedDashboard' }))
    expect(screen.getByRole('tab', { name: 'Graphview' })).toHaveAttribute('aria-selected', 'true')
    await user.click(navigation.getByRole('button', { name: 'SplitDashboard' }))
    expect(screen.getByRole('separator')).toHaveAttribute('aria-valuetext', 'Graphview 40%, Webview 60%')
    await user.click(navigation.getByRole('button', { name: 'ScrollingSplitDashboard' }))
    expect(screen.getByRole('region', { name: 'ScrollingSplitDashboard' })).toBeVisible()
    expect(screen.getByRole('heading', { level: 1, name: 'Facultative CAM in Talinum triangulare' })).toBeVisible()
    expect(screen.getByRole('separator')).toHaveAttribute('aria-valuetext', 'Graphview 40%, Webview 60%')
    await user.click(navigation.getByRole('button', { name: 'ClassicDashboard' }))
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('button', { name: 'Pop out ARC viewer' })).toBeVisible()
    expect(fetchROCrate).toHaveBeenCalledOnce()
  }, 15000)
})
