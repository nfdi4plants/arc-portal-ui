import { Banner, Spinner, Stack, Text } from '@primer/react'
import type { ReactNode } from 'react'
import { useArcSelector, useArcStatus } from '../../../arc/hooks'
import { buildProvenanceIndex } from '../../../arc/provenance/buildIndex'
import type { ProvenanceIndex } from '../../../arc/provenance/types'
import { DashboardWindow } from '../../DashboardWindow'
import { PopupDashlet } from '../../PopupDashlet'
import { ArcDetails } from '../ArcDetails'
import type { DashboardProps } from '../Dashboard'
import { InvestigationDashlets } from '../InvestigationDashlets/InvestigationDashlets'
import { selectInvestigationMetadata } from '../Investigation/selectInvestigationMetadata'
import type { InvestigationMetadata } from '../Investigation/types'
import { ProvenanceExplorer } from '../Provenance/ProvenanceExplorer'
import './stackedDashboard.css'

const sameIndex = (a: unknown, b: unknown) => a === b
export type StackedDashboardProps = DashboardProps

export function StackedDashboardContent({ metadata, provenance, actions, ...props }: StackedDashboardProps & {
  metadata: InvestigationMetadata
  provenance?: ProvenanceIndex
  actions?: ReactNode
}) {
  return (
    <main className="stacked-dashboard">
      {actions && <div className="stacked-dashboard-actions">{actions}</div>}
      <ArcDetails {...props} metadata={metadata} />
      <div className="stacked-dashboard-body">
        <aside className="stacked-dashboard-cards" aria-label="Investigation dashlets">
          <InvestigationDashlets metadata={metadata} arcJson={props.arcJson} classNamePrefix="stacked-dashboard" />
        </aside>
        {provenance ? (
          <PopupDashlet
            title="Graphview"
            description="Explore connections between datasets, experimental processes, and their inputs and outputs."
            className="stacked-dashboard-graphview"
            showHeader={false}
            expandOnClick={false}
          >
            <ProvenanceExplorer index={provenance} embedded />
          </PopupDashlet>
        ) : (
          <section className="stacked-dashboard-graphview" aria-label="Graphview"><Text as="p">No provenance data available.</Text></section>
        )}
      </div>
    </main>
  )
}

export function StackedDashboard(props: StackedDashboardProps) {
  const status = useArcStatus()
  const metadata = useArcSelector(selectInvestigationMetadata)
  const provenance = useArcSelector(buildProvenanceIndex, sameIndex)

  return (
    <DashboardWindow label="StackedDashboard">
      {status.kind === 'error' ? (
        <div className="investigation-feedback">
          <Banner variant="critical" title="Could not load ARC" description={status.error instanceof Error ? status.error.message : String(status.error)} />
        </div>
      ) : !metadata ? (
        <Stack className="investigation-feedback" direction="horizontal" align="center" justify="center" gap="condensed" role="status">
          <Spinner size="large" /><Text as="span">Loading ARC…</Text>
        </Stack>
      ) : (
        <StackedDashboardContent {...props} metadata={metadata} provenance={provenance} />
      )}
    </DashboardWindow>
  )
}
