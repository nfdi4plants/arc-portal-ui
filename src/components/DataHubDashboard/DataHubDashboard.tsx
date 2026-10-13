import { useCallback, useState } from 'react'
import type { ArcFetchOptions, FetchArcs, SearchArcs } from '../../types/arc.ts'
import type { FetchGroupArcs, FetchGroups } from '../../types/organisation.ts'
import type { GitLabInstance, GitLabRequestOptions } from '../../types/gitlab.ts'
import { availableDataHubs, defaultDataHub } from '../../config/gitlab.ts'
import { DataHubSelect } from '../DataHubSelect/DataHubSelect.tsx'
import { TopStarredArcs } from '../TopStarredArcs/TopStarredArcs.tsx'
import { ArcSearch } from '../ArcSearch/ArcSearch.tsx'
import { OrganisationBrowser } from '../OrganisationBrowser/OrganisationBrowser.tsx'
import styles from './DataHubDashboard.module.css'
import { Heading, Link, Text } from '@primer/react'

type DataHubRequestOptions = ArcFetchOptions & Pick<GitLabRequestOptions, 'token'>

export interface DataHubDashboardProps {
  fetchTopStarred: (source: string, options?: DataHubRequestOptions) => ReturnType<FetchArcs>
  fetchSearch: (source: string, query: string, options?: DataHubRequestOptions) => ReturnType<SearchArcs>
  tokens?: Record<string, string>
  organisations?: {
    fetchPublicGroups: (source: string, signal: AbortSignal) => ReturnType<FetchGroups>
    fetchMembershipGroups: ((source: string, signal: AbortSignal, token: string) => ReturnType<FetchGroups>) | null
    fetchGroupProjects: (source: string, groupId: number, options?: DataHubRequestOptions) => ReturnType<FetchGroupArcs>
  }
  onArcClick?: (url: string, name: string) => void
}

function DataHubDashboard({ fetchTopStarred, fetchSearch, tokens, organisations, onArcClick }: DataHubDashboardProps) {
  const [activeGitLab, setActiveGitLab] = useState<GitLabInstance>(defaultDataHub)
  const source = activeGitLab.url
  const token = tokens?.[activeGitLab.id]
  const loadTopStarred = useCallback<FetchArcs>(options => fetchTopStarred(source, { ...options, token }), [source, token, fetchTopStarred])
  const searchArcs = useCallback<SearchArcs>((query, options) => fetchSearch(source, query, { ...options, token }), [source, token, fetchSearch])
  const { fetchPublicGroups, fetchMembershipGroups, fetchGroupProjects } = organisations ?? {}
  const loadPublicGroups = useCallback<FetchGroups>(signal => fetchPublicGroups!(source, signal), [source, fetchPublicGroups])
  const loadMembershipGroups = useCallback<FetchGroups>(signal => fetchMembershipGroups!(source, signal, token!), [source, token, fetchMembershipGroups])
  const loadGroupProjects = useCallback<FetchGroupArcs>((groupId, options) => fetchGroupProjects!(source, groupId, { ...options, token }), [source, token, fetchGroupProjects])

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <Text as="p" size="small" weight="semibold" className={styles.eyebrow}>DataPLANT · ARC portal</Text>
        <Heading as="h1" variant="large" className={styles.title}>Discover research contexts</Heading>
        <Text as="p" size="large" className={styles.intro}>Browse Annotated Research Contexts (ARCs), represented here by GitLab repositories.</Text>
        <DataHubSelect availableDataHubs={availableDataHubs} current={activeGitLab} setCurrent={setActiveGitLab} className={styles.instanceSelector} />
        <Link href={`${activeGitLab.url.replace(/\/+$/, '')}/explore/projects/active`} className={styles.source}>Explore {activeGitLab.name} ↗</Link>
      </header>
      <div key={`arcs:${source}`} className={styles.grid}>
        <TopStarredArcs fetchCall={loadTopStarred} onArcClick={onArcClick} />
        <ArcSearch fetchCall={searchArcs} signedIn={!!token} onArcClick={onArcClick} />
      </div>
      {organisations && <OrganisationBrowser key={`organisations:${source}`}
        fetchPublicGroups={loadPublicGroups}
        fetchMembershipGroups={token && fetchMembershipGroups ? loadMembershipGroups : null}
        fetchGroupProjects={loadGroupProjects} onArcClick={onArcClick} />}
    </main>
  )
}

export default DataHubDashboard
