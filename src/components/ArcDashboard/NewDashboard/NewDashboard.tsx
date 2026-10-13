import { Banner, Spinner, Stack, Text } from '@primer/react'
import { GraphIcon } from '@primer/octicons-react'
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
import '../Investigation/InvestigationDetails/investigationDetails.css'
import './newDashboard.css'

const sameIndex = (a: unknown, b: unknown) => a === b

export type NewDashboardProps = DashboardProps

function OrbitDashlet({ title, description, className, children }: {
  title: string
  description: string
  className: string
  children: ReactNode
}) {
  return (
    <PopupDashlet title={title} description={description} symbol={<GraphIcon size={48} />} label={title === 'Description' ? title : `${title} dashlet`} className={`new-dashboard-tile ${className}`}>
      {children}
    </PopupDashlet>
  )
}

export function NewDashboardContent({ metadata, provenance, actions, ...props }: NewDashboardProps & {
  metadata: InvestigationMetadata
  provenance?: ProvenanceIndex
  actions?: ReactNode
}) {
  return (
    <main className="new-dashboard">
      {actions && <div className="new-dashboard-actions">{actions}</div>}
      <div className="new-dashboard-orbit">
        <div className="new-dashboard-hub">
          <ArcDetails {...props} metadata={metadata} />
        </div>
        <InvestigationDashlets metadata={metadata} arcJson={props.arcJson} classNamePrefix="new-dashboard" />
        <OrbitDashlet title="Graphview" className="new-dashboard-graphview" description="Explore connections between datasets, experimental processes, and their inputs and outputs.">
          {provenance ? <ProvenanceExplorer index={provenance} embedded /> : <Text as="p">No provenance data available.</Text>}
        </OrbitDashlet>
      </div>
    </main>
  )
}

export function NewDashboard(props: NewDashboardProps) {
  const status = useArcStatus()
  const metadata = useArcSelector(selectInvestigationMetadata)
  const provenance = useArcSelector(buildProvenanceIndex, sameIndex)

  return (
    <DashboardWindow label="NewDashboard" fillHeight>
      {status.kind === 'error' ? (
        <div className="investigation-feedback">
          <Banner
            variant="critical"
            title="Could not load ARC"
            description={status.error instanceof Error ? status.error.message : String(status.error)}
          />
        </div>
      ) : !metadata ? (
        <Stack className="investigation-feedback" direction="horizontal" align="center" justify="center" gap="condensed" role="status">
          <Spinner size="large" />
          <Text as="span">Loading ARC…</Text>
        </Stack>
      ) : (
        <NewDashboardContent {...props} metadata={metadata} provenance={provenance} />
      )}
    </DashboardWindow>
  )
}
