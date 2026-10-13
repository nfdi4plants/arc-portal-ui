import { Banner, Spinner, Stack, Text } from '@primer/react'
import { useArcSelector, useArcStatus } from '../../../arc/hooks'
import { Dashlet, DashboardWindow } from '../../DashboardWindow'
import { ArcDetails, type ArcDetailsProps } from '../ArcDetails'
import { InvestigationDetails } from '../Investigation/InvestigationDetails'
import ArcViewer from '../ArcViewer/ArcViewer'
import { selectInvestigationMetadata } from '../Investigation/selectInvestigationMetadata'
import '../Investigation/investigation.css'
import './dashboard.css'

export type DashboardProps = Omit<ArcDetailsProps, 'metadata'> & { arcJson: string }

export function Dashboard(props: DashboardProps) {
  const status = useArcStatus()
  const metadata = useArcSelector(selectInvestigationMetadata)

  return (
    <DashboardWindow label="ARC-Dashboard" fillHeight>
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
          <Dashlet label="Investigation details">
            <InvestigationDetails metadata={metadata} />
          </Dashlet>
          <Dashlet label="ArcWebView">
            <ArcViewer jsonString={props.arcJson} embedded />
          </Dashlet>
        </main>
      )}
    </DashboardWindow>
  )
}
