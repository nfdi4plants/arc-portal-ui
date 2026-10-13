import { UnderlinePanels } from '@primer/react/experimental'
import { useRef, useState } from 'react'
import { ContactList } from '../ContactList'
import { OrganizationList } from '../OrganizationList'
import { PublicationList } from '../PublicationList'
import type { InvestigationMetadata } from '../types'
import { InvestigationOverview, type OverviewTab } from './InvestigationOverview'
import { InvestigationDescription } from './InvestigationDescription'
import { NamedEntityList } from './NamedEntityList'
import '../investigation.css'
import './investigationDetails.css'

export interface InvestigationDetailsProps {
  metadata: InvestigationMetadata
}

export function InvestigationDetails({ metadata }: InvestigationDetailsProps) {
  const [activeTab, setActiveTab] = useState('overview')
  const root = useRef<HTMLDivElement>(null)
  const navigateFromOverview = (tab: OverviewTab) => {
    setActiveTab(tab)
    requestAnimationFrame(() => root.current?.querySelector<HTMLButtonElement>('[role="tab"][aria-selected="true"]')?.focus())
  }

  return (
    <div className="investigation-details" ref={root}>
      <div className="investigation-details-tab-layout">
        <UnderlinePanels
          aria-label="Investigation details"
          className="investigation-details-tabs"
          value={activeTab}
          onChange={({ value }) => setActiveTab(value)}
          activationMode="manual"
        >
          <UnderlinePanels.Tab value="overview">Overview</UnderlinePanels.Tab>
          <UnderlinePanels.Tab value="description">Description</UnderlinePanels.Tab>
          <UnderlinePanels.Tab value="contacts">Contacts</UnderlinePanels.Tab>
          <UnderlinePanels.Tab value="organizations">Organizations</UnderlinePanels.Tab>
          <UnderlinePanels.Tab value="publications">Publications</UnderlinePanels.Tab>
          <UnderlinePanels.Tab value="assays">Assays</UnderlinePanels.Tab>
          <UnderlinePanels.Tab value="studies">Studies</UnderlinePanels.Tab>
          <UnderlinePanels.Panel value="overview" className="investigation-details-panel" aria-hidden={activeTab !== 'overview'} inert={activeTab !== 'overview'}>
            <InvestigationOverview metadata={metadata} onNavigate={navigateFromOverview} />
          </UnderlinePanels.Panel>
          <UnderlinePanels.Panel value="description" className="investigation-details-panel" aria-hidden={activeTab !== 'description'} inert={activeTab !== 'description'}>
            <InvestigationDescription metadata={metadata} />
          </UnderlinePanels.Panel>
          <UnderlinePanels.Panel value="contacts" className="investigation-details-panel" aria-hidden={activeTab !== 'contacts'} inert={activeTab !== 'contacts'}>
            <ContactList contacts={metadata.contacts} showHeading={false} description="All people associated with this ARC." />
          </UnderlinePanels.Panel>
          <UnderlinePanels.Panel value="organizations" className="investigation-details-panel" aria-hidden={activeTab !== 'organizations'} inert={activeTab !== 'organizations'}>
            <OrganizationList organizations={metadata.organizations} />
          </UnderlinePanels.Panel>
          <UnderlinePanels.Panel value="publications" className="investigation-details-panel" aria-hidden={activeTab !== 'publications'} inert={activeTab !== 'publications'}>
            <PublicationList publications={metadata.publications} showHeading={false} description="Publications associated with this ARC." />
          </UnderlinePanels.Panel>
          <UnderlinePanels.Panel value="assays" className="investigation-details-panel" aria-hidden={activeTab !== 'assays'} inert={activeTab !== 'assays'}>
            <NamedEntityList title="Assays" items={metadata.assays} />
          </UnderlinePanels.Panel>
          <UnderlinePanels.Panel value="studies" className="investigation-details-panel" aria-hidden={activeTab !== 'studies'} inert={activeTab !== 'studies'}>
            <NamedEntityList title="Studies" items={metadata.studies} />
          </UnderlinePanels.Panel>
        </UnderlinePanels>
      </div>
    </div>
  )
}
