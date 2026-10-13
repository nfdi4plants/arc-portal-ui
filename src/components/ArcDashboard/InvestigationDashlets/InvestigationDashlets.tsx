import { Text } from '@primer/react'
import { lazy, Suspense } from 'react'
import { PopupDashlet } from '../../PopupDashlet'
import { ContactList } from '../Investigation/ContactList'
import { InvestigationDescription } from '../Investigation/InvestigationDetails/InvestigationDescription'
import { NamedEntityList } from '../Investigation/InvestigationDetails/NamedEntityList'
import { OrganizationList } from '../Investigation/OrganizationList'
import { PublicationList } from '../Investigation/PublicationList'
import type { InvestigationMetadata } from '../Investigation/types'
import '../Investigation/InvestigationDetails/investigationDetails.css'
import './investigationDashlets.css'

const ArcViewer = lazy(() => import('../ArcViewer/ArcViewer'))

export function InvestigationDashlets({ metadata, arcJson, classNamePrefix }: {
  metadata: InvestigationMetadata
  arcJson: string
  classNamePrefix: string
}) {
  const dashlets = [
    {
      id: 'description', title: 'Description',
      description: 'Investigation description, ARC identifier, and related analysis links.',
      content: <InvestigationDescription metadata={metadata} />,
    },
    {
      id: 'contacts', title: 'Contacts',
      description: 'People associated with this ARC and their involvement in its studies and assays.',
      content: <ContactList contacts={metadata.contacts} showHeading={false} description="All people associated with this ARC." />,
    },
    {
      id: 'organizations', title: 'Organizations',
      description: 'Organization affiliations recorded for the people in this ARC.',
      content: <OrganizationList organizations={metadata.organizations} />,
    },
    {
      id: 'publications', title: 'Publications',
      description: 'Related publications, authors, publication status, and DOI links.',
      content: <PublicationList publications={metadata.publications} showHeading={false} description="Publications associated with this ARC." />,
    },
    {
      id: 'assays', title: 'Assays',
      description: 'Experimental assays and measurement workflows recorded in this ARC.',
      content: <NamedEntityList title="Assays" items={metadata.assays} />,
    },
    {
      id: 'studies', title: 'Studies',
      description: 'Studies and sample collections recorded in this ARC.',
      content: <NamedEntityList title="Studies" items={metadata.studies} />,
    },
    {
      id: 'webview', title: 'Webview',
      description: "Browse the ARC's files, metadata, and annotation tables.",
      content: <Suspense fallback={<Text as="p" role="status">Loading ARC viewer…</Text>}><ArcViewer jsonString={arcJson} embedded /></Suspense>,
    },
  ]

  return dashlets.map(({ id, title, description, content }) => (
    <PopupDashlet
      key={id}
      title={title}
      description={description}
      label={title === 'Description' ? title : `${title} dashlet`}
      className={`investigation-dashlet ${classNamePrefix}-tile ${classNamePrefix}-${id}`}
    >
      {content}
    </PopupDashlet>
  ))
}
