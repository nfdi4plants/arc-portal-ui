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
import './combinedDashboard.css'

const sameIndex = (a: unknown, b: unknown) => a === b
export type CombinedDashboardProps = DashboardProps

export function CombinedDashboardContent({ metadata, provenance, actions, ...props }: CombinedDashboardProps & {
  metadata: InvestigationMetadata
  provenance?: ProvenanceIndex
  actions?: ReactNode
}) {
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
        <PopupDashlet
          title="Graphview"
          description="Explore connections between datasets, experimental processes, and their inputs and outputs."
          label="Graphview"
          className="combined-dashboard-graphview"
          expandOnClick={false}
        >
          {provenance ? <ProvenanceExplorer index={provenance} embedded /> : <Text as="p">No provenance data available.</Text>}
        </PopupDashlet>
      </div>
    </main>
  )
}

export function CombinedDashboard(props: CombinedDashboardProps) {
  const status = useArcStatus()
  const metadata = useArcSelector(selectInvestigationMetadata)
  const provenance = useArcSelector(buildProvenanceIndex, sameIndex)

  return (
    <DashboardWindow label="CombinedDashboard">
      {status.kind === 'error' ? (
        <div className="investigation-feedback">
          <Banner variant="critical" title="Could not load ARC" description={status.error instanceof Error ? status.error.message : String(status.error)} />
        </div>
      ) : !metadata ? (
        <Stack className="investigation-feedback" direction="horizontal" align="center" justify="center" gap="condensed" role="status">
          <Spinner size="large" /><Text as="span">Loading ARC…</Text>
        </Stack>
      ) : (
        <CombinedDashboardContent {...props} metadata={metadata} provenance={provenance} />
      )}
    </DashboardWindow>
  )
}
