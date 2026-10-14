import { useState } from 'react'
import { ArcDetails } from '../../components/ArcDashboard/ArcDetails'
import type { DashboardContentProps } from '../../components/ArcDashboard/dashboardTypes'
import { InvestigationDashlets } from '../../components/ArcDashboard/InvestigationDashlets/InvestigationDashlets'
import { investigationDetailIds } from '../../components/ArcDashboard/InvestigationDashlets/investigationDashletOptions'
import { ViewerWorkspace } from '../../components/ArcDashboard/ViewerWorkspace/ViewerWorkspace'
import './viewerDashboard.css'
import './splitDashboard.css'
import './scrollingDashboard.css'

export function SplitDashboardLayout({ metadata, provenance, actions, scrolling = false, ...props }: DashboardContentProps & { scrolling?: boolean }) {
  const [folderRequest, setFolderRequest] = useState<{ path: string }>()
  const header = (
    <>
      {actions && <div className="viewer-dashboard-actions split-dashboard-actions">{actions}</div>}
      <ArcDetails {...props} metadata={metadata} />
      <nav className="split-dashboard-metadata" aria-label="Investigation dashlets">
        <InvestigationDashlets repository={props.repository} repositoryUrl={props.repositoryUrl} token={props.token} metadata={metadata} arcJson={props.arcJson} classNamePrefix="split-dashboard" ids={investigationDetailIds} presentation="dropdown" onNavigateFolder={path => setFolderRequest({ path })} />
      </nav>
    </>
  )

  return (
    <main className={`viewer-dashboard split-dashboard${scrolling ? ' scrolling-dashboard' : ''}`}>
      {scrolling ? <header className="scrolling-dashboard-header">{header}</header> : header}
      <ViewerWorkspace folderRequest={folderRequest} repository={props.repository} repositoryUrl={props.repositoryUrl} token={props.token} metadata={metadata} provenance={provenance} arcJson={props.arcJson} firstViewer="graphview" />
    </main>
  )
}
