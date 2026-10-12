import type { FetchArcs, SearchArcs } from '../../types/arc.ts'
import { referenceGitLab } from '../../config/gitlab.ts'
import { TopStarredArcs } from '../TopStarredArcs/TopStarredArcs.tsx'
import { ArcSearch } from '../ArcSearch/ArcSearch.tsx'
import styles from './DataHubDashboard.module.css'
import { Heading, Link, Text } from '@primer/react'

export interface DataHubDashboardProps {
  fetchTopStarred: FetchArcs
  fetchSearch: SearchArcs
}

function DataHubDashboard({ fetchTopStarred, fetchSearch }: DataHubDashboardProps) {
  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <Text as="p" size="small" weight="semibold" className={styles.eyebrow}>DataPLANT · ARC portal</Text>
        <Heading as="h1" variant="large" className={styles.title}>Discover research contexts</Heading>
        <Text as="p" size="large" className={styles.intro}>Browse Annotated Research Contexts (ARCs), represented here by GitLab repositories.</Text>
        <Link href={referenceGitLab.exploreUrl} className={styles.source}>Explore the reference GitLab instance ↗</Link>
      </header>
      <div className={styles.grid}>
        <TopStarredArcs fetchCall={fetchTopStarred} />
        <ArcSearch fetchCall={fetchSearch} />
      </div>
    </main>
  )
}

export default DataHubDashboard
