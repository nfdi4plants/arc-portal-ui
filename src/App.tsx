import '@primer/primitives/dist/css/functional/themes/light.css'
import '@primer/css/dist/primer.css'
import { BaseStyles, Link } from '@primer/react'
import { ThemeProvider } from '@primer/react/next'
import { useCallback } from 'react'
import { getTopStarredProjects, searchProjects } from './api/gitlab/index.ts'
import type { ArcSearchOptions } from './types/arc.ts'
import { referenceGitLab } from './config/gitlab.ts'
import { TopStarredArcs } from './components/TopStarredArcs/TopStarredArcs.tsx'
import { ArcSearch } from './components/ArcSearch/ArcSearch.tsx'
import styles from './App.module.css'

interface AppProps {
  fetchCall?: typeof fetch
}

function ArcExample({ fetchCall }: AppProps) {
  // The implementation site wires data fetching; the components only call their props.
  const fetchTopStarred = useCallback((signal: AbortSignal) =>
    getTopStarredProjects(referenceGitLab.source, { signal, fetchCall }), [fetchCall])
  const fetchSearch = useCallback((query: string, options: ArcSearchOptions) =>
    searchProjects(referenceGitLab.source, query, { ...options, fetchCall }), [fetchCall])

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>DataPLANT · ARC portal</p>
        <h1>Discover research contexts</h1>
        <p>Browse Annotated Research Contexts (ARCs), represented here by GitLab repositories.</p>
        <Link href={referenceGitLab.exploreUrl} className={styles.source}>Explore the reference GitLab instance ↗</Link>
      </header>
      <div className={styles.grid}>
        <TopStarredArcs fetchCall={fetchTopStarred} />
        <ArcSearch fetchCall={fetchSearch} />
      </div>
    </main>
  )
}

export default function App({ fetchCall }: AppProps) {
  return <ThemeProvider><BaseStyles><ArcExample fetchCall={fetchCall} /></BaseStyles></ThemeProvider>
}
