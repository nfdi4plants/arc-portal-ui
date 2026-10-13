import { Banner, Spinner, Stack, Text } from '@primer/react'
import { UnderlinePanels } from '@primer/react/experimental'
import { useState } from 'react'
import { dataHubRepositoryUrl, type ArcRepositoryOverview, type DataHubRepository } from '../../../../api/gitlab'
import { useArcSelector, useArcStatus } from '../../../../arc/hooks'
import { ContactList } from '../ContactList'
import { InvestigationHeader } from '../InvestigationHeader'
import { InvestigationWindow } from '../InvestigationWindow'
import { PublicationList } from '../PublicationList'
import { selectInvestigationMetadata } from '../selectInvestigationMetadata'
import type { ExternalLink } from '../types'
import { ArcVersionList } from './ArcVersionList'
import '../investigation.css'
import './investigationDetails.css'

export interface InvestigationDetailsProps {
  repository?: DataHubRepository
  dataHubLinks?: ExternalLink[]
  /** DataHub metadata supplied by the caller; this component does not fetch it. */
  dataHubData?: ArcRepositoryOverview
}

export function InvestigationDetails({ repository, dataHubLinks, dataHubData }: InvestigationDetailsProps) {
  const status = useArcStatus()
  const metadata = useArcSelector(selectInvestigationMetadata)
  const [activeTab, setActiveTab] = useState('contacts')

  if (status.kind === 'error') {
    return (
      <InvestigationWindow title="Investigation Details">
        <div className="investigation-feedback">
          <Banner
            variant="critical"
            title="Could not load investigation"
            description={status.error instanceof Error ? status.error.message : String(status.error)}
          />
        </div>
      </InvestigationWindow>
    )
  }

  if (!metadata) {
    return (
      <InvestigationWindow title="Investigation Details">
        <Stack className="investigation-feedback" direction="horizontal" align="center" justify="center" gap="condensed" role="status">
          <Spinner size="large" />
          <Text as="span">Loading investigation…</Text>
        </Stack>
      </InvestigationWindow>
    )
  }

  const links = new Map((dataHubLinks ?? []).map((link) => [link.url, link]))
  if (repository) {
    const url = dataHubRepositoryUrl(repository)
    links.set(url, { name: repository.projectPath, url })
  }
  const latestRelease = dataHubData?.versions.find((version) => version.kind === 'release')
  const releaseLink = latestRelease
    ? { name: latestRelease.tag, url: latestRelease.url }
    : repository ? { name: 'View releases', url: `${dataHubRepositoryUrl(repository)}/-/releases` } : undefined

  return (
    <InvestigationWindow title="Investigation Details">
      <main className="investigation-page investigation-details">
        <InvestigationHeader
          identifier={metadata.identifier}
          title={metadata.title}
          description={metadata.description}
          visibility={dataHubData?.visibility}
          owner={dataHubData?.owner}
          dataHubLinks={[...links.values()]}
          githubLinks={metadata.githubLinks}
          releaseLink={releaseLink}
          archiveSizeBytes={latestRelease?.archiveSizeBytes ?? dataHubData?.latestReleaseArchiveSizeBytes}
        />
        <div className="investigation-details-tab-layout">
          <UnderlinePanels
            aria-label="Investigation details"
            className="investigation-details-tabs"
            value={activeTab}
            onChange={({ value }) => setActiveTab(value)}
            activationMode="manual"
          >
            <UnderlinePanels.Tab value="contacts" counter={metadata.contacts.length}>Contacts</UnderlinePanels.Tab>
            <UnderlinePanels.Tab value="organizations" counter={metadata.organizations.length}>Organizations</UnderlinePanels.Tab>
            <UnderlinePanels.Tab value="publications" counter={metadata.publications.length}>Publications</UnderlinePanels.Tab>
            <UnderlinePanels.Tab value="versions">Versions</UnderlinePanels.Tab>
            <UnderlinePanels.Panel value="contacts" className="investigation-details-panel" aria-hidden={activeTab !== 'contacts'} inert={activeTab !== 'contacts'}>
              <ContactList contacts={metadata.contacts} showHeading={false} />
            </UnderlinePanels.Panel>
            <UnderlinePanels.Panel value="organizations" className="investigation-details-panel" aria-hidden={activeTab !== 'organizations'} inert={activeTab !== 'organizations'}>
              <section className="metadata-card" aria-label="Organizations">
                {metadata.organizations.length > 0 ? (
                  <>
                    <Text as="p" className="investigation-organizations-intro">Affiliations recorded in this ARC.</Text>
                    <Stack as="ul" gap="normal" className="organization-list">
                      {metadata.organizations.map((organization) => <li key={organization.identifier}>{organization.name}</li>)}
                    </Stack>
                  </>
                ) : (
                  <Text as="p" className="empty-state">No organization affiliations in this ARC.</Text>
                )}
              </section>
            </UnderlinePanels.Panel>
            <UnderlinePanels.Panel value="publications" className="investigation-details-panel" aria-hidden={activeTab !== 'publications'} inert={activeTab !== 'publications'}>
              <PublicationList publications={metadata.publications} />
            </UnderlinePanels.Panel>
            <UnderlinePanels.Panel value="versions" className="investigation-details-panel" aria-hidden={activeTab !== 'versions'} inert={activeTab !== 'versions'}>
              <ArcVersionList dataHubData={dataHubData} />
            </UnderlinePanels.Panel>
          </UnderlinePanels>
        </div>
      </main>
    </InvestigationWindow>
  )
}
