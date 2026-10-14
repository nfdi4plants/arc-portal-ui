import { GraphIcon } from '@primer/octicons-react'
import { ArcDetails } from '../ArcDetails'
import type { DashboardContentProps } from '../dashboardTypes'
import { PopupArcGame } from '../Game/PopupArcGame'
import { InvestigationDashlets } from '../InvestigationDashlets/InvestigationDashlets'
import { PopupGraphview } from '../Provenance/PopupGraphview'
import '../Investigation/InvestigationDetails/investigationDetails.css'
import './newDashboard.css'

/** Circular ARC header surrounded by compact tiles that preview on hover and expand into resizable popups. */
export function NewDashboardContent({ metadata, provenance, actions, ...props }: DashboardContentProps) {
  return (
    <main className="new-dashboard">
      {actions && <div className="new-dashboard-actions">{actions}</div>}
      <div className="new-dashboard-orbit">
        <div className="new-dashboard-hub">
          <ArcDetails {...props} metadata={metadata} />
        </div>
        <InvestigationDashlets metadata={metadata} arcJson={props.arcJson} repositoryUrl={props.repositoryUrl} token={props.token} classNamePrefix="new-dashboard" />
        <PopupGraphview index={provenance} symbol={<GraphIcon size={48} />} label="Graphview dashlet" className="new-dashboard-tile new-dashboard-graphview" />
        <PopupArcGame index={provenance} arcTitle={metadata.title} label="ARCade dashlet" className="new-dashboard-tile new-dashboard-game" />
      </div>
    </main>
  )
}
