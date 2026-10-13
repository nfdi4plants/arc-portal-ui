import { ArcDashboardFrame } from '../ArcDashboardFrame'
import { ArcDetails } from '../ArcDetails'
import type { DashboardContentProps, DashboardProps } from '../dashboardTypes'
import { InvestigationDashlets } from '../InvestigationDashlets/InvestigationDashlets'
import { investigationDetailIds } from '../InvestigationDashlets/investigationDashletOptions'
import { ViewerWorkspace } from '../ViewerWorkspace/ViewerWorkspace'
import '../viewerDashboard.css'
import './splitDashboard.css'

export type SplitDashboardProps = DashboardProps

export function SplitDashboardContent({ metadata, provenance, actions, ...props }: DashboardContentProps) {
  return (
    <main className="viewer-dashboard split-dashboard">
      {actions && <div className="viewer-dashboard-actions split-dashboard-actions">{actions}</div>}
      <ArcDetails {...props} metadata={metadata} />
      <nav className="split-dashboard-metadata" aria-label="Investigation dashlets">
        <InvestigationDashlets metadata={metadata} arcJson={props.arcJson} classNamePrefix="split-dashboard" ids={investigationDetailIds} />
      </nav>
      <ViewerWorkspace metadata={metadata} provenance={provenance} arcJson={props.arcJson} />
    </main>
  )
}

export function SplitDashboard(props: SplitDashboardProps) {
  return <ArcDashboardFrame {...props} label="SplitDashboard" content={SplitDashboardContent} />
}
