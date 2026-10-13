import { ScreenFullIcon } from '@primer/octicons-react'
import { dataHubRepositoryUrl } from '../../../api/gitlab'
import { Banner, IconButton, Spinner, Stack, Text } from '@primer/react'
import { useArcSelector, useArcStatus } from '../../../arc/hooks'
import { Dashlet, DashboardWindow } from '../../DashboardWindow'
import { ArcDetails, type ArcDetailsProps } from '../ArcDetails'
import { InvestigationDetails } from '../Investigation/InvestigationDetails'
import { openInvestigationPopup } from '../Investigation/InvestigationDetails/InvestigationPopup'
import ArcViewer from '../ArcViewer/ArcViewer'
import { openArcViewerPopup } from '../ArcViewer/ArcViewerPopup'
import { selectInvestigationMetadata } from '../Investigation/selectInvestigationMetadata'
import '../Investigation/investigation.css'
import './dashboard.css'

export type DashboardProps = Omit<ArcDetailsProps, 'metadata'> & {
  arcJson: string
  token?: string
}

export function Dashboard(props: DashboardProps) {
  const status = useArcStatus()
  const metadata = useArcSelector(selectInvestigationMetadata)
  const repositoryUrl = props.repository ? dataHubRepositoryUrl(props.repository) : undefined

  const renderActions = () => (
    <IconButton
      icon={ScreenFullIcon}
      size="small"
      variant="invisible"
      aria-label="Open investigation details in popup"
      onClick={(event) => {
        event.stopPropagation()
        if (metadata) openInvestigationPopup(metadata)
      }}
    />
  )

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
          <Dashlet title={metadata.title} actions={renderActions()}>
            <InvestigationDetails metadata={metadata} />
          </Dashlet>
          <Dashlet title="ArcWebView" actions={
            <IconButton
              icon={ScreenFullIcon}
              size="small"
              variant="invisible"
              aria-label="Open ARC viewer in popup"
              onClick={(event) => {
                event.stopPropagation()
                openArcViewerPopup(props.arcJson, metadata.title, repositoryUrl, props.token)
              }}
            />
          }>
            <ArcViewer jsonString={props.arcJson} repositoryUrl={repositoryUrl} token={props.token} embedded />
          </Dashlet>
        </main>
      )}
    </DashboardWindow>
  )
}
