import { GraphIcon } from '@primer/octicons-react'
import { ArcDashboardFrame } from '../ArcDashboardFrame'
import { ArcDetails } from '../ArcDetails'
import type { DashboardContentProps, DashboardProps } from '../dashboardTypes'
import { InvestigationDashlets } from '../InvestigationDashlets/InvestigationDashlets'
import { PopupGraphview } from '../Provenance/PopupGraphview'
import '../Investigation/InvestigationDetails/investigationDetails.css'
import './newDashboard.css'

export type NewDashboardProps = DashboardProps

export function NewDashboardContent({ metadata, provenance, actions, ...props }: DashboardContentProps) {
  return (
    <main className="new-dashboard">
      {actions && <div className="new-dashboard-actions">{actions}</div>}
      <div className="new-dashboard-orbit">
        <div className="new-dashboard-hub">
          <ArcDetails {...props} metadata={metadata} />
        </div>
        <InvestigationDashlets metadata={metadata} arcJson={props.arcJson} classNamePrefix="new-dashboard" />
        <PopupGraphview index={provenance} symbol={<GraphIcon size={48} />} label="Graphview dashlet" className="new-dashboard-tile new-dashboard-graphview" />
      </div>
    </main>
  )
}

export function NewDashboard(props: NewDashboardProps) {
  return <ArcDashboardFrame {...props} label="NewDashboard" fillHeight content={NewDashboardContent} />
}
