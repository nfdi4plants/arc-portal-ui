import { Text } from '@primer/react'
import { ArcDashboardFrame } from '../ArcDashboardFrame'
import { ArcDetails } from '../ArcDetails'
import type { DashboardContentProps, DashboardProps } from '../dashboardTypes'
import { InvestigationDashlets } from '../InvestigationDashlets/InvestigationDashlets'
import { PopupGraphview } from '../Provenance/PopupGraphview'
import './stackedDashboard.css'

export type StackedDashboardProps = DashboardProps

export function StackedDashboardContent({ metadata, provenance, actions, ...props }: DashboardContentProps) {
  return (
    <main className="stacked-dashboard">
      {actions && <div className="stacked-dashboard-actions">{actions}</div>}
      <ArcDetails {...props} metadata={metadata} />
      <div className="stacked-dashboard-body">
        <aside className="stacked-dashboard-cards" aria-label="Investigation dashlets">
          <InvestigationDashlets metadata={metadata} arcJson={props.arcJson} classNamePrefix="stacked-dashboard" />
        </aside>
        {provenance ? (
          <PopupGraphview
            index={provenance}
            className="stacked-dashboard-graphview"
            showHeader={false}
            expandOnClick={false}
          />
        ) : (
          <section className="stacked-dashboard-graphview" aria-label="Graphview"><Text as="p">No provenance data available.</Text></section>
        )}
      </div>
    </main>
  )
}

export function StackedDashboard(props: StackedDashboardProps) {
  return <ArcDashboardFrame {...props} label="StackedDashboard" content={StackedDashboardContent} />
}
