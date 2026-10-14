import { Text } from '@primer/react'
import { PlayIcon, WorkflowIcon, BeakerIcon, BookIcon, BrowserIcon, DatabaseIcon, FileIcon, OrganizationIcon, PeopleIcon } from '@primer/octicons-react'
import { lazy, Suspense, type RefObject } from 'react'
import { PopupDashlet } from '../../PopupDashlet'
import { ContactList } from '../Investigation/ContactList'
import { InvestigationDescription } from '../Investigation/InvestigationDetails/InvestigationDescription'
import { NamedEntityList } from '../Investigation/InvestigationDetails/NamedEntityList'
import { OrganizationList } from '../Investigation/OrganizationList'
import { PublicationList } from '../Investigation/PublicationList'
import type { InvestigationMetadata } from '../Investigation/types'
import { investigationDashletTitles, type InvestigationDashletId } from './investigationDashletOptions'
import '../Investigation/InvestigationDetails/investigationDetails.css'
import './investigationDashlets.css'

const ArcViewer = lazy(() => import('../ArcViewer/ArcViewer'))

export type { InvestigationDashletId } from './investigationDashletOptions'

export function InvestigationDashlets({ metadata, arcJson, classNamePrefix, ids, interactive = false, collapsed, onToggleCollapsed, externalPopup }: {
  metadata: InvestigationMetadata
  arcJson: string
  classNamePrefix: string
  ids?: readonly InvestigationDashletId[]
  interactive?: boolean
  collapsed?: boolean
  onToggleCollapsed?: () => void
  externalPopup?: {
    activeId: InvestigationDashletId | null
    onClose: () => void
    returnFocusRef: RefObject<HTMLElement | null>
  }
}) {
  const dashlets = [
    {
      id: 'description', title: investigationDashletTitles.description,
      symbol: <FileIcon size={48} />,
      description: 'Investigation description, ARC identifier, and related analysis links.',
      content: <InvestigationDescription metadata={metadata} />,
    },
    {
      id: 'contacts', title: investigationDashletTitles.contacts,
      symbol: <PeopleIcon size={48} />,
      description: 'People associated with this ARC and their involvement in its studies and assays.',
      content: <ContactList contacts={metadata.contacts} showHeading={false} description="All people associated with this ARC." />,
    },
    {
      id: 'organizations', title: investigationDashletTitles.organizations,
      symbol: <OrganizationIcon size={48} />,
      description: 'Organization affiliations recorded for the people in this ARC.',
      content: <OrganizationList organizations={metadata.organizations} />,
    },
    {
      id: 'publications', title: `${investigationDashletTitles.publications} (${metadata.publications.length})`,
      symbol: <BookIcon size={48} />,
      description: 'Related publications, authors, publication status, and DOI links.',
      content: <PublicationList publications={metadata.publications} showHeading={false} description="Publications associated with this ARC." />,
    },
    {
      id: 'assays', title: `${investigationDashletTitles.assays} (${metadata.assays.length})`,
      symbol: <BeakerIcon size={48} />,
      description: 'Experimental assays and measurement workflows recorded in this ARC.',
      content: <NamedEntityList title="Assays" items={metadata.assays} />,
    },
    {
      id: 'studies', title: `${investigationDashletTitles.studies} (${metadata.studies.length})`,
      symbol: <DatabaseIcon size={48} />,
      description: 'Studies and sample collections recorded in this ARC.',
      content: <NamedEntityList title="Studies" items={metadata.studies} />,
    },
    {
      id: 'runs', title: `${investigationDashletTitles.runs} (${metadata.runs.length})`,
      symbol: <PlayIcon size={48} />,
      description: 'Runs recorded in this ARC.',
      content: <NamedEntityList title="Runs" items={metadata.runs} />,
    },
    {
      id: 'workflows', title: `${investigationDashletTitles.workflows} (${metadata.workflows.length})`,
      symbol: <WorkflowIcon size={48} />,
      description: 'Workflows recorded in this ARC.',
      content: <NamedEntityList title="Workflows" items={metadata.workflows} />,
    },
    {
      id: 'webview', title: investigationDashletTitles.webview,
      symbol: <BrowserIcon size={48} />,
      description: "Browse the ARC's files, metadata, and annotation tables.",
      content: <Suspense fallback={<Text as="p" role="status">Loading ARC viewer…</Text>}><ArcViewer jsonString={arcJson} embedded /></Suspense>,
    },
  ]

  return dashlets.filter(({ id }) => !ids || ids.some(selected => selected === id)).map(({ id, title, description, symbol, content }) => (
    <PopupDashlet
      key={id}
      title={title}
      description={description}
      symbol={interactive ? undefined : symbol}
      expandOnClick={!interactive}
      collapsed={collapsed}
      onToggleCollapsed={onToggleCollapsed}
      open={externalPopup ? externalPopup.activeId === id : undefined}
      onOpenChange={externalPopup ? open => { if (!open) externalPopup.onClose() } : undefined}
      returnFocusRef={externalPopup?.returnFocusRef}
      label={title === 'Description' ? title : `${title} dashlet`}
      className={`investigation-dashlet ${classNamePrefix}-tile ${classNamePrefix}-${id}`}
    >
      {content}
    </PopupDashlet>
  ))
}
