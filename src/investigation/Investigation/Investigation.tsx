import { Banner, Spinner, Stack, Text } from '@primer/react'
import { useArcSelector, useArcStatus } from '../../arc/hooks'
import { InvestigationView } from '../InvestigationView'
import { InvestigationWindow } from '../InvestigationWindow'
import { selectInvestigationMetadata } from '../selectInvestigationMetadata'

export function Investigation() {
  const status = useArcStatus()
  const metadata = useArcSelector(selectInvestigationMetadata)

  if (status.kind === 'error') {
    return (
      <InvestigationWindow>
        <Stack className="investigation-feedback" align="center" justify="center">
          <Banner
            variant="critical"
            title="Could not load investigation"
            description={status.error instanceof Error ? status.error.message : String(status.error)}
          />
        </Stack>
      </InvestigationWindow>
    )
  }

  if (!metadata) {
    return (
      <InvestigationWindow>
        <Stack
          className="investigation-feedback"
          direction="horizontal"
          align="center"
          justify="center"
          gap="condensed"
          role="status"
        >
          <Spinner size="large" />
          <Text as="span">Loading investigation…</Text>
        </Stack>
      </InvestigationWindow>
    )
  }

  return (
    <InvestigationWindow>
      <InvestigationView metadata={metadata} />
    </InvestigationWindow>
  )
}
