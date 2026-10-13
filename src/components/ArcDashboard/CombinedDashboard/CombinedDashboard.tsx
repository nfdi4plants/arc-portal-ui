import { ArcDashboardFrame } from '../ArcDashboardFrame'
import { ArcDetails } from '../ArcDetails'
import type { DashboardContentProps, DashboardProps } from '../dashboardTypes'
import { InvestigationDashlets } from '../InvestigationDashlets/InvestigationDashlets'
import { PopupGraphview } from '../Provenance/PopupGraphview'
import './combinedDashboard.css'

export type CombinedDashboardProps = DashboardProps

export function CombinedDashboardContent({ metadata, provenance, actions, ...props }: DashboardContentProps) {
  return (
    <main className="combined-dashboard">
      {actions && <div className="combined-dashboard-actions">{actions}</div>}
      <div className="combined-dashboard-layout">
        <div className="combined-dashboard-top">
          <div className="combined-dashboard-details">
            <ArcDetails {...props} metadata={metadata} />
            <section className="combined-dashboard-row" aria-label="Description, contacts, and organizations">
              <InvestigationDashlets metadata={metadata} arcJson={props.arcJson} classNamePrefix="combined-dashboard" ids={['description', 'contacts', 'organizations']} />
            </section>
            <section className="combined-dashboard-row" aria-label="Publications, assays, and studies">
              <InvestigationDashlets metadata={metadata} arcJson={props.arcJson} classNamePrefix="combined-dashboard" ids={['publications', 'assays', 'studies']} />
            </section>
          </div>
          <InvestigationDashlets metadata={metadata} arcJson={props.arcJson} classNamePrefix="combined-dashboard" ids={['webview']} interactive />
        </div>
        <PopupGraphview
          index={provenance}
          label="Graphview"
          className="combined-dashboard-graphview"
          expandOnClick={false}
        />
      </div>
    </main>
  )
}

export function CombinedDashboard(props: CombinedDashboardProps) {
  return <ArcDashboardFrame {...props} label="CombinedDashboard" content={CombinedDashboardContent} />
}
