import { useCallback, useId } from 'react'
import { Banner, Heading, Text } from '@primer/react'
import type { FetchArcs } from '../../types/arc.ts'
import { useProjectPage } from '../../util/useProjectPage.ts'
import { ArcList } from '../ArcList/ArcList.tsx'
import { ArcListSkeleton } from '../ArcList/ArcListSkeleton.tsx'
import styles from './TopStarredArcs.module.css'

export function TopStarredArcs({ fetchCall, onArcClick }: { fetchCall: FetchArcs; onArcClick?: (url: string, name: string, projectId: number) => void }) {
  const headingId = useId()
  const load = useCallback((signal: AbortSignal) => fetchCall({ page: 1, perPage: 10, signal }), [fetchCall])
  const state = useProjectPage(load)

  return (
    <section className={styles.section} aria-labelledby={headingId}>
      <Heading as="h2" variant="medium" id={headingId} className={styles.heading}>Most-starred ARCs</Heading>
      <Text as="p" size="medium" className={styles.subtitle}>Explore the 10 most-starred public research contexts.</Text>
      {state.status === 'loading' && <ArcListSkeleton label="Loading most-starred ARCs…" />}
      {state.status === 'error' && (
        <Banner variant="critical" role="alert" className={styles.error}
          primaryAction={<Banner.PrimaryAction onClick={state.retry}>Retry most-starred ARCs</Banner.PrimaryAction>}>
          <Banner.Title as="h3">Unable to load most-starred ARCs</Banner.Title>
          <Banner.Description>{state.error}</Banner.Description>
        </Banner>
      )}
      {state.status === 'success' && (
        state.result.items.length
          ? <ArcList projects={state.result.items} label="Most-starred ARCs" onArcClick={onArcClick} />
          : <Text as="p" size="medium" role="status" className={styles.status}>No public ARCs found.</Text>
      )}
    </section>
  )
}
