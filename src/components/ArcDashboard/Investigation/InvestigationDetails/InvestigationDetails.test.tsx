import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { sampleCrateSource } from '../../../../../tests/helpers/sampleCrate'
import { ArcProvider } from '../../../../arc/ArcProvider'
import { createArcStore } from '../../../../arc/arcStore'
import type { ArcRepositoryOverview, ArcRepositoryVersion } from '../../../../api/gitlab'
import { renderWithTheme } from '../../../../test/helpers'
import { InvestigationHeader } from '../InvestigationHeader'
import { InvestigationDetails, type InvestigationDetailsProps } from './InvestigationDetails'

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

async function renderDetails(props: InvestigationDetailsProps = { repository, dataHubData }) {
  const store = createArcStore(sampleCrateSource())
  await store.load()
  renderWithTheme(<ArcProvider store={store}><InvestigationDetails {...props} /></ArcProvider>)
  return userEvent.setup()
}

describe('Investigation Details', () => {
  it.each([
    { visibility: 'private' as const, label: 'Private ARC' },
    { visibility: 'public' as const, label: 'Public ARC' },
  ])('shows $label from caller-supplied DataHub data', async ({ visibility, label }) => {
    await renderDetails({ dataHubData: { versions: [], visibility } })
    expect(screen.getByRole('img', { name: label })).toBeVisible()
  })

  it('shows contacts on the main tab and publications on their own tab without expansion controls', async () => {
    const user = await renderDetails()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Facultative CAM in Talinum triangulare')
    expect(screen.getByRole('img', { name: 'Public ARC' })).toBeVisible()
    expect(screen.getByRole('tab', { name: /^Contacts/ })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: /^Contacts/ })).toHaveAccessibleName(/12/)
    expect(screen.queryByRole('heading', { name: /^Contacts/ })).not.toBeInTheDocument()
    const contacts = screen.getByRole('region', { name: /^Contacts/ })
    expect(within(contacts).getAllByRole('listitem')).toHaveLength(12)
    expect(contacts.closest('details')).toBeNull()
    expect(screen.queryByRole('heading', { name: /^Publications/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'ARC contents' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'GitHub links' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: /^Publications/ }))
    const publications = screen.getByRole('region', { name: /^Publications/ })
    expect(publications.closest('details')).toBeNull()
    expect(within(publications).getByRole('link', { name: /^Reversible Burst/ })).toHaveAttribute('href', 'https://doi.org/10.1104/pp.15.01076')
    expect(within(publications).getAllByRole('listitem')).toHaveLength(2)
    expect(within(publications).getAllByRole('img', { name: /Publication status: published/i })).toHaveLength(2)
    await user.click(screen.getByRole('tab', { name: /^Contacts/ }))
    expect(screen.getByRole('region', { name: /^Contacts/ })).toBeVisible()
  })

  it('places DataHub links below the title and before the description', async () => {
    await renderDetails({ repository, dataHubLinks: [{ name: 'Related ARC', url: 'https://gitlab.example/research/related' }] })
    const title = screen.getByRole('heading', { level: 1 })
    const links = screen.getByRole('navigation', { name: 'DataHub links' })
    expect(within(links).getByRole('link', { name: repository.projectPath })).toHaveAttribute('href', 'https://gitlab.example/research/talinum')
    expect(within(links).getByRole('link', { name: 'Related ARC' })).toHaveAttribute('href', 'https://gitlab.example/research/related')
    expect(title.compareDocumentPosition(links) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(links.compareDocumentPosition(screen.getByText(/^Drought tolerance is a key factor/)) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('keeps the supplied owner below visibility and shows ARC affiliations in the second tab', async () => {
    const user = await renderDetails()
    const metadata = screen.getByRole('complementary', { name: 'ARC ownership and visibility' })
    const visibility = within(metadata).getByRole('img', { name: 'Public ARC' })
    const owner = within(metadata).getByRole('link', { name: 'Dominik Brilhaus' })
    expect(owner).toHaveAttribute('href', 'https://gitlab.example/brilator')
    expect(visibility.compareDocumentPosition(owner) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(within(metadata).queryByRole('list')).not.toBeInTheDocument()
    const tabs = screen.getAllByRole('tab')
    expect(tabs.map(tab => tab.textContent?.split(/\d/)[0])).toEqual(['Contacts', 'Organizations', 'Publications', 'Versions'])
    const organizationsTab = screen.getByRole('tab', { name: /^Organizations/ })
    expect(organizationsTab).toHaveAccessibleName(/4/)
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
    const user = await renderDetails(props)
    const unknown = screen.getByRole('img', { name: 'ARC visibility unknown' })
    expect(unknown).toHaveTextContent('?')
    expect(unknown).toHaveAttribute('title', 'ARC visibility unknown')
    expect(screen.queryByText('Owner')).not.toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: 'Versions' }))
    expect(screen.getByText('Version information unavailable.')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument()
  })

  it('supports switching to Organizations with the keyboard', async () => {
    const user = await renderDetails()
    screen.getByRole('tab', { name: /^Contacts/ }).focus()
    await user.keyboard('{ArrowRight}{Enter}')
    expect(screen.getByRole('tab', { name: /^Organizations/ })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('region', { name: 'Organizations' })).toBeVisible()
  })

  it('places DataHub links above GitHub links, with both above the description', () => {
    renderWithTheme(
      <InvestigationHeader
        identifier="plant-arc"
        title="Plant investigation"
        description="Plant growth measurements."
        dataHubLinks={[{ name: 'DataHub repository', url: 'https://gitlab.example/research/plant-arc' }]}
        releaseLink={{ name: 'v2.0', url: 'https://gitlab.example/research/plant-arc/-/releases/v2.0' }}
        archiveSizeBytes={2048}
        githubLinks={[{ name: 'Analysis workflow', url: 'https://github.com/research/workflow' }]}
      />,
    )
    const title = screen.getByRole('heading', { level: 1 })
    const dataHubLinks = screen.getByRole('navigation', { name: 'DataHub links' })
    const githubLinks = screen.getByRole('navigation', { name: 'GitHub links' })
    const arcRelease = screen.getByRole('navigation', { name: 'ARC release' })
    expect(title.compareDocumentPosition(dataHubLinks) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(dataHubLinks.compareDocumentPosition(arcRelease) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(arcRelease.compareDocumentPosition(githubLinks) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(githubLinks.compareDocumentPosition(screen.getByText('Plant growth measurements.')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('renders supplied releases, tags, and their archive sizes without network requests', async () => {
    const user = await renderDetails({
      dataHubData: {
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
    const size = within(headerRelease).getByText('Archive size: 3 KiB')
    expect(versionLink.compareDocumentPosition(size) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    await user.click(screen.getByRole('tab', { name: 'Versions' }))
    const versions = screen.getByRole('region', { name: /^Versions/ })
    expect(within(versions).getAllByRole('listitem')).toHaveLength(2)
    expect(within(versions).getByRole('link', { name: 'Talinum release' })).toHaveAttribute('href', release.url)
    expect(within(versions).getByText('Curated ARC metadata')).toBeVisible()
    expect(within(versions).getByText('Archive size: 3 KiB')).toBeVisible()
    const tagLink = within(versions).getByRole('link', { name: 'draft' })
    expect(tagLink).toHaveAttribute('href', 'https://gitlab.example/research/talinum/-/tags/draft')
    const tagSize = within(tagLink.closest('li')!).getByText('Archive size: 2 KiB')
    expect(tagLink.compareDocumentPosition(tagSize) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('shows unavailable sizes when the caller supplies no archive sizes', async () => {
    const user = await renderDetails({ dataHubData: { versions: [release] } })
    expect(within(screen.getByRole('navigation', { name: 'ARC release' })).getByText('Archive size unavailable')).toBeVisible()
    await user.click(screen.getByRole('tab', { name: 'Versions' }))
    expect(within(screen.getByRole('region', { name: /^Versions/ })).getByText('Archive size unavailable')).toBeVisible()
  })

  it('shows an empty history when the caller supplies an empty versions list', async () => {
    const user = await renderDetails()
    await user.click(screen.getByRole('tab', { name: 'Versions' }))
    expect(screen.getByText('No releases or tags have been published for this ARC yet.')).toBeVisible()
  })
})
