import { useId } from 'react'
import { Button, Spinner } from '@primer/react'
import type { FetchArcs } from '../../types/arc.ts'
import { useProjectPage } from '../../util/useProjectPage.ts'
import { ArcList } from '../ArcList/ArcList.tsx'
import styles from './TopStarredArcs.module.css'

export function TopStarredArcs({ fetchCall }: { fetchCall: FetchArcs }) {
  const headingId = useId()
  const state = useProjectPage(fetchCall)

  return (
    <section className={styles.section} aria-labelledby={headingId}>
      <h2 id={headingId}>Most-starred ARCs</h2>
      <p className={styles.subtitle}>Explore the 10 most-starred public research contexts.</p>
      {state.status === 'loading' && <p role="status" className={styles.status}><Spinner size="small" /> Loading most-starred ARCs…</p>}
      {state.status === 'error' && <div role="alert" className={styles.error}><p>{state.error}</p><Button onClick={state.retry}>Retry most-starred ARCs</Button></div>}
      {state.status === 'success' && (
        state.result.items.length
          ? <ArcList projects={state.result.items} label="Most-starred ARCs" />
          : <p role="status" className={styles.status}>No public ARCs found.</p>
      )}
    </section>
  )
}
