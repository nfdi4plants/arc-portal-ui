import { Spinner, Stack, Text } from '@primer/react'
import { useEffect, useState, type ReactNode } from 'react'
import { ArcProvider } from '../arc/ArcProvider'
import { createArcStore } from '../arc/arcStore'
import { useArcSelector } from '../arc/hooks'
import { selectInvestigationMetadata } from '../components/ArcDashboard/Investigation/selectInvestigationMetadata'
import type { InvestigationMetadata } from '../components/ArcDashboard/Investigation/types'
import { talinumArcSource } from './fixtures/talinumArc'

function StoryContent({ children }: { children: (metadata: InvestigationMetadata) => ReactNode }) {
  const metadata = useArcSelector(selectInvestigationMetadata)
  return metadata ? children(metadata) : (
    <Stack direction="horizontal" align="center" gap="condensed" role="status">
      <Spinner size="small" /><Text as="span">Loading ARC…</Text>
    </Stack>
  )
}

export function TalinumStory({ children }: { children: (metadata: InvestigationMetadata) => ReactNode }) {
  const [store] = useState(() => createArcStore(talinumArcSource))

  useEffect(() => {
    void store.load()
    return () => store.dispose()
  }, [store])

  return <ArcProvider store={store}><StoryContent>{children}</StoryContent></ArcProvider>
}
