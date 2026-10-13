import { UnderlinePanels } from '@primer/react/experimental'
import { useState } from 'react'
import { ContactList } from '../ContactList'
import { OrganizationList } from '../OrganizationList'
import { PublicationList } from '../PublicationList'
import type { InvestigationMetadata } from '../types'
import { InvestigationOverview } from './InvestigationOverview'
import '../investigation.css'
import './investigationDetails.css'

export interface InvestigationDetailsProps {
  metadata: InvestigationMetadata
}

export function InvestigationDetails({ metadata }: InvestigationDetailsProps) {
  const [activeTab, setActiveTab] = useState('overview')

  return (
    <div className="investigation-details">
      <div className="investigation-details-tab-layout">
        <UnderlinePanels
          aria-label="Investigation details"
          className="investigation-details-tabs"
          value={activeTab}
          onChange={({ value }) => setActiveTab(value)}
          activationMode="manual"
        >
          <UnderlinePanels.Tab value="overview">Overview</UnderlinePanels.Tab>
          <UnderlinePanels.Tab value="contacts" counter={metadata.contacts.length}>Contacts</UnderlinePanels.Tab>
          <UnderlinePanels.Tab value="organizations" counter={metadata.organizations.length}>Organizations</UnderlinePanels.Tab>
          <UnderlinePanels.Tab value="publications" counter={metadata.publications.length}>Publications</UnderlinePanels.Tab>
          <UnderlinePanels.Panel value="overview" className="investigation-details-panel" aria-hidden={activeTab !== 'overview'} inert={activeTab !== 'overview'}>
            <InvestigationOverview metadata={metadata} />
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
        </UnderlinePanels>
      </div>
    </div>
  )
}
