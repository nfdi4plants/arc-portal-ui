import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import DataHubDashboard, { type DataHubDashboardProps } from './DataHubDashboard.tsx'
import { fakeDataHubFetchers, gitLabProjectFull, plantdatahub, renderWithTheme, deferred } from '../../test/helpers.tsx'
import { AUTH_FAILED_MESSAGE } from '../../api/gitlab/client.ts'
import { Failure, Success, type Result } from '../../types/result.ts'
import type { GitLabContributor } from '../../types/gitlab.ts'
import type { DataHubFetchers } from '../../types/dashboard.ts'

const now = () => new Date('2026-10-13T12:00:00Z')
const otherHub = { id: 'other', name: 'Other Hub', url: 'https://other.example' }

function proj(id: number, name: string, hubUrl: string, lastActivity: string, extra: Parameters<typeof gitLabProjectFull>[0] = {}) {
  return gitLabProjectFull({
    id, name, last_activity_at: lastActivity, web_url: `${hubUrl}/arcs/${id}`, path_with_namespace: `ceplas/arc-${id}`,
    ...extra,
  })
}

const plantProjects = [
  proj(1, 'Alpha', 'https://git.nfdi4plants.org', '2026-10-10T10:00:00Z'),
  proj(2, 'Beta', 'https://git.nfdi4plants.org', '2026-09-01T10:00:00Z'),
  proj(3, 'Gamma', 'https://git.nfdi4plants.org', '2026-08-01T10:00:00Z'),
]
const otherProjects = [
  proj(4, 'Delta', 'https://other.example', '2026-10-12T10:00:00Z'),
  proj(5, 'Epsilon', 'https://other.example', '2026-07-01T10:00:00Z'),
]
const dashboard = (overrides: Partial<DataHubDashboardProps> = {}): DataHubDashboardProps => ({
  ...fakeDataHubFetchers(), dataHubs: [plantdatahub], onArcClick: vi.fn(), now, ...overrides,
})
const twoHubs = (overrides: Partial<DataHubDashboardProps> = {}) => dashboard({
  dataHubs: [plantdatahub, otherHub],
  fetchProjects: async source => Success(source === plantdatahub.url ? plantProjects : otherProjects),
  fetchGroups: async () => Success([{ id: 2, name: 'CEPLAS', full_path: 'ceplas' }]),
  ...overrides,
})

describe('DataHubDashboard US1 overview', () => {
  it('shows the stats sidebar with totals, DataHUBs, the private hint and the DOI placeholder', async () => {
    renderWithTheme(<DataHubDashboard {...twoHubs()} onArcClick={vi.fn()} now={now} />)
    const summary = within(await screen.findByRole('complementary', { name: 'Summary' }))
    const accessible = summary.getByRole('button', { name: 'ARCs accessible' })
    expect(accessible).toHaveAttribute('aria-pressed', 'true')
    expect(accessible).toHaveAccessibleDescription('5 of 5')
    expect(summary.getByRole('group', { name: 'DataHUBs' })).toHaveTextContent('2')
    expect(summary.getByRole('group', { name: 'private' })).toHaveTextContent('–')
    expect(summary.getByRole('group', { name: 'private' })).toHaveTextContent('log in to see')
    expect(summary.queryByRole('button', { name: 'private' })).not.toBeInTheDocument()
    const doi = summary.getByRole('group', { name: 'with DOI' })
    expect(doi).toHaveAttribute('aria-disabled', 'true')
    expect(doi).toHaveTextContent('Coming soon')
    expect(summary.queryByRole('button', { name: 'with DOI' })).not.toBeInTheDocument()
  })

  it('names the DataHUB bars and lists rows by latest change first', async () => {
    renderWithTheme(<DataHubDashboard {...twoHubs()} onArcClick={vi.fn()} now={now} />)
    expect(await screen.findByRole('button', { name: 'PLANTdataHUB (official): 3 ARCs' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Other Hub: 2 ARCs' })).toBeVisible()
    const openButtons = await screen.findAllByRole('button', { name: /^Open / })
    expect(openButtons.map(button => button.getAttribute('aria-label')))
      .toEqual(['Open Delta', 'Open Alpha', 'Open Beta', 'Open Gamma', 'Open Epsilon'])
  })

  it('labels every month column and shows a zero count', async () => {
    renderWithTheme(<DataHubDashboard {...twoHubs()} onArcClick={vi.fn()} now={now} />)
    await screen.findByRole('button', { name: 'Open Alpha' })
    expect(screen.getAllByText(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)$/)).toHaveLength(12)
    expect(screen.getAllByText('0')).not.toHaveLength(0)
  })
})

describe('DataHubDashboard US2 filtering', () => {
  it('adds a chip, updates the count and presses the right stat when filtering by DataHUB', async () => {
    const user = userEvent.setup()
    renderWithTheme(<DataHubDashboard {...twoHubs()} onArcClick={vi.fn()} now={now} />)
    const hubBar = await screen.findByRole('button', { name: 'PLANTdataHUB (official): 3 ARCs' })
    const summary = within(screen.getByRole('complementary', { name: 'Summary' }))
    expect(summary.getByRole('button', { name: 'ARCs accessible' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(hubBar)
    expect(screen.getByText('DataHUB: PLANTdataHUB (official)')).toBeVisible()
    expect(screen.getByRole('status')).toHaveTextContent('Showing 3 of 5 ARCs')
    expect(screen.getByRole('button', { name: 'Other Hub: 2 ARCs' })).toBeVisible()
    expect(summary.getByRole('button', { name: 'ARCs accessible' })).toHaveAttribute('aria-pressed', 'false')
    await user.click(summary.getByRole('button', { name: 'shared publicly' }))
    expect(screen.getByText('Shared publicly')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Clear all' })).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Clear all' }))
    expect(screen.queryByText('DataHUB: PLANTdataHUB (official)')).not.toBeInTheDocument()
    expect(summary.getByRole('button', { name: 'ARCs accessible' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('filters the rows by search term', async () => {
    const user = userEvent.setup()
    renderWithTheme(<DataHubDashboard {...twoHubs()} onArcClick={vi.fn()} now={now} />)
    await screen.findByRole('button', { name: 'Open Alpha' })
    // Paste is one event; typing re-renders the whole dashboard per key, which is slow under load.
    await user.click(screen.getByRole('searchbox', { name: 'Search ARCs' }))
    await user.paste('alpha')
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Open Beta' })).not.toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Open Alpha' })).toBeVisible()
    expect(screen.getByText('Search: “alpha”')).toBeVisible()
  })

  it('filters the rows to recently changed ARCs', async () => {
    const user = userEvent.setup()
    renderWithTheme(<DataHubDashboard {...twoHubs()} onArcClick={vi.fn()} now={now} />)
    await screen.findByRole('button', { name: 'Open Gamma' })
    await user.click(screen.getByRole('button', { name: 'Only recently changed ARCs' }))
    expect(screen.getByText('Changed in the last 30 days')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Open Gamma' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open Alpha' })).toBeVisible()
  })

  it('shows the empty state when nothing matches', async () => {
    const user = userEvent.setup()
    renderWithTheme(<DataHubDashboard {...twoHubs()} onArcClick={vi.fn()} now={now} />)
    await screen.findByRole('button', { name: 'Open Alpha' })
    await user.click(screen.getByRole('searchbox', { name: 'Search ARCs' }))
    await user.paste('nothing matches')
    expect(await screen.findByText('No ARCs match these filters.')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(await screen.findByRole('button', { name: 'Open Alpha' })).toBeVisible()
  })
})

describe('DataHubDashboard working-group tabs', () => {
  it('selects Public ARCs and explains the private tab when logged out', async () => {
    renderWithTheme(<DataHubDashboard {...twoHubs()} onArcClick={vi.fn()} now={now} />)
    expect(await screen.findByRole('tab', { name: 'Public ARCs' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('Log in to see your ARCs.')).toBeInTheDocument()
  })

  it('selects My ARCs and lists only member groups including the Personal Sandbox', async () => {
    const personal = proj(9, 'Personal study', 'https://git.nfdi4plants.org', '2026-10-01T10:00:00Z', {
      namespace: { id: 9, name: 'Jane', path: 'jane', kind: 'user', full_path: 'jane' },
    })
    const props = twoHubs({ tokens: { [plantdatahub.id]: 'plant-token' },
      fetchProjects: async source => Success(source === plantdatahub.url ? [...plantProjects, personal] : otherProjects),
      fetchMemberProjectIds: async () => Success([1, 2, 9]),
    })
    renderWithTheme(<DataHubDashboard {...props} />)
    expect(await screen.findByRole('tab', { name: 'My ARCs' })).toHaveAttribute('aria-selected', 'true')
    const myPanel = within(screen.getByRole('tabpanel', { name: 'My ARCs' }))
    expect(myPanel.getByRole('button', { name: /CEPLAS: 2 ARCs/ })).toBeVisible()
    expect(myPanel.getByRole('button', { name: /Personal Sandbox: 1 ARC/ })).toBeVisible()
    expect(myPanel.queryByRole('button', { name: /Delta/ })).not.toBeInTheDocument()
  })
})

describe('DataHubDashboard table actions', () => {
  it('links out, opens the single-ARC page and offers more actions', async () => {
    const onArcClick = vi.fn()
    const user = userEvent.setup()
    renderWithTheme(<DataHubDashboard {...twoHubs()} onArcClick={onArcClick} now={now} />)
    const external = await screen.findByRole('link', { name: 'View Alpha on PLANTdataHUB (official)' })
    expect(external).toHaveAttribute('href', 'https://git.nfdi4plants.org/arcs/1')
    expect(external).toHaveAttribute('target', '_blank')
    await user.click(screen.getByRole('button', { name: 'Open Alpha' }))
    expect(onArcClick).toHaveBeenCalledWith('https://git.nfdi4plants.org/arcs/1', 'Alpha', 1, plantdatahub)
    await user.click(screen.getByRole('button', { name: 'Open Delta' }))
    expect(onArcClick).toHaveBeenCalledWith('https://other.example/arcs/4', 'Delta', 4, otherHub)
    await user.click(screen.getByRole('button', { name: 'More actions for Alpha' }))
    expect(await screen.findByRole('menuitem', { name: 'View on PLANTdataHUB (official)' })).toBeVisible()
  })
})

describe('DataHubDashboard US3 logged-in views', () => {
  it('counts one private ARC, labels its row and explains the partial note', async () => {
    const privateArc = proj(6, 'Private study', 'https://git.nfdi4plants.org', '2026-10-09T10:00:00Z', { visibility: 'private' })
    const props = twoHubs({ tokens: { [plantdatahub.id]: 'plant-token' },
      fetchProjects: async source => Success(source === plantdatahub.url ? [...plantProjects, privateArc] : otherProjects),
    })
    renderWithTheme(<DataHubDashboard {...props} />)
    const summary = within(await screen.findByRole('complementary', { name: 'Summary' }))
    expect(summary.getByRole('button', { name: 'private' })).toHaveTextContent('1')
    expect(screen.getByText('Private ARCs are included from PLANTdataHUB (official) only.')).toBeVisible()
    await screen.findByRole('button', { name: 'Open Private study' })
    expect(screen.getByText('Private', { selector: 'span' })).toBeVisible()
  })

  it('keeps the other DataHUB visible and unrefetched while a changed one reloads', async () => {
    const fetchA = vi.fn<DataHubFetchers['fetchProjects']>(async () => Success(plantProjects))
    const fetchB = vi.fn<DataHubFetchers['fetchProjects']>(async () => Success(otherProjects))
    const props = twoHubs({ tokens: { [plantdatahub.id]: 'plant-token' },
      fetchProjects: (source, options) => (source === plantdatahub.url ? fetchA : fetchB)(source, options),
    })
    const { rerender } = renderWithTheme(<DataHubDashboard {...props} />)
    await screen.findByRole('button', { name: 'Open Alpha' })
    expect(screen.getByRole('button', { name: 'Open Delta' })).toBeVisible()
    rerender(<DataHubDashboard {...props} tokens={{ ...props.tokens, [otherHub.id]: 'other-token' }} />)
    expect(screen.getByRole('button', { name: 'Open Alpha' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Open Delta' })).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Open Delta' })).toBeVisible())
    expect(fetchA).toHaveBeenCalledTimes(1)
    expect(fetchB).toHaveBeenCalledTimes(2)
  })
})

describe('DataHubDashboard expired login', () => {
  it('treats a rejected token as logged out', async () => {
    const props = dashboard({
      tokens: { [plantdatahub.id]: 'expired-token' },
      fetchProjects: async (_source, options) => options?.token ? Failure(AUTH_FAILED_MESSAGE) : Success(plantProjects),
      fetchMemberProjectIds: async () => Failure('Unauthorized'),
    })
    renderWithTheme(<DataHubDashboard {...props} onArcClick={vi.fn()} now={now} />)
    const summary = within(await screen.findByRole('complementary', { name: 'Summary' }))
    expect(await screen.findByText(/Your login for .* has expired/)).toBeVisible()
    expect(summary.getByRole('group', { name: 'private' })).toHaveTextContent('–')
    expect(summary.getByRole('group', { name: 'private' })).toHaveTextContent('log in to see')
    expect(screen.queryByText(/Private ARCs are included from/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Could not load your memberships/)).not.toBeInTheDocument()
  })
})

describe('DataHubDashboard US4 people', () => {
  const jane = { name: 'Jane Doe', email: 'jane@example.org', commits: 3 }

  it('keeps rows visible while details load and counts distinct people afterwards', async () => {
    const gates: ReturnType<typeof deferred<Result<GitLabContributor[]>>>[] = []
    const props = dashboard({
      fetchProjects: async () => Success(plantProjects),
      fetchContributors: () => {
        const gate = deferred<Result<GitLabContributor[]>>()
        gates.push(gate)
        return gate.promise
      },
      fetchLatestCommit: async () => Success(null),
    })
    renderWithTheme(<DataHubDashboard {...props} onArcClick={vi.fn()} now={now} />)
    const summary = within(await screen.findByRole('complementary', { name: 'Summary' }))
    expect(await screen.findByRole('button', { name: 'Open Alpha' })).toBeVisible()
    expect(summary.getByRole('group', { name: 'people' })).toHaveTextContent('counting…')
    for (const gate of gates) gate.resolve(Success([jane, { name: 'Jane Doe', email: 'jane@example.org', commits: 1 }]))
    await waitFor(() => expect(summary.getByRole('group', { name: 'people' })).toHaveTextContent('1'))
    expect(screen.getAllByRole('button', { name: 'Jane Doe' }).length).toBeGreaterThan(0)
  })

  it('does not count ARCitect', async () => {
    const props = dashboard({
      fetchProjects: async () => Success(plantProjects),
      fetchContributors: async () => Success([{ name: 'ARCitect', email: 'arcitect@nfdi4plants.org', commits: 999 }, jane]),
      fetchLatestCommit: async () => Success(null),
    })
    renderWithTheme(<DataHubDashboard {...props} onArcClick={vi.fn()} now={now} />)
    const summary = within(await screen.findByRole('complementary', { name: 'Summary' }))
    await waitFor(() => expect(summary.getByRole('group', { name: 'people' })).toHaveTextContent('1'))
    expect(screen.queryByText('ARCitect')).not.toBeInTheDocument()
  })

  it('finds an ARC by contributor name', async () => {
    const user = userEvent.setup()
    const props = dashboard({
      fetchProjects: async () => Success(plantProjects),
      fetchContributors: async (_source, projectId) => projectId === 1
        ? Success([jane])
        : Success([{ name: 'Other Person', email: 'other@example.org', commits: 1 }]),
      fetchLatestCommit: async () => Success(null),
    })
    renderWithTheme(<DataHubDashboard {...props} onArcClick={vi.fn()} now={now} />)
    await screen.findByRole('button', { name: 'Open Alpha' })
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Jane Doe' }).length).toBeGreaterThan(0))
    await user.click(screen.getByRole('searchbox', { name: 'Search ARCs' }))
    await user.paste('jane doe')
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Open Beta' })).not.toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Open Alpha' })).toBeVisible()
  })
})

describe('DataHubDashboard table paging', () => {
  it('returns to a valid page when a reload shrinks the list', async () => {
    const many = Array.from({ length: 30 }, (_, index) => proj(100 + index, `Paged ${String(index).padStart(2, '0')}`,
      'https://git.nfdi4plants.org', new Date(Date.UTC(2026, 9, 12, 12 - index)).toISOString()))
    const few = many.slice(0, 5)
    const fetchProjects = vi.fn<DataHubFetchers['fetchProjects']>()
      .mockResolvedValueOnce(Success(many))
      .mockResolvedValue(Success(few))
    renderWithTheme(<DataHubDashboard {...dashboard({ fetchProjects })} />)
    const user = userEvent.setup()
    await screen.findByRole('button', { name: 'Open Paged 00' })
    // Primer's pagination labels contain non-breaking spaces that testing-library cannot match,
    // so drive the second page through its DOM button.
    const pageTwo = [...document.querySelectorAll('nav[aria-label="ARC pages"] button')]
      .find(button => button.textContent?.includes('2'))
    expect(pageTwo).toBeDefined()
    await user.click(pageTwo!)
    expect(screen.queryByRole('button', { name: 'Open Paged 00' })).not.toBeInTheDocument()
    // Updating with fewer ARCs must not leave the table beyond its last page.
    await user.click(screen.getByRole('button', { name: 'Update' }))
    expect(await screen.findByRole('button', { name: 'Open Paged 00' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Open Paged 04' })).toBeVisible()
  }, 15000)
})

describe('DataHubDashboard loading', () => {
  it('shows no stats, charts or table while the first load is still running', async () => {
    const pending = new Promise<never>(() => {})
    renderWithTheme(<DataHubDashboard {...dashboard({ fetchProjects: () => pending })} />)
    expect(screen.getByRole('status')).toHaveTextContent('Loading ARCs from 1 DataHUBs…')
    expect(screen.queryByRole('complementary', { name: 'Summary' })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'ARCs per DataHUB' })).not.toBeInTheDocument()
    expect(screen.queryByRole('img', { name: /New ARCs per month/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('table', { name: 'ARCs' })).not.toBeInTheDocument()
  })

  it('keeps the other DataHUB visible while one reloads after a login', async () => {
    const props = twoHubs({ fetchProjects: (source, options) => options?.token
      ? new Promise(() => {}) : Promise.resolve(Success(source === plantdatahub.url ? plantProjects : otherProjects)) })
    const { rerender } = renderWithTheme(<DataHubDashboard {...props} />)
    await screen.findByRole('button', { name: 'Open Delta' })
    rerender(<DataHubDashboard {...props} tokens={{ [otherHub.id]: 'other-token' }} />)
    expect(await screen.findByRole('button', { name: 'Open Alpha' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Open Delta' })).not.toBeInTheDocument()
    expect(screen.queryByText(/Loading ARCs/)).not.toBeInTheDocument()
    expect(screen.getByRole('complementary', { name: 'Summary' })).toBeVisible()
  })

  it('shows ARC rows under StrictMode', async () => {
    renderWithTheme(<DataHubDashboard {...twoHubs()} onArcClick={vi.fn()} now={now} />, true)
    expect(await screen.findByRole('button', { name: 'Open Alpha' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Open Delta' })).toBeVisible()
  })
})
