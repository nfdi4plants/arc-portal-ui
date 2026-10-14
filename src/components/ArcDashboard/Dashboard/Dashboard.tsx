import { ScreenFullIcon } from '@primer/octicons-react'
import { dataHubRepositoryUrl } from '../../../api/gitlab'
import { openInvestigationPopup } from '../Investigation/InvestigationDetails/InvestigationPopup'
import { openArcViewerPopup } from '../ArcViewer/ArcViewerPopup'
import { IconButton, Text } from '@primer/react'
import { lazy, Suspense } from 'react'
import { Dashlet } from '../../DashboardWindow'
import { ArcDashboardFrame } from '../ArcDashboardFrame'
import { ArcDetails } from '../ArcDetails'
import { InvestigationDetails } from '../Investigation/InvestigationDetails'
import { GraphviewDashlet } from '../Provenance/GraphviewDashlet'
import type { DashboardContentProps, DashboardProps } from '../dashboardTypes'
import '../Investigation/investigation.css'
import './dashboard.css'

const ArcViewer = lazy(() => import('../ArcViewer/ArcViewer'))

export type { DashboardProps } from '../dashboardTypes'

export function DashboardContent({ metadata, provenance, actions, ...props }: DashboardContentProps) {
  const repositoryUrl = props.repositoryUrl ?? (props.repository ? dataHubRepositoryUrl(props.repository) : undefined)
  return (
    <main className="arc-dashboard-layout">
      {actions && <div className="arc-dashboard-actions">{actions}</div>}
      <ArcDetails {...props} metadata={metadata} />
      <Dashlet label="Investigation details" actions={
        <IconButton icon={ScreenFullIcon} size="small" variant="invisible"
          aria-label="Open investigation details in popup"
          onClick={() => openInvestigationPopup(metadata)} />
      }>
        <InvestigationDetails metadata={metadata} />
      </Dashlet>
      <Dashlet label="ArcWebView" actions={
        <IconButton icon={ScreenFullIcon} size="small" variant="invisible"
          aria-label="Open ARC viewer in popup"
          onClick={() => openArcViewerPopup(props.arcJson, metadata.title, repositoryUrl, props.token)} />
      }>
        <Suspense fallback={<Text as="p" role="status">Loading ARC viewer…</Text>}>
          <ArcViewer jsonString={props.arcJson} repositoryUrl={repositoryUrl} token={props.token} embedded />
        </Suspense>
      </Dashlet>
      {provenance && <GraphviewDashlet index={provenance} />}
    </main>
  )
}

export function Dashboard(props: DashboardProps) {
  return <ArcDashboardFrame {...props} label="ARC-Dashboard" content={DashboardContent} />
}
