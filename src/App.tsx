import '@primer/primitives/dist/css/functional/themes/light.css'
import '@primer/css/dist/primer.css'
import { BaseStyles } from '@primer/react'
import { useCallback, useState } from 'react'
import { ThemeProvider } from '@primer/react/next'
import DataHubDashboard from './components/DataHubDashboard/DataHubDashboard.tsx'
import { getGroupProjects, getTopStarredProjects, listAllGroups, searchProjects } from './api/gitlab/index.ts'
import { referenceGitLab } from './config/gitlab.ts'
import type { FetchArcs, SearchArcs } from './types/arc.ts'
import type { FetchGroupArcs, FetchGroups } from './types/organisation.ts'
import { AuthenticationProvider } from './auth/AuthenticationProvider.tsx'
import { useAuthentication } from './auth/context.ts'
import { Navbar } from './components/Navbar/Navbar.tsx'
import ArcDashboard from './components/ArcDashboard/ArcDashboard.tsx'

const fetchPublicGroups: FetchGroups = signal => listAllGroups(referenceGitLab.source, { visibility: 'public', signal })

type PageState =
  | {
    type: "datahub-dashboard";
  }
  | {
    type: "arc-dashboard";
    data: {
      url: string;
      name: string;
    };
  };

function Portal() {
  const { session } = useAuthentication()
  const [pageState, setPageState] = useState<PageState>({ type: "datahub-dashboard" })
  const token = session?.token
  const fetchTopStarred = useCallback<FetchArcs>(options =>
    getTopStarredProjects(referenceGitLab.source, { ...options, token }), [token])
  const fetchSearch = useCallback<SearchArcs>((query, options) =>
    searchProjects(referenceGitLab.source, query, { ...options, token }), [token])
  const fetchMembershipGroups = useCallback<FetchGroups>(signal =>
    listAllGroups(referenceGitLab.source, { token, allAvailable: false, signal }), [token])
  const fetchGroupProjects = useCallback<FetchGroupArcs>((groupId, options) =>
    getGroupProjects(referenceGitLab.source, groupId, { ...options, token }), [token])

  return <>
    <Navbar />
    {
      pageState.type === "arc-dashboard" ? (
        <ArcDashboard url={pageState.data.url} name={pageState.data.name} onBack={() => setPageState({ type: "datahub-dashboard" })} />
      ) :
      <DataHubDashboard
        onArcClick={(url, name) => setPageState({ type: "arc-dashboard", data: { url, name } })}
        fetchTopStarred={fetchTopStarred} fetchSearch={fetchSearch} signedIn={!!session}
        organisations={{ fetchPublicGroups, fetchMembershipGroups: session ? fetchMembershipGroups : null, fetchGroupProjects }} />
    }
  </>
}

export default function App() {
  return <ThemeProvider><BaseStyles>
    <AuthenticationProvider source={referenceGitLab.source}><Portal /></AuthenticationProvider>
  </BaseStyles></ThemeProvider>
}
