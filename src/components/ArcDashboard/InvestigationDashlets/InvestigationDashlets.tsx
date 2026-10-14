import { dataHubRepositoryUrl } from '../../../api/gitlab'
import type { DashboardProps } from '../dashboardTypes'
import { AnchoredOverlay, CounterLabel } from '@primer/react'
import { TriangleDownIcon, PlayIcon, WorkflowIcon, BeakerIcon, BookIcon, BrowserIcon, DatabaseIcon, FileIcon, OrganizationIcon, PeopleIcon } from '@primer/octicons-react'
import { lazy, Suspense, useState, type RefObject } from 'react'
import { PopupDashlet } from '../../PopupDashlet'
import { ArcMageLoading } from '../ArcMage'
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

export function InvestigationDashlets({ metadata, arcJson, repository, repositoryUrl, token, classNamePrefix, ids, folderRequest, onNavigateFolder, presentation = 'popup', interactive = false, collapsed, onToggleCollapsed, externalPopup }: Pick<DashboardProps, 'repository' | 'repositoryUrl' | 'token'> & {
  folderRequest?: { path: string }
  onNavigateFolder?: (path: string) => void
  metadata: InvestigationMetadata
  arcJson: string
  classNamePrefix: string
  ids?: readonly InvestigationDashletId[]
  presentation?: 'popup' | 'dropdown'
  interactive?: boolean
  collapsed?: boolean
  onToggleCollapsed?: () => void
  externalPopup?: {
    activeId: InvestigationDashletId | null
    onClose: () => void
    returnFocusRef: RefObject<HTMLElement | null>
  }
}) {
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)
  const selectFolder = onNavigateFolder ? (path: string) => {
    setOpenDropdown(null)
    onNavigateFolder(path)
  } : undefined
  const dashlets = [
    {
      id: 'description', title: investigationDashletTitles.description,
      symbol: <FileIcon size={48} />,
      description: 'Investigation description, ARC identifier, and related analysis links.',
      content: <InvestigationDescription metadata={metadata} />,
    },
    {
      id: 'contacts', count: metadata.contacts.length, title: `${investigationDashletTitles.contacts} (${metadata.contacts.length})`,
      symbol: <PeopleIcon size={48} />,
      description: 'People associated with this ARC and their involvement in its studies and assays.',
      content: <ContactList contacts={metadata.contacts} showHeading={false} description="All people associated with this ARC." />,
    },
    {
      id: 'organizations', count: metadata.organizations.length, title: `${investigationDashletTitles.organizations} (${metadata.organizations.length})`,
      symbol: <OrganizationIcon size={48} />,
      description: 'Organization affiliations recorded for the people in this ARC.',
      content: <OrganizationList organizations={metadata.organizations} />,
    },
    {
      id: 'publications', count: metadata.publications.length, title: `${investigationDashletTitles.publications} (${metadata.publications.length})`,
      symbol: <BookIcon size={48} />,
      description: 'Related publications, authors, publication status, and DOI links.',
      content: <PublicationList publications={metadata.publications} showHeading={false} description="Publications associated with this ARC." />,
    },
    {
      id: 'assays', count: metadata.assays.length, title: `${investigationDashletTitles.assays} (${metadata.assays.length})`,
      symbol: <BeakerIcon size={48} />,
      description: 'Experimental assays and measurement workflows recorded in this ARC.',
      content: <NamedEntityList title="Assays" items={metadata.assays} onSelect={selectFolder ? item => selectFolder(`assays/${item.identifier}`) : undefined} />,
    },
    {
      id: 'studies', count: metadata.studies.length, title: `${investigationDashletTitles.studies} (${metadata.studies.length})`,
      symbol: <DatabaseIcon size={48} />,
      description: 'Studies and sample collections recorded in this ARC.',
      content: <NamedEntityList title="Studies" items={metadata.studies} onSelect={selectFolder ? item => selectFolder(`studies/${item.identifier}`) : undefined} />,
    },
    {
      id: 'runs', count: metadata.runs.length, title: `${investigationDashletTitles.runs} (${metadata.runs.length})`,
      symbol: <PlayIcon size={48} />,
      description: 'Runs recorded in this ARC.',
      content: <NamedEntityList title="Runs" items={metadata.runs} onSelect={selectFolder ? item => selectFolder(`runs/${item.identifier}`) : undefined} />,
    },
    {
      id: 'workflows', count: metadata.workflows.length, title: `${investigationDashletTitles.workflows} (${metadata.workflows.length})`,
      symbol: <WorkflowIcon size={48} />,
      description: 'Workflows recorded in this ARC.',
      content: <NamedEntityList title="Workflows" items={metadata.workflows} onSelect={selectFolder ? item => selectFolder(`workflows/${item.identifier}`) : undefined} />,
    },
    {
      id: 'webview', title: investigationDashletTitles.webview,
      symbol: <BrowserIcon size={48} />,
      description: "Browse the ARC's files, metadata, and annotation tables.",
      content: <Suspense fallback={<ArcMageLoading label="Loading ARC viewer…" />}><ArcViewer folderRequest={folderRequest} jsonString={arcJson} repositoryUrl={repositoryUrl ?? (repository ? dataHubRepositoryUrl(repository) : undefined)} token={token} embedded /></Suspense>,
    },
  ]

  return dashlets.filter(({ id }) => !ids || ids.some(selected => selected === id)).map(({ id, title, count, description, symbol, content }) => presentation === 'dropdown' ? (
    <AnchoredOverlay
      key={id}
      open={openDropdown === id}
      onOpen={() => setOpenDropdown(id)}
      onClose={() => setOpenDropdown(null)}
      renderAnchor={anchorProps => <button {...anchorProps} type="button" className="investigation-dropdown-trigger" aria-label={title}>
        <span className="investigation-dropdown-label">
          {investigationDashletTitles[id as InvestigationDashletId]}
          {count !== undefined && <CounterLabel>{count}</CounterLabel>}
        </span>
        <TriangleDownIcon size={16} aria-hidden="true" />
      </button>}
      side="outside-bottom"
      align="start"
      width="large"
      overlayProps={{ role: 'dialog', 'aria-label': title }}
    >
      <div className="investigation-dropdown-content">{content}</div>
    </AnchoredOverlay>
  ) : (
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
