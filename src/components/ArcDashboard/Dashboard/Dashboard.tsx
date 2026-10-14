import { ScreenFullIcon } from '@primer/octicons-react'
import { dataHubRepositoryUrl } from '../../../api/gitlab'
import { openInvestigationPopup } from '../Investigation/InvestigationDetails/InvestigationPopup'
import { openArcViewerPopup } from '../ArcViewer/ArcViewerPopup'
import { Banner, IconButton, Spinner, Stack, Text } from '@primer/react'
import { lazy, Suspense, type ReactNode } from 'react'
import { useArcSelector, useArcStatus } from '../../../arc/hooks'
import { buildProvenanceIndex } from '../../../arc/provenance/buildIndex'
import type { ProvenanceIndex } from '../../../arc/provenance/types'
import { Dashlet, DashboardWindow } from '../../DashboardWindow'
import { ArcDetails, type ArcDetailsProps } from '../ArcDetails'
import { InvestigationDetails } from '../Investigation/InvestigationDetails'
import { GraphviewDashlet } from '../Provenance/GraphviewDashlet'
import { selectInvestigationMetadata } from '../Investigation/selectInvestigationMetadata'
import type { InvestigationMetadata } from '../Investigation/types'
import '../Investigation/investigation.css'
import './dashboard.css'

// The provenance index holds Maps, so it is compared by identity. The comparator lives here and
// not inline, because a new comparator on every render would build the index again each time.
const sameIndex = (a: unknown, b: unknown) => a === b
const ArcViewer = lazy(() => import('../ArcViewer/ArcViewer'))

export type DashboardProps = Omit<ArcDetailsProps, 'metadata'> & { arcJson: string; token?: string; repositoryUrl?: string }

export function DashboardContent({ metadata, provenance, actions, ...props }: DashboardProps & {
  metadata: InvestigationMetadata
  provenance?: ProvenanceIndex
  actions?: ReactNode
}) {
  const repositoryUrl = props.repositoryUrl ?? (props.repository ? dataHubRepositoryUrl(props.repository) : undefined)
  return (
    <main className="arc-dashboard-layout">
      {actions && <div className="arc-dashboard-actions">{actions}</div>}
      <ArcDetails {...props} metadata={metadata} />
      <Dashlet label="Investigation details" actions={
        <IconButton icon={ScreenFullIcon} size="small" variant="invisible"
          aria-label="Open investigation details in popup"
          onClick={() => openInvestigationPopup(metadata)} />
      }>
        <InvestigationDetails metadata={metadata} />
      </Dashlet>
      <Dashlet label="ArcWebView" actions={
        <IconButton icon={ScreenFullIcon} size="small" variant="invisible"
          aria-label="Open ARC viewer in popup"
          onClick={() => openArcViewerPopup(props.arcJson, metadata.title, repositoryUrl, props.token)} />
      }>
        <Suspense fallback={<Text as="p" role="status">Loading ARC viewer…</Text>}>
          <ArcViewer jsonString={props.arcJson} repositoryUrl={repositoryUrl} token={props.token} embedded />
        </Suspense>
      </Dashlet>
      {provenance && <GraphviewDashlet index={provenance} />}
    </main>
  )
}

export function Dashboard(props: DashboardProps) {
  const status = useArcStatus()
  const metadata = useArcSelector(selectInvestigationMetadata)
  const provenance = useArcSelector(buildProvenanceIndex, sameIndex)

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
        <DashboardContent {...props} metadata={metadata} provenance={provenance} />
      )}
    </DashboardWindow>
  )
}
