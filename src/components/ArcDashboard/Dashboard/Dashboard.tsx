import { Banner, Spinner, Stack, Text } from '@primer/react'
import { useArcSelector, useArcStatus } from '../../../arc/hooks'
import { buildProvenanceIndex } from '../../../arc/provenance/buildIndex'
import { Dashlet, DashboardWindow } from '../../DashboardWindow'
import { ArcDetails, type ArcDetailsProps } from '../ArcDetails'
import { InvestigationDetails } from '../Investigation/InvestigationDetails'
import ArcViewer from '../ArcViewer/ArcViewer'
import { ProvenanceExplorer } from '../Provenance/ProvenanceExplorer'
import { selectInvestigationMetadata } from '../Investigation/selectInvestigationMetadata'
import '../Investigation/investigation.css'
import './dashboard.css'

export type DashboardProps = Omit<ArcDetailsProps, 'metadata'> & { arcJson: string }

export function Dashboard(props: DashboardProps) {
  const status = useArcStatus()
  const metadata = useArcSelector(selectInvestigationMetadata)
  // The index holds Maps, so it is compared by identity. It changes only when the ARC changes.
  const provenance = useArcSelector(buildProvenanceIndex, (a, b) => a === b)

  return (
    <DashboardWindow title="ARC-Dashboard" fillHeight>
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
        <main className="arc-dashboard-layout">
          <ArcDetails {...props} metadata={metadata} />
          <Dashlet title={metadata.title}>
            <InvestigationDetails metadata={metadata} />
          </Dashlet>
          <Dashlet title="ArcWebView">
            <ArcViewer jsonString={props.arcJson} embedded />
          </Dashlet>
          {provenance && (
            <Dashlet title="Provenance">
              <div className="provenance-dashlet">
                <ProvenanceExplorer index={provenance} />
              </div>
            </Dashlet>
          )}
        </main>
      )}
    </DashboardWindow>
  )
}
