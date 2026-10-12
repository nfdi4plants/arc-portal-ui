import '@primer/primitives/dist/css/functional/themes/light.css'
import '@primer/css/dist/primer.css'
import { BaseStyles } from '@primer/react'
import { ThemeProvider } from '@primer/react/next'
import DataHubDashboard from './components/DataHubDashboard/DataHubDashboard.tsx'
import { getTopStarredProjects, searchProjects } from './api/gitlab/index.ts'
import { referenceGitLab } from './config/gitlab.ts'
import type { FetchArcs, SearchArcs } from './types/arc.ts'

// Stable callbacks bind the API source here; the dashboard only consumes page data.
const fetchTopStarred: FetchArcs = options => getTopStarredProjects(referenceGitLab.source, options)
const fetchSearch: SearchArcs = (query, options) => searchProjects(referenceGitLab.source, query, options)

export default function App() {
  return <ThemeProvider><BaseStyles>
    <DataHubDashboard fetchTopStarred={fetchTopStarred} fetchSearch={fetchSearch} />
  </BaseStyles></ThemeProvider>
}
