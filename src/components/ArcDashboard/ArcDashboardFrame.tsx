import { Banner, Spinner, Stack, Text } from '@primer/react'
import type { ComponentType } from 'react'
import { useArcSelector, useArcStatus } from '../../arc/hooks'
import { buildProvenanceIndex } from '../../arc/provenance/buildIndex'
import { DashboardWindow } from '../DashboardWindow'
import { selectInvestigationMetadata } from './Investigation/selectInvestigationMetadata'
import type { DashboardContentProps, DashboardProps } from './dashboardTypes'
import './Investigation/investigation.css'

/** Shared store selection and feedback for all standalone ARC dashboard layouts. */
export function ArcDashboardFrame({ content: Content, label, fillHeight, ...props }: DashboardProps & {
  content: ComponentType<DashboardContentProps>
  label: string
  fillHeight?: boolean
}) {
  const status = useArcStatus()
  const metadata = useArcSelector(selectInvestigationMetadata)
  // The index contains Maps: compare by identity rather than structural equality.
  const provenance = useArcSelector(buildProvenanceIndex, Object.is)

  return (
    <DashboardWindow label={label} fillHeight={fillHeight}>
      {status.kind === 'error' ? (
        <div className="investigation-feedback">
          <Banner variant="critical" title="Could not load ARC" description={status.error instanceof Error ? status.error.message : String(status.error)} />
        </div>
      ) : !metadata ? (
        <Stack className="investigation-feedback" direction="horizontal" align="center" justify="center" gap="condensed" role="status">
          <Spinner size="large" /><Text as="span">Loading ARC…</Text>
        </Stack>
      ) : (
        <Content {...props} metadata={metadata} provenance={provenance} />
      )}
    </DashboardWindow>
  )
}
