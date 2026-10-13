import { Text } from '@primer/react'
import { BeakerIcon, BookIcon, BrowserIcon, DatabaseIcon, FileIcon, OrganizationIcon, PeopleIcon } from '@primer/octicons-react'
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
      symbol: <FileIcon size={48} />,
      description: 'Investigation description, ARC identifier, and related analysis links.',
      content: <InvestigationDescription metadata={metadata} />,
    },
    {
      id: 'contacts', title: 'Contacts',
      symbol: <PeopleIcon size={48} />,
      description: 'People associated with this ARC and their involvement in its studies and assays.',
      content: <ContactList contacts={metadata.contacts} showHeading={false} description="All people associated with this ARC." />,
    },
    {
      id: 'organizations', title: 'Organizations',
      symbol: <OrganizationIcon size={48} />,
      description: 'Organization affiliations recorded for the people in this ARC.',
      content: <OrganizationList organizations={metadata.organizations} />,
    },
    {
      id: 'publications', title: 'Publications',
      symbol: <BookIcon size={48} />,
      description: 'Related publications, authors, publication status, and DOI links.',
      content: <PublicationList publications={metadata.publications} showHeading={false} description="Publications associated with this ARC." />,
    },
    {
      id: 'assays', title: 'Assays',
      symbol: <BeakerIcon size={48} />,
      description: 'Experimental assays and measurement workflows recorded in this ARC.',
      content: <NamedEntityList title="Assays" items={metadata.assays} />,
    },
    {
      id: 'studies', title: 'Studies',
      symbol: <DatabaseIcon size={48} />,
      description: 'Studies and sample collections recorded in this ARC.',
      content: <NamedEntityList title="Studies" items={metadata.studies} />,
    },
    {
      id: 'webview', title: 'Webview',
      symbol: <BrowserIcon size={48} />,
      description: "Browse the ARC's files, metadata, and annotation tables.",
      content: <Suspense fallback={<Text as="p" role="status">Loading ARC viewer…</Text>}><ArcViewer jsonString={arcJson} embedded /></Suspense>,
    },
  ]

  return dashlets.map(({ id, title, description, symbol, content }) => (
    <PopupDashlet
      key={id}
      title={title}
      description={description}
      symbol={symbol}
      label={title === 'Description' ? title : `${title} dashlet`}
      className={`investigation-dashlet ${classNamePrefix}-tile ${classNamePrefix}-${id}`}
    >
      {content}
    </PopupDashlet>
  ))
}
