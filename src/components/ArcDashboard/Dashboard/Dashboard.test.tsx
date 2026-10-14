import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { crateJson, sampleCrateSource } from '../../../../tests/helpers/sampleCrate'
import { ArcProvider } from '../../../arc/ArcProvider'
import { createArcStore } from '../../../arc/arcStore'
import type { ArcRepositoryOverview, ArcRepositoryVersion } from '../../../api/gitlab'
import { renderWithTheme } from '../../../test/helpers'
import { InvestigationHeader } from '../Investigation/InvestigationHeader'
import { InvestigationDescription } from '../Investigation/InvestigationDetails/InvestigationDescription'
import { Dashboard, type DashboardProps } from './Dashboard'

vi.mock('@nfdi4plants/arc-web-view', () => ({ WebViewer: () => <p>ARC contents preview</p> }))
vi.mock('../ArcViewer/fileSizes', () => ({ loadFileSizes: vi.fn(async () => new Map()) }))

const repository = { source: 'https://gitlab.example', projectPath: 'research/talinum' }
const release: ArcRepositoryVersion = {
  tag: 'v1.0', name: 'Talinum release', kind: 'release', description: 'Curated ARC metadata',
  date: '2025-02-01T10:00:00Z', commit: '0123456789abcdef',
  url: 'https://gitlab.example/research/talinum/-/releases/v1.0',
}
const dataHubData: ArcRepositoryOverview = {
  versions: [], visibility: 'public',
  owner: { name: 'Dominik Brilhaus', url: 'https://gitlab.example/brilator' },
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockRejectedValue(new Error('Unexpected network request')))
})

afterEach(() => {
  expect(fetch).not.toHaveBeenCalled()
})

async function renderDetails(props: Omit<DashboardProps, 'arcJson'> = { repository, dataHubData }) {
  const store = createArcStore(sampleCrateSource())
  await store.load()
  renderWithTheme(<ArcProvider store={store}><Dashboard {...props} arcJson={crateJson} /></ArcProvider>)
  await screen.findByText('ARC contents preview', {}, { timeout: 5000 })
  return userEvent.setup()
}

describe('ARC-Dashboard', () => {
  it('opens the ARC viewer from its expand button', async () => {
    const user = await renderDetails()
    const frame = document.createElement('iframe')
    document.body.appendChild(frame)
    const popup = frame.contentWindow!
    popup.matchMedia = window.matchMedia
    vi.spyOn(window, 'open').mockReturnValue(popup)
    vi.spyOn(popup, 'focus').mockImplementation(() => {})
    try {
      await user.click(screen.getByRole('button', { name: 'Open ARC viewer in popup' }))
      expect(window.open).toHaveBeenCalledWith('', 'arc-viewer-popup', expect.any(String))
      const viewer = within(popup.document.body)
      expect(viewer.getByRole('heading', { name: 'Facultative CAM in Talinum triangulare' })).toBeVisible()
      expect(within(await viewer.findByRole('region', { name: 'ARC contents' })).getByText('ARC contents preview')).toBeVisible()
    } finally {
      act(() => { popup.dispatchEvent(new Event('pagehide')) })
      frame.remove()
    }
  })

  it('opens interactive investigation details when the expand button is clicked', async () => {
    const user = await renderDetails()
    const frame = document.createElement('iframe')
    document.body.appendChild(frame)
    const popup = frame.contentWindow!
    vi.spyOn(window, 'open').mockReturnValue(popup)
    vi.spyOn(popup, 'focus').mockImplementation(() => {})
    try {
      await user.click(screen.getByRole('button', { name: 'Open investigation details in popup' }))
      const details = within(popup.document.body)
      expect(details.getByRole('heading', { name: 'Facultative CAM in Talinum triangulare' })).toBeVisible()
      expect(details.getAllByRole('tab')).toHaveLength(9)
      await user.click(details.getByRole('tab', { name: /^Contacts/ }))
      expect(within(details.getByRole('region', { name: /^Contacts/ })).getAllByRole('listitem')).toHaveLength(12)
      await user.click(details.getByRole('tab', { name: /^Publications/ }))
      expect(within(details.getByRole('region', { name: /^Publications/ })).getAllByRole('listitem')).toHaveLength(2)
    } finally {
      act(() => { popup.dispatchEvent(new Event('pagehide')) })
      frame.remove()
    }
  })

  it('shows Overview labels with colons and opens Publications from its preview', async () => {
    const user = await renderDetails()
    const overview = screen.getByRole('region', { name: 'ARC overview' })
    for (const label of ['Description', 'Contacts', 'Organizations', 'Publications', 'Assays', 'Studies', 'Runs', 'Workflows']) {
      const row = within(overview).getByRole('button', { name: `View ${label.toLowerCase()}` })
      expect(within(row).getByText(`${label}:`)).toBeVisible()
    }
    const publications = within(overview).getByRole('button', { name: 'View publications' })
    expect(within(publications).getByText('Show more (2)')).toBeVisible()
    expect(within(publications).queryByText(/^Reversible Burst/)).not.toBeInTheDocument()
    await user.click(publications)
    expect(screen.getByRole('tab', { name: /^Publications/ })).toHaveAttribute('aria-selected', 'true')
    expect(within(screen.getByRole('region', { name: 'Publications' })).getAllByRole('listitem')).toHaveLength(2)
  })

  it.each([
    { tab: 'Assays', names: ['GCqTOF_targets', 'Agilent MassHunter data analysis', 'mRNASeq of Talinum leaf samples'] },
    { tab: 'Studies', names: ['Early genome draft of Talinum fruticosum', 'TalinumSamples-STRI'] },
  ])('opens $tab from Overview, with names in separate rows and a counted tab label', async ({ tab, names }) => {
    const user = await renderDetails()
    const preview = screen.getByRole('button', { name: `View ${tab.toLowerCase()}` })
    expect(within(preview).getByText(`Show more (${names.length})`)).toBeVisible()
    for (const name of names) expect(within(preview).queryByText(name)).not.toBeInTheDocument()
    await user.click(preview)
    expect(screen.getByRole('tab', { name: `${tab} (${names.length})` })).toHaveAccessibleName(`${tab} (${names.length})`)
    const list = within(screen.getByRole('region', { name: tab })).getByRole('list')
    expect(within(list).getAllByRole('listitem').map(item => item.textContent)).toEqual(names)
    await user.click(screen.getByRole('tab', { name: 'Overview' }))
    expect(screen.getByRole('region', { name: 'ARC overview' })).toBeVisible()
  })

  it('shows the first contact with the remaining count and only a total for organizations', async () => {
    const user = await renderDetails()
    const overview = screen.getByRole('region', { name: 'ARC overview' })
    const contactsRow = within(overview).getByRole('button', { name: 'View contacts' })
    const organizationsRow = within(overview).getByRole('button', { name: 'View organizations' })
    expect(within(contactsRow).getByText('Dominik Brilhaus')).toBeVisible()
    expect(within(contactsRow).getByText('Show more (11)')).toBeVisible()
    expect(within(contactsRow).queryByText('Andrea Bräutigam')).not.toBeInTheDocument()
    expect(within(organizationsRow).getByText('Show more (4)')).toBeVisible()
    expect(within(organizationsRow).queryByText('Cluster of Excellence on Plant Science (CEPLAS)')).not.toBeInTheDocument()
    await user.click(contactsRow)
    expect(screen.getByRole('tab', { name: /^Contacts/ })).toHaveAttribute('aria-selected', 'true')
    expect(within(screen.getByRole('region', { name: 'Contacts' })).getAllByRole('listitem')).toHaveLength(12)
    await user.click(screen.getByRole('tab', { name: 'Overview' }))
    await user.click(screen.getByRole('button', { name: 'View organizations' }))
    expect(screen.getByRole('tab', { name: /^Organizations/ })).toHaveAttribute('aria-selected', 'true')
    expect(within(screen.getByRole('region', { name: 'Organizations' })).getAllByRole('listitem')).toHaveLength(4)
  })

  it('opens the unabridged Description tab from Overview with the keyboard', async () => {
    const user = await renderDetails()
    const row = screen.getByRole('button', { name: 'View description' })
    const preview = within(row).getByText(/^Drought tolerance/).textContent
    row.focus()
    await user.keyboard('{Enter}')
    const tab = screen.getByRole('tab', { name: 'Description' })
    expect(tab).toHaveAttribute('aria-selected', 'true')
    expect(within(screen.getByRole('region', { name: 'ARC description' })).getByText(/^Drought tolerance/).textContent).toBe(preview)
    expect(screen.queryByRole('button', { name: /Show more|Show less/ })).not.toBeInTheDocument()
    await vi.waitFor(() => expect(tab).toHaveFocus())
  })

  it('shows the ARC header above investigation and viewer dashlets, with Overview selected', async () => {
    await renderDetails()
    const dashboard = screen.getByRole('region', { name: 'ARC-Dashboard' })
    const investigationDetails = within(dashboard).getByRole('region', { name: 'Investigation details' })
    const arcWebView = within(dashboard).getByRole('region', { name: 'ArcWebView' })
    expect(within(arcWebView).getByRole('region', { name: 'ARC contents' })).toBeVisible()
    const header = within(dashboard).getByRole('navigation', { name: 'DataHub links' }).closest('header')!
    expect(within(header).getByRole('link', { name: 'Dominik Brilhaus' })).toBeVisible()
    expect(within(header).getByRole('navigation', { name: 'DataHub links' })).toBeVisible()
    expect(header.compareDocumentPosition(investigationDetails) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(within(header).queryByText(/^Drought tolerance/)).not.toBeInTheDocument()
    expect(within(dashboard).queryByRole('region', { name: 'ARC-Details' })).not.toBeInTheDocument()
    expect(within(dashboard).queryByRole('tab', { name: /^Versions/ })).not.toBeInTheDocument()
    expect(within(investigationDetails).getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true')
    expect(within(investigationDetails).getByRole('region', { name: 'ARC overview' })).toBeVisible()
    expect(investigationDetails.parentElement).toHaveClass('dashlet')
    expect(arcWebView.parentElement).toHaveClass('dashlet')
    expect(within(investigationDetails).getAllByRole('tab')).toHaveLength(9)
    expect(dashboard.querySelector('.dashboard-window-bar')).not.toBeInTheDocument()
    expect(within(header).getByRole('heading', { level: 1, name: 'Facultative CAM in Talinum triangulare' })).toBeVisible()
    expect(within(header).queryByText('ARC', { exact: true })).not.toBeInTheDocument()
    expect(within(investigationDetails).queryByRole('navigation', { name: 'DataHub links' })).not.toBeInTheDocument()
  })
  it.each([
    { visibility: 'private' as const, label: 'Private ARC' },
    { visibility: 'public' as const, label: 'Public ARC' },
  ])('shows $label from caller-supplied DataHub data', async ({ visibility, label }) => {
    await renderDetails({ dataHubData: { versions: [], visibility } })
    expect(screen.getByRole('img', { name: label })).toBeVisible()
  })

  it('shows contacts and publications in separate tabs without expansion controls', async () => {
    const user = await renderDetails()
    await user.click(screen.getByRole('tab', { name: /^Contacts/ }))
    expect(screen.queryByRole('button', { name: 'Show more' })).not.toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Public ARC' })).toBeVisible()
    expect(screen.getByRole('tab', { name: /^Contacts/ })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: /^Contacts/ })).toHaveAccessibleName('Contacts (12)')
    expect(screen.queryByRole('heading', { name: /^Contacts/ })).not.toBeInTheDocument()
    const contacts = screen.getByRole('region', { name: /^Contacts/ })
    expect(within(contacts).getByText('All people associated with this ARC.')).toBeVisible()
    expect(within(contacts).getAllByRole('listitem')).toHaveLength(12)
    expect(contacts.closest('details')).toBeNull()
    expect(screen.queryByRole('heading', { name: /^Publications/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'ARC contents' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'GitHub links' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: /^Publications/ }))
    const publications = screen.getByRole('region', { name: /^Publications/ })
    expect(within(publications).queryByRole('heading', { name: /^Publications/ })).not.toBeInTheDocument()
    expect(within(publications).getByText('Publications associated with this ARC.')).toBeVisible()
    expect(screen.getByRole('tab', { name: /^Publications/ })).toHaveAccessibleName('Publications (2)')
    expect(publications.closest('details')).toBeNull()
    expect(within(publications).getByRole('link', { name: /^Reversible Burst/ })).toHaveAttribute('href', 'https://doi.org/10.1104/pp.15.01076')
    expect(within(publications).getAllByRole('listitem')).toHaveLength(2)
    expect(within(publications).getAllByRole('img', { name: /Publication status: published/i })).toHaveLength(2)
    await user.click(screen.getByRole('tab', { name: /^Contacts/ }))
    expect(screen.getByRole('region', { name: /^Contacts/ })).toBeVisible()
  })

  it('keeps DataHub links in the header before the overview previews', async () => {
    await renderDetails({ repository, dataHubLinks: [{ name: 'Related ARC', url: 'https://gitlab.example/research/related' }] })
    const links = screen.getByRole('navigation', { name: 'DataHub links' })
    expect(within(links).getByRole('link', { name: repository.projectPath })).toHaveAttribute('href', 'https://gitlab.example/research/talinum')
    expect(within(links).getByRole('link', { name: 'Related ARC' })).toHaveAttribute('href', 'https://gitlab.example/research/related')
    expect(links.compareDocumentPosition(screen.getByRole('button', { name: 'View description' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('keeps the supplied owner below visibility and shows ARC affiliations in Organizations', async () => {
    const user = await renderDetails()
    const metadata = screen.getByRole('complementary', { name: 'ARC ownership and visibility' })
    const visibility = within(metadata).getByRole('img', { name: 'Public ARC' })
    const owner = within(metadata).getByRole('link', { name: 'Dominik Brilhaus' })
    expect(owner).toHaveAttribute('href', 'https://gitlab.example/brilator')
    expect(visibility.compareDocumentPosition(owner) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(within(metadata).queryByRole('list')).not.toBeInTheDocument()
    const tabs = screen.getAllByRole('tab')
    expect(tabs.map(tab => tab.textContent)).toEqual(['Overview', 'Description', 'Contacts (12)', 'Organizations (4)', 'Publications (2)', 'Assays (3)', 'Studies (2)', 'Runs (6)', 'Workflows (6)'])
    const organizationsTab = screen.getByRole('tab', { name: /^Organizations/ })
    expect(organizationsTab).toHaveAccessibleName('Organizations (4)')
    expect(screen.queryByRole('region', { name: 'Organizations' })).not.toBeInTheDocument()
    await user.click(organizationsTab)
    const organizationsPanel = screen.getByRole('region', { name: 'Organizations' })
    expect(organizationsTab).toHaveAttribute('aria-selected', 'true')
    expect(within(organizationsPanel).getByText('Affiliations recorded in this ARC.')).toBeVisible()
    const organizations = within(organizationsPanel).getByRole('list')
    expect(within(organizations).getAllByRole('listitem')).toHaveLength(4)
    expect(within(organizations).getByText('Cluster of Excellence on Plant Science (CEPLAS)')).toBeVisible()
    expect(within(organizations).getByText('Institute of Plant Biochemistry, HHU Düsseldorf')).toBeVisible()
    expect(organizationsPanel.closest('details')).toBeNull()
    await user.click(screen.getByRole('tab', { name: /^Contacts/ }))
    expect(screen.queryByRole('region', { name: 'Organizations' })).not.toBeInTheDocument()
  })

  it.each([{}, { repository }])('renders without optional DataHub data and never fetches it', async (props) => {
    await renderDetails(props)
    const unknown = screen.getByRole('img', { name: 'ARC visibility unknown' })
    expect(unknown).toHaveTextContent('?')
    expect(unknown).toHaveAttribute('title', 'ARC visibility unknown')
    expect(screen.getByText('Owner: unavailable')).toBeVisible()
    expect(screen.getByRole('region', { name: 'ARC overview' })).toBeVisible()
    expect(screen.queryByRole('tab', { name: /^Versions/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument()
  })

  it('supports switching to Organizations with the keyboard', async () => {
    const user = await renderDetails()
    screen.getByRole('tab', { name: /^Contacts/ }).focus()
    await user.keyboard('{ArrowRight}{Enter}')
    expect(screen.getByRole('tab', { name: /^Organizations/ })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('region', { name: 'Organizations' })).toBeVisible()
  })

  it('keeps repository and release links in the header, with GitHub links in the full Description view', () => {
    renderWithTheme(
      <>
        <InvestigationHeader
          title="Plant investigation"
          dataHubLinks={[{ name: 'DataHub repository', url: 'https://gitlab.example/research/plant-arc' }]}
          releaseLink={{ name: 'v2.0', url: 'https://gitlab.example/research/plant-arc/-/releases/v2.0' }}
          archiveSizeBytes={2048}
        />
        <InvestigationDescription metadata={{
          identifier: 'plant-arc',
          description: 'Plant growth measurements.',
          githubLinks: [{ name: 'Analysis workflow', url: 'https://github.com/research/workflow' }],
        }} />
      </>,
    )
    const dataHubLinks = screen.getByRole('navigation', { name: 'DataHub links' })
    const githubLinks = screen.getByRole('navigation', { name: 'GitHub links' })
    const arcRelease = screen.getByRole('navigation', { name: 'ARC release' })
    expect(dataHubLinks.compareDocumentPosition(arcRelease) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(arcRelease.compareDocumentPosition(githubLinks) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(githubLinks.compareDocumentPosition(screen.getByText('Plant growth measurements.')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    const description = screen.getByRole('region', { name: 'ARC description' })
    expect(within(description).getByText('plant-arc')).toBeVisible()
    expect(within(description).getByRole('link', { name: 'Analysis workflow' })).toHaveAttribute('href', 'https://github.com/research/workflow')
    expect(within(dataHubLinks.closest('header')!).queryByRole('navigation', { name: 'GitHub links' })).not.toBeInTheDocument()
  })

  it('shows the latest release and archive size below the owner, without a Versions tab', async () => {
    await renderDetails({
      dataHubData: {
        ...dataHubData,
        versions: [release, {
          tag: 'draft', name: 'draft', kind: 'tag', commit: release.commit,
          url: 'https://gitlab.example/research/talinum/-/tags/draft', archiveSizeBytes: 2048,
        }],
        latestReleaseArchiveSizeBytes: 3072,
      },
    })
    const headerRelease = screen.getByRole('navigation', { name: 'ARC release' })
    const versionLink = within(headerRelease).getByRole('link', { name: 'v1.0' })
    expect(versionLink).toHaveAttribute('href', release.url)
    expect(within(headerRelease).queryByText('ARC size: 3 KiB')).not.toBeInTheDocument()
    const headerMetadata = screen.getByRole('complementary', { name: 'ARC ownership and visibility' })
    const size = within(headerMetadata).getByText('ARC size: 3 KiB')
    const owner = within(headerMetadata).getByRole('link', { name: 'Dominik Brilhaus' })
    expect(owner.compareDocumentPosition(size) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.queryByRole('tab', { name: /^Versions/ })).not.toBeInTheDocument()
  })

  it('shows unavailable sizes when the caller supplies no archive sizes', async () => {
    await renderDetails({ dataHubData: { versions: [release] } })
    expect(within(screen.getByRole('complementary', { name: 'ARC ownership and visibility' })).getByText('ARC size: unavailable')).toBeVisible()
  })

  it('returns to Overview after browsing Contacts and shows the description preview', async () => {
    const user = await renderDetails()
    await user.click(screen.getByRole('tab', { name: /^Contacts/ }))
    expect(screen.queryByRole('region', { name: 'ARC overview' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: 'Overview' }))
    expect(within(screen.getByRole('button', { name: 'View description' })).getByText(/^Drought tolerance/)).toBeVisible()
  })
})
