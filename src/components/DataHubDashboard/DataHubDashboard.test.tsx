import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import DataHubDashboard from './DataHubDashboard.tsx'
import { dataHubs } from '../../config/gitlab.ts'
import { fakeConnection, gitLabProjectFull, renderWithTheme } from '../../test/helpers.tsx'
import { Failure, Success } from '../../types/result.ts'
import type { DataHubConnection } from '../../types/dashboard.ts'

const now = () => new Date('2026-10-13T12:00:00Z')
const otherHub = { id: 'other', name: 'Other Hub', source: 'https://other.example' }

function proj(id: number, name: string, lastActivity: string, extra: Parameters<typeof gitLabProjectFull>[0] = {}) {
  return gitLabProjectFull({
    id, name, last_activity_at: lastActivity, web_url: `https://git.example/${id}`,
    path_with_namespace: `ceplas/p${id}`, ...extra,
  })
}

const plantProjects = [
  proj(1, 'Alpha ARC', '2026-10-12T12:00:00Z'),
  proj(2, 'Gamma ARC', '2026-10-01T12:00:00Z'),
  proj(3, 'Beta ARC', '2026-10-10T12:00:00Z'),
]
const otherProjects = [
  proj(4, 'Delta ARC', '2026-10-11T12:00:00Z', { namespace: { id: 8, name: 'Lab', path: 'lab', kind: 'group', full_path: 'lab' }, path_with_namespace: 'lab/p4' }),
  proj(5, 'Epsilon ARC', '2026-09-01T12:00:00Z', { namespace: { id: 8, name: 'Lab', path: 'lab', kind: 'group', full_path: 'lab' }, path_with_namespace: 'lab/p5' }),
]

function connections(overrides: Partial<DataHubConnection>[] = []): DataHubConnection[] {
  return [
    fakeConnection({ hub: dataHubs[0], fetchProjects: async () => Success(plantProjects), ...overrides[0] }),
    fakeConnection({ hub: otherHub, fetchProjects: async () => Success(otherProjects), ...overrides[1] }),
  ]
}

function setup(props: Partial<React.ComponentProps<typeof DataHubDashboard>> = {}) {
  const onArcClick = vi.fn()
  const conns = props.connections ?? connections()
  renderWithTheme(<DataHubDashboard connections={conns} signedIn={false} onArcClick={onArcClick} now={now} {...props} />)
  return { onArcClick, conns }
}

describe('DataHubDashboard overview', () => {
  it('shows the summary cards for every loaded ARC', async () => {
    setup()
    const summary = await screen.findByRole('region', { name: 'Summary' })
    await within(summary).findByText('Shared publicly')
    expect(within(summary).getByRole('button', { name: /^5 ARCs/ })).toBeVisible()
    expect(within(summary).getByText('DataHUBs').parentElement).toHaveTextContent('2')
  })

  it('hides the private count and disables the access switch when logged out', async () => {
    setup()
    const summary = await screen.findByRole('region', { name: 'Summary' })
    const privateCard = within(summary).getByText('Private').parentElement!
    expect(privateCard).toHaveTextContent('–')
    expect(privateCard).toHaveTextContent('log in to see')
    expect(screen.getByText('Log in to see private ARCs')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Only public ARCs' })).toHaveAttribute('aria-disabled', 'true')
  })

  it('shows the Published card as coming soon and not clickable', async () => {
    setup()
    const summary = await screen.findByRole('region', { name: 'Summary' })
    const card = within(summary).getByText('Coming soon').parentElement!
    expect(card).toHaveAttribute('aria-disabled', 'true')
    expect(within(summary).queryByRole('button', { name: /Published/ })).not.toBeInTheDocument()
  })

  it('counts ARCs per DataHUB and working group', async () => {
    setup()
    expect(await screen.findByRole('button', { name: 'DataPLANT: 3 ARCs' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Other Hub: 2 ARCs' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'ceplas: 3 ARCs' })).toBeVisible()
    expect(screen.getByRole('img', { name: 'New ARCs per month: 5 in the last 12 months' })).toBeInTheDocument()
  })

  it('lists ARCs by latest change first', async () => {
    setup()
    await screen.findByRole('button', { name: 'Open Alpha ARC' })
    const titles = screen.getAllByRole('button', { name: /^Open .* ARC$/ }).map(button => button.getAttribute('aria-label'))
    expect(titles).toEqual(['Open Alpha ARC', 'Open Delta ARC', 'Open Beta ARC', 'Open Gamma ARC', 'Open Epsilon ARC'])
  })

  it('sorts the whole list by title from the column header', async () => {
    setup()
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Title' }))
    const titles = screen.getAllByRole('button', { name: /^Open .* ARC$/ }).map(button => button.getAttribute('aria-label'))
    expect(titles).toEqual(['Open Alpha ARC', 'Open Beta ARC', 'Open Delta ARC', 'Open Epsilon ARC', 'Open Gamma ARC'])
  })

  it('opens an ARC from its Open button', async () => {
    const { onArcClick } = setup()
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Open Beta ARC' }))
    expect(onArcClick).toHaveBeenCalledWith('https://git.example/3', 'Beta ARC')
  })

  it('names a failing DataHUB, keeps the others and retries only that one', async () => {
    const failing = vi.fn<DataHubConnection['fetchProjects']>(async () => Failure('Network down'))
    const healthy = vi.fn<DataHubConnection['fetchProjects']>(async () => Success(otherProjects))
    setup({ connections: connections([{ fetchProjects: failing }, { fetchProjects: healthy }]) })
    expect(await screen.findByText('Could not load ARCs from DataPLANT')).toBeVisible()
    expect(screen.getByText('Network down')).toBeVisible()
    expect(await screen.findByRole('button', { name: 'Open Delta ARC' })).toBeVisible()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Retry DataPLANT' }))
    expect(failing).toHaveBeenCalledTimes(2)
    expect(healthy).toHaveBeenCalledTimes(1)
  })

  it('shows one critical banner when every DataHUB fails', async () => {
    const down = async () => Failure<never>('down')
    setup({ connections: connections([{ fetchProjects: down }, { fetchProjects: down }]) })
    expect(await screen.findByText('Could not load ARCs')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeVisible()
    expect(screen.queryByRole('region', { name: 'Summary' })).not.toBeInTheDocument()
  })
})

describe('DataHubDashboard filters', () => {
  const showing = (text: string) => expect(screen.getByRole('status')).toHaveTextContent(text)

  it('narrows to a DataHUB from its bar while the other bars keep their counts', async () => {
    setup()
    const user = userEvent.setup()
    const bar = await screen.findByRole('button', { name: 'DataPLANT: 3 ARCs' })
    await user.click(bar)
    expect(bar).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Remove filter DataHUB: DataPLANT' })).toBeVisible()
    showing('Showing 3 of 5 ARCs')
    expect(screen.getByRole('button', { name: 'Other Hub: 2 ARCs' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Open Delta ARC' })).not.toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Summary' })).getByRole('button', { name: /^3 ARCs of 5/ })).toBeVisible()
  })

  it('combines filters and clears them all at once', async () => {
    setup({ connections: connections([{ fetchProjects: async () => Success([
      ...plantProjects, proj(6, 'Zeta ARC', '2026-08-01T12:00:00Z', { visibility: 'private' })]) }]), signedIn: true })
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'DataPLANT: 4 ARCs' }))
    await user.click(screen.getByRole('button', { name: /Shared publicly/ }))
    expect(screen.getByRole('button', { name: 'Remove filter Shared publicly' })).toBeVisible()
    showing('Showing 3 of 6 ARCs')
    await user.click(screen.getByRole('button', { name: 'Clear all' }))
    showing('Showing 6 of 6 ARCs')
    expect(screen.getByText('No filters. Click a card, a bar, or search to narrow down.')).toBeVisible()
  })

  it('removes a single filter from its chip', async () => {
    setup()
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'DataPLANT: 3 ARCs' }))
    await user.click(screen.getByRole('button', { name: 'Remove filter DataHUB: DataPLANT' }))
    showing('Showing 5 of 5 ARCs')
  })

  it('searches within the chosen scope', async () => {
    setup()
    const user = userEvent.setup()
    await screen.findByRole('button', { name: 'Open Alpha ARC' })
    await user.click(screen.getByRole('button', { name: /Search in: Everything/ }))
    await user.click(await screen.findByRole('menuitemradio', { name: 'Working group' }))
    await user.type(screen.getByRole('searchbox', { name: 'Search ARCs' }), 'lab')
    expect(await screen.findByRole('button', { name: 'Open Delta ARC' })).toBeVisible()
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Open Alpha ARC' })).not.toBeInTheDocument())
    showing('Showing 2 of 5 ARCs')
    expect(screen.getByRole('button', { name: /Remove filter Working group contains “lab”/ })).toBeVisible()
  })

  it('offers a way back when nothing matches', async () => {
    setup()
    const user = userEvent.setup()
    await screen.findByRole('button', { name: 'Open Alpha ARC' })
    await user.type(screen.getByRole('searchbox', { name: 'Search ARCs' }), 'zzzz')
    expect(await screen.findByText('No ARCs match these filters.')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(await screen.findByRole('button', { name: 'Open Alpha ARC' })).toBeVisible()
    expect(screen.getByRole('searchbox', { name: 'Search ARCs' })).toHaveValue('')
  })
})

describe('DataHubDashboard table paging', () => {
  it('returns to the first page when logging out changes the list', async () => {
    const many = Array.from({ length: 30 }, (_, index) => proj(100 + index, `Paged ${String(index).padStart(2, '0')}`,
      new Date(Date.UTC(2026, 9, 12, 12 - index)).toISOString()))
    const connection = [fakeConnection({ hub: dataHubs[0], fetchProjects: async () => Success(many) })]
    const element = (signedIn: boolean) => (
      <DataHubDashboard connections={connection} signedIn={signedIn} onArcClick={vi.fn()} now={now} />)
    const { rerender } = renderWithTheme(element(true))
    const user = userEvent.setup()
    await screen.findByRole('button', { name: 'Open Paged 00' })
    console.log('NAV', document.querySelector('nav')?.outerHTML.slice(0,1500))
    await user.click(await screen.findByRole('button', { name: 'Next page' }))
    expect(screen.queryByRole('button', { name: 'Open Paged 00' })).not.toBeInTheDocument()
    rerender(element(false))
    expect(await screen.findByRole('button', { name: 'Open Paged 00' })).toBeVisible()
  })
})
